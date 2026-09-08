"""
Text-to-Speech service using Piper TTS.

Architecture: "Piper — Kannada text → audio"

Railway deployment approach:
  - `piper-tts` pip package installs the piper binary into the Python env PATH.
  - Kannada voice model is auto-downloaded from HuggingFace at startup if absent.
  - HF_TOKEN env var is used if set (for private repos); public piper-voices needs no auth.

Voice: kn_IN-female-medium  (rhasspy/piper-voices)
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# HuggingFace repo and file paths for the Kannada voice
_HF_REPO  = "rhasspy/piper-voices"
_HF_ONNX  = "kn/kn_IN/female/medium/kn_IN-female-medium.onnx"
_HF_JSON  = "kn/kn_IN/female/medium/kn_IN-female-medium.onnx.json"


def _ensure_voice_model(settings) -> list[str]:
    """
    Download Kannada voice model from HuggingFace if not already on disk.
    Returns list of error strings (empty = all good).
    """
    errors: list[str] = []

    for local_path, hf_path in [
        (settings.piper_voice_model_path, _HF_ONNX),
        (settings.piper_voice_config_path, _HF_JSON),
    ]:
        if Path(local_path).exists():
            continue
        try:
            from huggingface_hub import hf_hub_download
            import os
            # Strip whitespace/newlines — Railway env vars can carry a trailing \n
            # which causes "Invalid leading whitespace" in HTTP Bearer headers.
            raw_token = os.environ.get("HF_TOKEN") or ""
            hf_token = raw_token.strip() or None
            downloaded = hf_hub_download(
                repo_id=_HF_REPO,
                filename=hf_path,
                local_dir=Path(local_path).parent,
                local_dir_use_symlinks=False,
                token=hf_token,
            )
            # hf_hub_download saves with the original filename; rename to expected name
            src = Path(downloaded)
            dst = Path(local_path)
            if src.resolve() != dst.resolve():
                src.rename(dst)
            logger.info("Downloaded Piper voice artifact: %s", dst)
        except Exception as exc:
            errors.append(f"Failed to download {hf_path}: {exc}")

    return errors


def _find_piper_binary(settings) -> Path | None:
    """
    Locate the piper binary.
    Priority: PIPER_EXECUTABLE_PATH env var → config default path → shutil.which('piper').
    """
    configured = Path(settings.piper_executable_path)
    if configured.exists():
        return configured

    # piper-tts pip package installs the binary into the Python env PATH
    which = shutil.which("piper")
    if which:
        return Path(which)

    return None


def _check_artifacts(settings) -> list[str]:
    missing = []
    if _find_piper_binary(settings) is None:
        missing.append("Piper binary not found (install piper-tts via pip or set PIPER_EXECUTABLE_PATH)")
    if not Path(settings.piper_voice_model_path).exists():
        missing.append(f"Piper voice model (.onnx): {settings.piper_voice_model_path}")
    if not Path(settings.piper_voice_config_path).exists():
        missing.append(f"Piper voice config (.onnx.json): {settings.piper_voice_config_path}")
    return missing


def ensure_ready(settings) -> list[str]:
    """
    Called at application startup.
    Downloads missing voice artifacts from HuggingFace.
    Returns list of remaining errors after attempting download.
    """
    # Ensure the TTS model directory exists
    Path(settings.piper_voice_model_path).parent.mkdir(parents=True, exist_ok=True)

    download_errors = _ensure_voice_model(settings)
    if download_errors:
        for e in download_errors:
            logger.warning("Piper TTS setup: %s", e)

    return _check_artifacts(settings)


def get_status(settings) -> dict[str, Any]:
    missing = _check_artifacts(settings)
    binary = _find_piper_binary(settings)
    return {
        "available": len(missing) == 0,
        "missing_artifacts": missing,
        "executable": str(binary) if binary else "NOT FOUND",
        "voice_model": str(settings.piper_voice_model_path),
        "voice_config": str(settings.piper_voice_config_path),
    }


def synthesize(text: str, settings) -> bytes:
    """
    Synthesize text to WAV audio bytes using Piper.
    Returns raw WAV bytes on success.
    Raises RuntimeError if artifacts are missing.
    Raises ValueError if synthesis subprocess fails.
    """
    missing = _check_artifacts(settings)
    if missing:
        raise RuntimeError(
            "Piper TTS not ready. Missing:\n" + "\n".join(f"  - {m}" for m in missing)
        )

    binary = _find_piper_binary(settings)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_f:
        out_path = Path(out_f.name)

    try:
        cmd = [
            str(binary),
            "--model",  str(settings.piper_voice_model_path),
            "--config", str(settings.piper_voice_config_path),
            "--output_file", str(out_path),
        ]
        proc = subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=60,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")
            raise ValueError(f"Piper synthesis failed (exit {proc.returncode}): {err}")

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise ValueError("Piper produced empty or missing output file.")

        return out_path.read_bytes()

    finally:
        out_path.unlink(missing_ok=True)
