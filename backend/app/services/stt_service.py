"""
Speech-to-Text service using Whisper.

Architecture declaration: "Whisper Small — Speech-to-Text — Kannada audio → text"
Model identifier is configurable via WHISPER_MODEL_ID env var.
Default: "openai/whisper-small" (as declared in the project architecture).

Uses Hugging Face transformers pipeline for clean API encapsulation.
Model is lazy-loaded on first request (large weights not downloaded at import time).
"""
from __future__ import annotations

import logging
import tempfile
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_pipeline = None
_load_error: str | None = None


def _load_whisper(settings) -> None:
    global _pipeline, _load_error
    try:
        from transformers import pipeline as hf_pipeline
        import torch

        device = 0 if _torch_cuda_available() else -1   # 0=first GPU, -1=CPU
        logger.info("[STT] Loading Whisper model %s …", settings.whisper_model_id)
        _pipeline = hf_pipeline(
            "automatic-speech-recognition",
            model=settings.whisper_model_id,
            device=device,
        )
        logger.info("[STT] Whisper model ready.")
    except ImportError as exc:
        _load_error = f"transformers not installed: {exc}"
    except Exception as exc:
        _load_error = f"Failed to load Whisper ({settings.whisper_model_id}): {exc}"


def _torch_cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _ensure_loaded(settings) -> None:
    global _load_error
    if _pipeline is not None:
        return
    with _lock:
        if _pipeline is not None:
            return
        _load_whisper(settings)
    if _load_error:
        raise RuntimeError(_load_error)


def transcribe(audio_bytes: bytes, settings) -> dict:
    """
    Transcribe raw audio bytes to Kannada text.

    Returns:
        {
          "text": str,           # transcribed Kannada text
          "language": str,       # language code used
          "model": str,          # model identifier
        }

    Raises RuntimeError if Whisper model is unavailable.
    Raises ValueError  if audio data is invalid.
    """
    _ensure_loaded(settings)

    # Write to a temp file — Whisper pipeline accepts file paths
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
    except Exception as exc:
        raise ValueError(f"Failed to write audio to temp file: {exc}") from exc

    try:
        result = _pipeline(
            tmp_path,
            generate_kwargs={"language": settings.whisper_language, "task": "transcribe"},
        )
    except Exception as exc:
        raise ValueError(f"Whisper transcription failed: {exc}") from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "text": result.get("text", "").strip(),
        "language": settings.whisper_language,
        "model": settings.whisper_model_id,
    }
