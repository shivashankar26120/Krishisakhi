"""
NLP / RAG service — wraps the notebook's SECTION 25 krishi_rag_pipeline.

Notebook source of truth:
- SECTION 11: offset-indexed KB record access
- SECTION 13: BGE-M3 embedding model loading
- SECTION 14: Qwen2.5 LLM loading with 4-bit candidate chain
- SECTION 14b: IndicTrans2 bidirectional translation
- SECTION 20: FAISS index reload from disk
- SECTION 21: retrieve() function
- SECTION 24: generate_answer() with system prompt + refusal path
- SECTION 25: krishi_rag_pipeline() end-to-end

Railway deployment adaptation:
- BGE-M3 remains local.
- FAISS remains local.
- KB JSONL remains local.
- Qwen LLM is accessed through Hugging Face Inference Providers.
- The Qwen model weights are NOT downloaded into the Railway container.
- HF_TOKEN is read from the environment.
- Translation remains optional and local.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np


logger = logging.getLogger(__name__)


# ============================================================================
# Singleton state
# ============================================================================

_lock = threading.Lock()
_initialized = False
_init_error: str | None = None


# ============================================================================
# Offset-indexed KB
# ============================================================================

_offset_index: np.ndarray | None = None
_n_total_records: int = 0
_kb_file_handle = None


# ============================================================================
# Models / services
# ============================================================================

_embed_model = None
_faiss_index = None

# Hugging Face InferenceClient replaces the old local Transformers model.
_llm_client = None

_translation_ready = False
_ip = None

_src2en_tok = None
_src2en_model = None

_en2tgt_tok = None
_en2tgt_model = None


# ============================================================================
# System prompt
# Preserved from notebook SECTION 24
# ============================================================================

_SYSTEM_PROMPT = (
    "You are an agricultural assistant for Indian farmers. You will be given a "
    "farmer's question and several retrieved QA information records from an "
    "agricultural knowledge base. Rules:\n"
    "1. Answer the farmer's question directly, in clear, farmer-friendly language.\n"
    "2. Use the retrieved records as evidence. Synthesize information across "
    "multiple records when the question needs it. Ignore irrelevant records.\n"
    "3. Do NOT invent agricultural facts, dosages, or chemical recommendations "
    "that are not supported by the retrieved records.\n"
    "4. Do NOT claim certainty when the evidence is weak or missing.\n"
    "5. If retrieved records conflict, briefly say the sources differ rather than "
    "inventing a resolution or silently picking one.\n"
    "6. If the retrieved evidence is clearly insufficient, say plainly that you "
    "do not have enough verified information, and do not guess.\n"
    "7. Never mention FAISS, embeddings, retrieval scores, or other internal "
    "system details."
)


_REFUSAL_MESSAGE = (
    "I don't have enough verified information in the agricultural knowledge base "
    "to answer this confidently. Please consult your local agricultural extension "
    "office or Krishi Vigyan Kendra for this specific case."
)


# ============================================================================
# Initialisation helpers
# ============================================================================

def _load_kb_access_layer(settings) -> str | None:
    """Load offset index and open KB file handle."""

    global _offset_index
    global _n_total_records
    global _kb_file_handle

    offset_path: Path = settings.nlp_offset_index_path
    kb_path: Path = settings.nlp_kb_path

    if not offset_path.exists():
        return f"Offset index not found: {offset_path}"

    if not kb_path.exists():
        return f"Knowledge base JSONL not found: {kb_path}"

    try:
        _offset_index = np.load(str(offset_path))
        _n_total_records = len(_offset_index)

        _kb_file_handle = open(str(kb_path), "rb")

        logger.info(
            "[KB] %d records loaded via offset index (%s).",
            _n_total_records,
            offset_path,
        )

        return None

    except Exception as exc:
        return f"Failed to load KB access layer: {exc}"


def _load_embedding_model(settings) -> str | None:
    """Load BGE-M3 embedding model locally."""

    global _embed_model

    try:
        from sentence_transformers import SentenceTransformer

        device = "cuda" if _torch_cuda_available() else "cpu"

        _embed_model = SentenceTransformer(
            settings.nlp_embedding_model,
            device=device,
        )

        _embed_model.max_seq_length = (
            settings.nlp_embedding_max_seq_length
        )

        logger.info(
            "[EMBED] %s loaded on %s.",
            settings.nlp_embedding_model,
            device,
        )

        return None

    except Exception as exc:
        return (
            f"Failed to load embedding model "
            f"({settings.nlp_embedding_model}): {exc}"
        )


def _load_faiss_index(settings) -> str | None:
    """Load FAISS index from disk."""

    global _faiss_index

    faiss_path: Path = settings.nlp_faiss_index_path

    if not faiss_path.exists():
        return (
            f"FAISS index not found: {faiss_path}. "
            "Build it by running the full NLP notebook "
            "(SECTIONS 17-19) once."
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

        logger.info(
            "[FAISS] Index loaded: %d vectors.",
            idx.ntotal,
        )

        return None

    except Exception as exc:
        return f"Failed to load FAISS index: {exc}"


def _torch_cuda_available() -> bool:
    """Return True if CUDA is available."""

    try:
        import torch

        return torch.cuda.is_available()

    except ImportError:
        return False


# ============================================================================
# Hugging Face LLM
# ============================================================================

def _load_llm(settings) -> str | None:
    """
    Initialise Hugging Face InferenceClient.

    IMPORTANT:
    The old implementation downloaded Qwen2.5 locally and loaded the model
    into Railway RAM.

    This implementation does NOT download model weights.

    It only creates a lightweight client. Actual generation happens through
    Hugging Face Inference Providers.
    """

    global _llm_client

    try:
        from huggingface_hub import InferenceClient

    except ImportError as exc:
        return (
            "huggingface_hub is not installed. "
            "Add 'huggingface_hub' to requirements.txt."
        )

    hf_token = os.getenv("HF_TOKEN")

    if not hf_token:
        return "HF_TOKEN environment variable is missing."

    # Use the project's existing Qwen 3B target.
    # The model is executed remotely through Hugging Face.
    model_name = "Qwen/Qwen2.5-3B-Instruct"

    try:
        _llm_client = InferenceClient(
            model=model_name,
            token=hf_token,
            provider="auto",
        )

        logger.info(
            "[LLM] Hugging Face Inference Providers configured: %s",
            model_name,
        )

        return None

    except Exception as exc:
        _llm_client = None

        return (
            f"Failed to initialise Hugging Face LLM client: {exc}"
        )


# ============================================================================
# Translation
# ============================================================================

def _load_translation(settings) -> None:
    """
    Attempt to load IndicTrans2.

    Failure is non-fatal.
    """

    global _translation_ready
    global _ip
    global _src2en_tok
    global _src2en_model
    global _en2tgt_tok
    global _en2tgt_model

    if not settings.nlp_translation_enabled:
        logger.info(
            "[TRANSLATION] Disabled by configuration."
        )
        return

    try:
        import torch

        from transformers import (
            AutoModelForSeq2SeqLM,
            AutoTokenizer,
        )

        from IndicTransToolkit.processor import IndicProcessor

        gpu = _torch_cuda_available()

        dtype = torch.float16 if gpu else torch.float32
        device = "cuda" if gpu else "cpu"

        ip = IndicProcessor(inference=True)

        s2e_name = settings.nlp_translation_src_to_en_model
        e2t_name = settings.nlp_translation_en_to_tgt_model

        logger.info(
            "[TRANSLATION] Loading source→English model: %s",
            s2e_name,
        )

        s2e_tok = AutoTokenizer.from_pretrained(
            s2e_name,
            trust_remote_code=True,
        )

        s2e_model = AutoModelForSeq2SeqLM.from_pretrained(
            s2e_name,
            trust_remote_code=True,
            torch_dtype=dtype,
        ).to(device)

        logger.info(
            "[TRANSLATION] Loading English→target model: %s",
            e2t_name,
        )

        e2t_tok = AutoTokenizer.from_pretrained(
            e2t_name,
            trust_remote_code=True,
        )

        e2t_model = AutoModelForSeq2SeqLM.from_pretrained(
            e2t_name,
            trust_remote_code=True,
            torch_dtype=dtype,
        ).to(device)

        _ip = ip

        _src2en_tok = s2e_tok
        _src2en_model = s2e_model

        _en2tgt_tok = e2t_tok
        _en2tgt_model = e2t_model

        _translation_ready = True

        logger.info(
            "[TRANSLATION] IndicTrans2 loaded successfully."
        )

    except Exception as exc:

        _translation_ready = False

        logger.warning(
            "[TRANSLATION] Disabled — could not load IndicTrans2: %s",
            exc,
        )


# ============================================================================
# Main initialisation
# ============================================================================

def initialize(settings) -> dict[str, str]:
    """
    Eagerly load all NLP components.

    BGE-M3, FAISS and KB are local.
    LLM uses Hugging Face Inference Providers.
    """

    global _initialized
    global _init_error

    with _lock:

        if _initialized:
            return get_status()

        statuses: dict[str, str] = {}

        # ------------------------------------------------------------
        # KB
        # ------------------------------------------------------------

        err = _load_kb_access_layer(settings)

        statuses["kb_access"] = (
            "ok"
            if err is None
            else f"ERROR: {err}"
        )

        # ------------------------------------------------------------
        # Embeddings
        # ------------------------------------------------------------

        err = _load_embedding_model(settings)

        statuses["embedding_model"] = (
            "ok"
            if err is None
            else f"ERROR: {err}"
        )

        # ------------------------------------------------------------
        # FAISS
        # ------------------------------------------------------------

        err = _load_faiss_index(settings)

        statuses["faiss_index"] = (
            "ok"
            if err is None
            else f"ERROR: {err}"
        )

        # ------------------------------------------------------------
        # LLM
        # ------------------------------------------------------------

        err = _load_llm(settings)

        statuses["llm"] = (
            "ok"
            if err is None
            else f"ERROR: {err}"
        )

        # ------------------------------------------------------------
        # Translation
        # ------------------------------------------------------------

        _load_translation(settings)

        statuses["translation"] = (
            "ok"
            if _translation_ready
            else "disabled/unavailable"
        )

        # ------------------------------------------------------------
        # Final state
        # ------------------------------------------------------------

        _initialized = True

        _init_error = (
            None
            if all(
                not value.startswith("ERROR:")
                for value in statuses.values()
            )
            else "One or more NLP components failed."
        )

        logger.info(
            "[NLP] Initialisation complete. Statuses: %s",
            statuses,
        )

        return statuses


def get_status() -> dict[str, str]:
    """Return current NLP component status."""

    return {
        "kb_access": (
            "ok"
            if _kb_file_handle is not None
            else "not loaded"
        ),
        "embedding_model": (
            "ok"
            if _embed_model is not None
            else "not loaded"
        ),
        "faiss_index": (
            "ok"
            if _faiss_index is not None
            else "not loaded"
        ),
        "llm": (
            "ok"
            if _llm_client is not None
            else "not loaded"
        ),
        "translation": (
            "ok"
            if _translation_ready
            else "disabled/unavailable"
        ),
        "total_records": _n_total_records,
    }


# ============================================================================
# Record access
# Section 11 logic
# ============================================================================

def get_record(record_id: int) -> dict:
    """Read a single KB record using O(1) offset lookup."""

    if (
        _offset_index is None
        or _kb_file_handle is None
    ):
        raise RuntimeError(
            "KB access layer not initialised."
        )

    if (
        record_id < 0
        or record_id >= _n_total_records
    ):
        raise IndexError(
            f"record_id {record_id} out of range "
            f"[0, {_n_total_records})"
        )

    _kb_file_handle.seek(
        int(_offset_index[record_id])
    )

    return json.loads(
        _kb_file_handle.readline()
    )


# ============================================================================
# Retrieval
# Section 21 logic
# ============================================================================

def retrieve(
    query: str,
    top_k: int,
    settings,
) -> list[dict]:
    """Embed query and retrieve records from FAISS."""

    if _embed_model is None:
        raise RuntimeError(
            "Embedding model not loaded."
        )

    if _faiss_index is None:
        raise RuntimeError(
            "FAISS index not loaded. "
            "Build it by running SECTIONS 17-19 "
            "of the NLP notebook."
        )

    q_emb = _embed_model.encode(
        [query],
        normalize_embeddings=(
            settings.nlp_embedding_normalize
        ),
        convert_to_numpy=True,
    )

    q_emb = np.ascontiguousarray(
        q_emb,
        dtype=np.float32,
    )

    D, I = _faiss_index.search(
        q_emb,
        top_k,
    )

    results = []

    for score, idx in zip(D[0], I[0]):

        if idx == -1:
            continue

        rec = get_record(int(idx))

        results.append(
            {
                "record_id": rec["record_id"],
                "question": rec["question"],
                "answer": rec["answer"],
                "source_dataset": rec.get(
                    "source_dataset"
                ),
                "score": round(
                    float(score),
                    4,
                ),
            }
        )

    results.sort(
        key=lambda r: r["score"],
        reverse=True,
    )

    return results


# ============================================================================
# Translation helpers
# Section 14b logic
# ============================================================================

def _translate(
    text: str,
    direction: str,
    settings,
) -> str:
    """
    Translate text.

    direction:
        'src2en'
        'en2tgt'
    """

    if not _translation_ready:
        raise RuntimeError(
            "Translation is not available."
        )

    import torch

    if direction == "src2en":

        tok = _src2en_tok
        model = _src2en_model

        src = settings.nlp_translation_src_lang
        tgt = settings.nlp_translation_tgt_lang

    else:

        tok = _en2tgt_tok
        model = _en2tgt_model

        src = settings.nlp_translation_tgt_lang
        tgt = settings.nlp_translation_src_lang

    batch = _ip.preprocess_batch(
        [text],
        src_lang=src,
        tgt_lang=tgt,
    )

    inputs = tok(
        batch,
        padding=True,
        truncation=True,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():

        out = model.generate(
            **inputs,
            max_new_tokens=256,
            num_beams=5,
        )

    decoded = tok.batch_decode(
        out,
        skip_special_tokens=True,
    )

    return _ip.postprocess_batch(
        decoded,
        lang=tgt,
    )[0]


# ============================================================================
# Generation helpers
# Section 24 logic
# ============================================================================

def _format_records_for_llm(
    records: list[dict],
) -> str:
    """Format retrieved KB records for the LLM."""

    return "\n\n".join(
        (
            f"[RECORD {i}]\n"
            f"Question: {r['question']}\n"
            f"Answer: {r['answer']}"
        )
        for i, r in enumerate(records, 1)
    )


def _is_low_confidence(
    records: list[dict],
    min_score: float,
) -> bool:
    """Return True when retrieval evidence is insufficient."""

    return (
        not records
        or records[0]["score"] < min_score
    )


def _generate_answer(
    question: str,
    records: list[dict],
    settings,
) -> tuple[str, bool]:
    """
    Generate answer through Hugging Face Inference Providers.

    Returns:
        (answer_text, refused)
    """

    if _llm_client is None:
        raise RuntimeError(
            "LLM client not loaded."
        )

    # ------------------------------------------------------------
    # Refusal path
    # ------------------------------------------------------------

    if _is_low_confidence(
        records,
        settings.nlp_retrieval_min_score,
    ):
        return _REFUSAL_MESSAGE, True

    # ------------------------------------------------------------
    # Build context
    # ------------------------------------------------------------

    context = _format_records_for_llm(
        records
    )

    user_msg = (
        f"FARMER QUESTION:\n"
        f"{question}\n\n"
        f"RETRIEVED AGRICULTURAL INFORMATION:\n"
        f"{context}\n\n"
        "Write a single synthesized, farmer-friendly "
        "answer following the system rules."
    )

    messages = [
        {
            "role": "system",
            "content": _SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": user_msg,
        },
    ]

    # ------------------------------------------------------------
    # Remote LLM call
    # ------------------------------------------------------------

    try:

        completion = (
            _llm_client.chat.completions.create(
                messages=messages,
                max_tokens=(
                    settings.nlp_llm_max_new_tokens
                ),
                temperature=(
                    settings.nlp_llm_temperature
                ),
                top_p=(
                    settings.nlp_llm_top_p
                ),
            )
        )

        if not completion.choices:
            logger.warning(
                "[LLM] Hugging Face returned no choices."
            )

            return _REFUSAL_MESSAGE, True

        message = completion.choices[0].message

        text = message.content

        if not text:
            logger.warning(
                "[LLM] Hugging Face returned empty content."
            )

            return _REFUSAL_MESSAGE, True

        return text.strip(), False

    except Exception as exc:

        logger.exception(
            "[LLM] Hugging Face inference failed: %s",
            exc,
        )

        raise RuntimeError(
            f"Hugging Face LLM inference failed: {exc}"
        ) from exc


# ============================================================================
# Full pipeline
# Section 25 logic
# ============================================================================

def run_pipeline(
    question: str,
    settings,
    top_k: int | None = None,
    translate_from_kannada: bool = False,
) -> dict[str, Any]:
    """
    Full RAG pipeline.

    Returns:
        question,
        working_question_en,
        retrieved_records,
        refused,
        answer,
        translation_used,
        timings
    """

    timings: dict[str, float] = {}

    t_total = time.time()

    top_k = (
        top_k
        or settings.nlp_retrieval_top_k
    )

    working_question = question

    # ------------------------------------------------------------
    # Kannada → English
    # ------------------------------------------------------------

    if (
        translate_from_kannada
        and _translation_ready
    ):

        t0 = time.time()

        working_question = _translate(
            question,
            "src2en",
            settings,
        )

        timings["translation_in_s"] = round(
            time.time() - t0,
            3,
        )

    # ------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------

    t0 = time.time()

    records = retrieve(
        working_question,
        top_k=top_k,
        settings=settings,
    )

    timings["retrieval_s"] = round(
        time.time() - t0,
        3,
    )

    # ------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------

    t0 = time.time()

    answer_en, refused = _generate_answer(
        working_question,
        records,
        settings,
    )

    timings["generation_s"] = round(
        time.time() - t0,
        3,
    )

    final_answer = answer_en

    # ------------------------------------------------------------
    # English → Kannada
    # ------------------------------------------------------------

    if (
        translate_from_kannada
        and _translation_ready
        and not refused
    ):

        t0 = time.time()

        final_answer = _translate(
            answer_en,
            "en2tgt",
            settings,
        )

        timings["translation_out_s"] = round(
            time.time() - t0,
            3,
        )

    # ------------------------------------------------------------
    # Total time
    # ------------------------------------------------------------

    timings["total_s"] = round(
        time.time() - t_total,
        3,
    )

    return {
        "question": question,
        "working_question_en": working_question,
        "retrieved_records": records,
        "refused": refused,
        "answer": final_answer,
        "translation_used": (
            translate_from_kannada
            and _translation_ready
        ),
        "timings": timings,
    }
