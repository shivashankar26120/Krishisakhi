"""
NLP / RAG service — wraps the notebook's SECTION 25 krishi_rag_pipeline.

Notebook source of truth:
    - SECTION 11: offset-indexed KB record access (O(1) seek, no full JSONL in RAM)
    - SECTION 13: BGE-M3 embedding model loading
    - SECTION 14: Qwen2.5 LLM loading with 4-bit candidate chain
    - SECTION 14b: IndicTrans2 bidirectional translation (Kannada↔English)
    - SECTION 20: FAISS index reload from disk
    - SECTION 21: retrieve() function
    - SECTION 24: generate_answer() with system prompt + refusal path
    - SECTION 25: krishi_rag_pipeline() end-to-end

Key design decisions preserved from notebook:
    - offset_index.npy is loaded into RAM (small, ~1.5 MB)
    - KB JSONL file is kept open; records are read via O(1) seek — never loaded in full
    - FAISS inner-product search (normalised embeddings)
    - Low-score retrieval triggers refusal message (not hallucination)
    - Translation is optional; disabled if IndicTrans2 fails to load
"""
from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton state
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_initialized = False
_init_error: str | None = None

# Offset-indexed KB
_offset_index: np.ndarray | None = None
_n_total_records: int = 0
_kb_file_handle = None

# Models
_embed_model = None
_faiss_index = None
_llm_tokenizer = None
_llm_model = None
_translation_ready = False
_ip = None
_src2en_tok = None
_src2en_model = None
_en2tgt_tok = None
_en2tgt_model = None

# System prompt — preserved verbatim from notebook SECTION 24
_SYSTEM_PROMPT = (
    "You are an agricultural assistant for Indian farmers. You will be given a farmer's "
    "question and several retrieved QA information records from an agricultural knowledge "
    "base. Rules:\n"
    "1. Answer the farmer's question directly, in clear, farmer-friendly language.\n"
    "2. Use the retrieved records as evidence. Synthesize information across multiple "
    "records when the question needs it. Ignore irrelevant records.\n"
    "3. Do NOT invent agricultural facts, dosages, or chemical recommendations that are not "
    "supported by the retrieved records.\n"
    "4. Do NOT claim certainty when the evidence is weak or missing.\n"
    "5. If retrieved records conflict, briefly say the sources differ rather than inventing "
    "a resolution or silently picking one.\n"
    "6. If the retrieved evidence is clearly insufficient, say plainly that you do not have "
    "enough verified information, and do not guess.\n"
    "7. Never mention FAISS, embeddings, retrieval scores, or other internal system details."
)

_REFUSAL_MESSAGE = (
    "I don't have enough verified information in the agricultural knowledge base "
    "to answer this confidently. Please consult your local agricultural extension "
    "office or Krishi Vigyan Kendra for this specific case."
)


# ---------------------------------------------------------------------------
# Initialisation helpers
# ---------------------------------------------------------------------------

def _load_kb_access_layer(settings) -> str | None:
    """Load offset index and open KB file handle. Returns error string or None."""
    global _offset_index, _n_total_records, _kb_file_handle

    offset_path: Path = settings.nlp_offset_index_path
    kb_path: Path = settings.nlp_kb_path

    if not offset_path.exists():
        return f"Offset index not found: {offset_path}"
    if not kb_path.exists():
        return f"Knowledge base JSONL not found: {kb_path}"

    _offset_index = np.load(str(offset_path))
    _n_total_records = len(_offset_index)
    _kb_file_handle = open(str(kb_path), "rb")
    logger.info("[KB] %d records loaded via offset index (%s).", _n_total_records, offset_path)
    return None


def _load_embedding_model(settings) -> str | None:
    global _embed_model
    try:
        from sentence_transformers import SentenceTransformer
        import torch
        device = "cuda" if _torch_cuda_available() else "cpu"
        _embed_model = SentenceTransformer(
            settings.nlp_embedding_model, device=device
        )
        _embed_model.max_seq_length = settings.nlp_embedding_max_seq_length
        logger.info("[EMBED] %s loaded on %s.", settings.nlp_embedding_model, device)
        return None
    except Exception as exc:
        return f"Failed to load embedding model ({settings.nlp_embedding_model}): {exc}"


def _load_faiss_index(settings) -> str | None:
    global _faiss_index
    faiss_path: Path = settings.nlp_faiss_index_path
    if not faiss_path.exists():
        return (
            f"FAISS index not found: {faiss_path}. "
            "Build it by running the full NLP notebook (SECTIONS 17-19) once."
        )
    try:
        import faiss
        idx = faiss.read_index(str(faiss_path))
        if idx.ntotal != _n_total_records:
            return (
                f"FAISS index size mismatch: {idx.ntotal} vectors vs "
                f"{_n_total_records} KB records. Rebuild the index."
            )
        _faiss_index = idx
        logger.info("[FAISS] Index loaded: %d vectors.", idx.ntotal)
        return None
    except Exception as exc:
        return f"Failed to load FAISS index: {exc}"


def _torch_cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _verify_bnb_4bit() -> tuple[bool, str]:
    """Real 4-bit capability check from notebook SECTION 14."""
    if not _torch_cuda_available():
        return False, "no GPU available"
    try:
        import torch
        import bitsandbytes as bnb
        cc_major, _ = torch.cuda.get_device_capability(0)
        if cc_major < 7:
            return False, f"GPU compute capability {cc_major}.x too old for nf4"
        probe = torch.nn.Linear(64, 64)
        q_probe = bnb.nn.Linear4bit(64, 64, compute_dtype=torch.float16)
        q_probe.load_state_dict(probe.state_dict(), strict=False)
        q_probe = q_probe.to("cuda")
        x = torch.randn(2, 64, dtype=torch.float16, device="cuda")
        with torch.no_grad():
            _ = q_probe(x)
        del probe, q_probe, x
        return True, f"bitsandbytes {getattr(bnb, '__version__', '?')} 4-bit OK"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def _load_llm(settings) -> str | None:
    """Load best available LLM from the candidate chain. Notebook SECTION 14 logic."""
    global _llm_tokenizer, _llm_model
    import gc

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    except ImportError as exc:
        return f"transformers/torch not installed: {exc}"

    bnb_ok, bnb_msg = _verify_bnb_4bit()
    logger.info("[BNB] 4-bit: %s (%s)", bnb_ok, bnb_msg)
    gpu_available = _torch_cuda_available()

    # Parse candidate list from settings string
    candidates = []
    for entry in settings.nlp_llm_candidate_models.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(":")
        name = parts[0]
        require_4bit = parts[1].lower() == "true" if len(parts) > 1 else False
        min_tok_s = float(parts[2]) if len(parts) > 2 else 0.0
        candidates.append((name, require_4bit, min_tok_s))

    last_error = "No LLM candidates configured."
    for name, require_4bit, min_tok_s in candidates:
        try:
            use_4bit = require_4bit and bnb_ok
            if require_4bit and not bnb_ok:
                logger.warning("[LLM] Skipping %s (require_4bit=True but BNB unavailable).", name)
                last_error = f"{name}: 4-bit required but unavailable"
                continue

            logger.info("[LLM] Trying %s (4bit=%s) …", name, use_4bit)
            tok = AutoTokenizer.from_pretrained(name)
            bnb_cfg = None
            if use_4bit:
                bnb_cfg = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                )
            model = AutoModelForCausalLM.from_pretrained(
                name,
                quantization_config=bnb_cfg,
                device_map="auto" if gpu_available else None,
                torch_dtype=torch.float16 if gpu_available else torch.float32,
            )
            if not gpu_available:
                model = model.to("cpu")

            # Speed smoke-test for non-zero min_tok_s
            if min_tok_s > 0:
                msgs = [{"role": "user", "content": "Say 'ready'."}]
                prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
                inputs = tok(prompt, return_tensors="pt").to(model.device)
                t0 = time.time()
                with torch.no_grad():
                    out = model.generate(**inputs, max_new_tokens=5,
                                         pad_token_id=tok.eos_token_id)
                elapsed = time.time() - t0
                n_new = out.shape[1] - inputs["input_ids"].shape[1]
                tok_per_s = n_new / max(elapsed, 1e-6)
                logger.info("[LLM] %s smoke test: %.1f tok/s (min required %.1f).", name, tok_per_s, min_tok_s)
                if tok_per_s < min_tok_s:
                    del model, tok
                    gc.collect()
                    if gpu_available:
                        torch.cuda.empty_cache()
                    last_error = f"{name}: too slow ({tok_per_s:.1f} tok/s < {min_tok_s})"
                    continue

            _llm_tokenizer = tok
            _llm_model = model
            logger.info("[LLM] Using %s.", name)
            return None

        except Exception as exc:
            last_error = f"{name}: {exc}"
            logger.warning("[LLM] Candidate failed: %s", last_error)
            gc.collect()

    return f"All LLM candidates failed. Last error: {last_error}"


def _load_translation(settings) -> None:
    """Attempt to load IndicTrans2. Failure is non-fatal (translation disabled)."""
    global _translation_ready, _ip, _src2en_tok, _src2en_model, _en2tgt_tok, _en2tgt_model
    if not settings.nlp_translation_enabled:
        logger.info("[TRANSLATION] Disabled by configuration.")
        return
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        from IndicTransToolkit.processor import IndicProcessor

        gpu = _torch_cuda_available()
        dtype = torch.float16 if gpu else torch.float32
        device = "cuda" if gpu else "cpu"

        ip = IndicProcessor(inference=True)
        s2e_name = settings.nlp_translation_src_to_en_model
        e2t_name = settings.nlp_translation_en_to_tgt_model

        s2e_tok = AutoTokenizer.from_pretrained(s2e_name, trust_remote_code=True)
        s2e_model = AutoModelForSeq2SeqLM.from_pretrained(
            s2e_name, trust_remote_code=True, torch_dtype=dtype
        ).to(device)

        e2t_tok = AutoTokenizer.from_pretrained(e2t_name, trust_remote_code=True)
        e2t_model = AutoModelForSeq2SeqLM.from_pretrained(
            e2t_name, trust_remote_code=True, torch_dtype=dtype
        ).to(device)

        _ip = ip
        _src2en_tok, _src2en_model = s2e_tok, s2e_model
        _en2tgt_tok, _en2tgt_model = e2t_tok, e2t_model
        _translation_ready = True
        logger.info("[TRANSLATION] IndicTrans2 loaded (both directions).")
    except Exception as exc:
        logger.warning("[TRANSLATION] Disabled — could not load IndicTrans2: %s", exc)


def initialize(settings) -> dict[str, str]:
    """
    Eagerly load all NLP components. Call once at application startup.
    Returns a dict of component → status.
    """
    global _initialized, _init_error

    with _lock:
        if _initialized:
            return get_status()

        statuses: dict[str, str] = {}

        err = _load_kb_access_layer(settings)
        statuses["kb_access"] = "ok" if err is None else f"ERROR: {err}"

        err = _load_embedding_model(settings)
        statuses["embedding_model"] = "ok" if err is None else f"ERROR: {err}"

        err = _load_faiss_index(settings)
        statuses["faiss_index"] = "ok" if err is None else f"ERROR: {err}"

        err = _load_llm(settings)
        statuses["llm"] = "ok" if err is None else f"ERROR: {err}"

        _load_translation(settings)
        statuses["translation"] = "ok" if _translation_ready else "disabled/unavailable"

        _initialized = True
        logger.info("[NLP] Initialisation complete. Statuses: %s", statuses)
        return statuses


def get_status() -> dict[str, str]:
    return {
        "kb_access": "ok" if _kb_file_handle is not None else "not loaded",
        "embedding_model": "ok" if _embed_model is not None else "not loaded",
        "faiss_index": "ok" if _faiss_index is not None else "not loaded",
        "llm": "ok" if _llm_model is not None else "not loaded",
        "translation": "ok" if _translation_ready else "disabled/unavailable",
        "total_records": _n_total_records,
    }


# ---------------------------------------------------------------------------
# Record access (Section 11 logic)
# ---------------------------------------------------------------------------

def get_record(record_id: int) -> dict:
    if _offset_index is None or _kb_file_handle is None:
        raise RuntimeError("KB access layer not initialised.")
    if record_id < 0 or record_id >= _n_total_records:
        raise IndexError(f"record_id {record_id} out of range [0, {_n_total_records})")
    _kb_file_handle.seek(int(_offset_index[record_id]))
    return json.loads(_kb_file_handle.readline())


# ---------------------------------------------------------------------------
# Retrieval (Section 21 logic)
# ---------------------------------------------------------------------------

def retrieve(query: str, top_k: int, settings) -> list[dict]:
    if _embed_model is None:
        raise RuntimeError("Embedding model not loaded.")
    if _faiss_index is None:
        raise RuntimeError(
            "FAISS index not loaded. "
            "Build it by running SECTIONS 17-19 of the NLP notebook."
        )

    q_emb = _embed_model.encode(
        [query],
        normalize_embeddings=settings.nlp_embedding_normalize,
        convert_to_numpy=True,
    )
    q_emb = np.ascontiguousarray(q_emb, dtype=np.float32)
    D, I = _faiss_index.search(q_emb, top_k)

    results = []
    for score, idx in zip(D[0], I[0]):
        if idx == -1:
            continue
        rec = get_record(int(idx))
        results.append({
            "record_id": rec["record_id"],
            "question": rec["question"],
            "answer": rec["answer"],
            "source_dataset": rec.get("source_dataset"),
            "score": round(float(score), 4),
        })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Translation helpers (Section 14b logic)
# ---------------------------------------------------------------------------

def _translate(text: str, direction: str, settings) -> str:
    """direction: 'src2en' or 'en2tgt'"""
    import torch

    if direction == "src2en":
        tok, model = _src2en_tok, _src2en_model
        src = settings.nlp_translation_src_lang
        tgt = settings.nlp_translation_tgt_lang
    else:
        tok, model = _en2tgt_tok, _en2tgt_model
        src = settings.nlp_translation_tgt_lang
        tgt = settings.nlp_translation_src_lang

    batch = _ip.preprocess_batch([text], src_lang=src, tgt_lang=tgt)
    inputs = tok(batch, padding=True, truncation=True, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=256, num_beams=5)
    decoded = tok.batch_decode(out, skip_special_tokens=True)
    return _ip.postprocess_batch(decoded, lang=tgt)[0]


# ---------------------------------------------------------------------------
# Generation (Section 24 logic)
# ---------------------------------------------------------------------------

def _format_records_for_llm(records: list[dict]) -> str:
    return "\n\n".join(
        f"[RECORD {i}]\nQuestion: {r['question']}\nAnswer: {r['answer']}"
        for i, r in enumerate(records, 1)
    )


def _is_low_confidence(records: list[dict], min_score: float) -> bool:
    return (not records) or records[0]["score"] < min_score


def _generate_answer(question: str, records: list[dict], settings) -> tuple[str, bool]:
    """Returns (answer_text, refused). Notebook SECTION 24 logic."""
    import torch

    if _llm_model is None or _llm_tokenizer is None:
        raise RuntimeError("LLM not loaded.")

    if _is_low_confidence(records, settings.nlp_retrieval_min_score):
        return _REFUSAL_MESSAGE, True

    context = _format_records_for_llm(records)
    user_msg = (
        f"FARMER QUESTION:\n{question}\n\n"
        f"RETRIEVED AGRICULTURAL INFORMATION:\n{context}\n\n"
        "Write a single synthesized, farmer-friendly answer following the system rules."
    )
    msgs = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    prompt = _llm_tokenizer.apply_chat_template(
        msgs, tokenize=False, add_generation_prompt=True
    )
    inputs = _llm_tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=settings.nlp_llm_context_length,
    ).to(_llm_model.device)

    with torch.no_grad():
        out = _llm_model.generate(
            **inputs,
            max_new_tokens=settings.nlp_llm_max_new_tokens,
            do_sample=True,
            temperature=settings.nlp_llm_temperature,
            top_p=settings.nlp_llm_top_p,
            pad_token_id=_llm_tokenizer.eos_token_id,
        )
    text = _llm_tokenizer.decode(
        out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )
    return text.strip(), False


# ---------------------------------------------------------------------------
# Full pipeline (Section 25 logic)
# ---------------------------------------------------------------------------

def run_pipeline(
    question: str,
    settings,
    top_k: int | None = None,
    translate_from_kannada: bool = False,
) -> dict[str, Any]:
    """
    Full RAG pipeline. Mirrors notebook SECTION 25 krishi_rag_pipeline().

    Returns:
        question, working_question_en, retrieved_records,
        refused, answer, translation_used, timings
    """
    timings: dict[str, float] = {}
    t_total = time.time()
    top_k = top_k or settings.nlp_retrieval_top_k

    working_question = question

    # Optional Kannada → English translation
    if translate_from_kannada and _translation_ready:
        t0 = time.time()
        working_question = _translate(question, "src2en", settings)
        timings["translation_in_s"] = round(time.time() - t0, 3)

    # Retrieval
    t0 = time.time()
    records = retrieve(working_question, top_k=top_k, settings=settings)
    timings["retrieval_s"] = round(time.time() - t0, 3)

    # Generation
    t0 = time.time()
    answer_en, refused = _generate_answer(working_question, records, settings)
    timings["generation_s"] = round(time.time() - t0, 3)

    final_answer = answer_en

    # Optional English → Kannada translation
    if translate_from_kannada and _translation_ready and not refused:
        t0 = time.time()
        final_answer = _translate(answer_en, "en2tgt", settings)
        timings["translation_out_s"] = round(time.time() - t0, 3)

    timings["total_s"] = round(time.time() - t_total, 3)

    return {
        "question": question,
        "working_question_en": working_question,
        "retrieved_records": records,
        "refused": refused,
        "answer": final_answer,
        "translation_used": translate_from_kannada and _translation_ready,
        "timings": timings,
    }
