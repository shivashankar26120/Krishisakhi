"""
POST /api/voice/transcribe  — Whisper STT (audio → Kannada text)
POST /api/voice/synthesize  — Piper TTS  (Kannada text → WAV audio)
GET  /api/voice/status      — Reports STT and TTS readiness
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.core.config import Settings, get_settings
from app.schemas.voice import TranscribeResponse, VoicePipelineStatus, SynthesizeRequest
from app.services import stt_service, tts_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["Voice"])

_MAX_AUDIO_BYTES = 50 * 1024 * 1024   # 50 MB
_ACCEPTED_AUDIO_TYPES = {
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3",
    "audio/ogg", "audio/webm",
    "audio/flac", "audio/x-flac",
    "application/octet-stream",   # some clients send raw bytes
}


@router.post(
    "/transcribe",
    response_model=TranscribeResponse,
    summary="Transcribe Kannada audio to text (Whisper STT)",
    description=(
        "Upload a WAV/MP3/OGG audio file containing Kannada speech. "
        "Returns the transcribed Kannada text. "
        "Powered by Whisper Small."
    ),
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file (WAV / MP3 / OGG)."),
    settings: Settings = Depends(get_settings),
) -> TranscribeResponse:

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 50 MB).")

    try:
        result = stt_service.transcribe(audio_bytes=audio_bytes, settings=settings)
    except RuntimeError as exc:
        logger.error("STT service unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return TranscribeResponse(
        text=result["text"],
        language=result["language"],
        model=result["model"],
    )


@router.post(
    "/synthesize",
    summary="Synthesize Kannada speech from text (Piper TTS)",
    description=(
        "Convert Kannada text to audio. "
        "Returns raw WAV audio (audio/wav). "
        "Requires Piper binary and voice model to be present on the server."
    ),
    responses={
        200: {
            "content": {"audio/wav": {}},
            "description": "WAV audio bytes.",
        },
        503: {
            "description": "Piper TTS artifacts are missing.",
        },
    },
)
async def synthesize_speech(
    request: SynthesizeRequest,
    settings: Settings = Depends(get_settings),
) -> Response:

    try:
        wav_bytes = tts_service.synthesize(text=request.text, settings=settings)
    except RuntimeError as exc:
        # Piper artifacts missing — 503 with clear explanation
        logger.error("TTS service unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=krishi_sakhi_response.wav"},
    )


@router.get(
    "/status",
    response_model=VoicePipelineStatus,
    summary="Voice pipeline readiness",
    description="Reports STT (Whisper) configuration and TTS (Piper) artifact availability.",
)
async def voice_status(settings: Settings = Depends(get_settings)) -> VoicePipelineStatus:
    tts_status = tts_service.get_status(settings)
    return VoicePipelineStatus(
        stt_model=settings.whisper_model_id,
        stt_language=settings.whisper_language,
        tts_available=tts_status["available"],
        tts_missing_artifacts=tts_status["missing_artifacts"],
    )
