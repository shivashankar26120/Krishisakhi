"""
Krishi Sakhi — Backend Configuration
All paths are resolved relative to the project root (two levels above backend/).
Override any value by setting the corresponding environment variable.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Resolve project root (krishisakhi/)
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent   # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent                             # krishisakhi/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # App
    # ------------------------------------------------------------------
    app_title: str = "Krishi Sakhi API"
    app_version: str = "0.1.0"
    debug: bool = False

    # ------------------------------------------------------------------
    # Disease Detection
    # ------------------------------------------------------------------
    disease_model_path: Path = _PROJECT_ROOT / "disease_detection" / "models" / "final_model.keras"
    disease_label_map_path: Path = _PROJECT_ROOT / "disease_detection" / "models" / "label_map.json"
    disease_img_size: int = 224
    disease_confidence_threshold: float = 0.55
    disease_gradcam_layer: str = "top_conv"

    # ------------------------------------------------------------------
    # NLP / RAG
    # ------------------------------------------------------------------
    nlp_kb_path: Path = _PROJECT_ROOT / "nlp" / "final_knowledge_base.jsonl"
    nlp_offset_index_path: Path = _PROJECT_ROOT / "nlp" / "offset_index.npy"
    nlp_provenance_stats_path: Path = _PROJECT_ROOT / "nlp" / "provenance_stats.json"

    # FAISS index filename matching the saved notebook artifact
    nlp_faiss_index_path: Path = _PROJECT_ROOT / "nlp" / "kb.index"

    # Embedding model (public HuggingFace model)
    nlp_embedding_model: str = "BAAI/bge-m3"
    nlp_embedding_normalize: bool = True
    nlp_embedding_max_seq_length: int = 512

    # FAISS retrieval
    nlp_retrieval_top_k: int = 5
    nlp_retrieval_min_score: float = 0.35   # below this → refusal

    # LLM candidate chain (tried in order; first that loads successfully is used)
    # Overridable as a comma-separated list of "name:require_4bit:min_tok_per_sec"
    nlp_llm_candidate_models: str = (
        "Qwen/Qwen2.5-7B-Instruct:true:8,"
        "Qwen/Qwen2.5-3B-Instruct:false:5,"
        "Qwen/Qwen2.5-1.5B-Instruct:false:0"
    )
    nlp_llm_max_new_tokens: int = 400
    nlp_llm_temperature: float = 0.3
    nlp_llm_top_p: float = 0.9
    nlp_llm_context_length: int = 4096

    # Translation (IndicTrans2 — public HuggingFace models)
    nlp_translation_enabled: bool = True
    nlp_translation_src_to_en_model: str = "ai4bharat/indictrans2-indic-en-dist-200M"
    nlp_translation_en_to_tgt_model: str = "ai4bharat/indictrans2-en-indic-dist-200M"
    nlp_translation_src_lang: str = "kan_Knda"
    nlp_translation_tgt_lang: str = "eng_Latn"

    # ------------------------------------------------------------------
    # Voice — STT (Whisper)
    # ------------------------------------------------------------------
    # "Whisper Small" as specified in the project architecture.
    # Override with WHISPER_MODEL_ID env var if a different variant is needed.
    whisper_model_id: str = "openai/whisper-small"
    whisper_language: str = "kn"       # Kannada BCP-47 code

    # ------------------------------------------------------------------
    # Voice — TTS (Piper)
    # ------------------------------------------------------------------
    # piper-tts pip package installs the binary; auto-detected via shutil.which('piper').
    # Voice model is auto-downloaded from HuggingFace (rhasspy/piper-voices) at startup.
    # On Railway: set PIPER_VOICE_DIR to a persistent volume mount (e.g. /data/tts).
    # PIPER_EXECUTABLE_PATH: override only if pip-installed binary is not found in PATH.
    piper_executable_path: Path = _PROJECT_ROOT / "tts" / "piper"
    piper_voice_model_path: Path = _PROJECT_ROOT / "tts" / "kn_IN-female-medium.onnx"
    piper_voice_config_path: Path = _PROJECT_ROOT / "tts" / "kn_IN-female-medium.onnx.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
