"""Request and response schemas for voice (STT and TTS) APIs."""
from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# STT
# ---------------------------------------------------------------------------

class TranscribeResponse(BaseModel):
    text: str = Field(description="Transcribed text (Kannada).")
    language: str = Field(description="Language code used for transcription.")
    model: str = Field(description="Whisper model identifier used.")


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------

class SynthesizeRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Kannada text to synthesize.",
    )


class SynthesizeStatusResponse(BaseModel):
    """Returned when synthesis cannot proceed due to missing artifacts."""
    error: str
    missing_artifacts: list[str]


# ---------------------------------------------------------------------------
# Voice pipeline status
# ---------------------------------------------------------------------------

class VoicePipelineStatus(BaseModel):
    stt_model: str
    stt_language: str
    tts_available: bool
    tts_missing_artifacts: list[str]
