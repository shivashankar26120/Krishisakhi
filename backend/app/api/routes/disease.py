"""
POST /api/disease/predict

Accepts a plant-leaf image, runs the EfficientNet-B0 disease pipeline,
and returns prediction + Grad-CAM overlay.

Request  : multipart/form-data
  - file        : image file (JPEG/PNG/WebP)
  - with_gradcam: bool (default true)

Response : DiseaseResponse JSON
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.config import Settings, get_settings
from app.schemas.disease import DiseaseResponse
from app.services import disease_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/disease", tags=["Disease Detection"])

_ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
_MAX_BYTES = 20 * 1024 * 1024   # 20 MB guard


@router.post(
    "/predict",
    response_model=DiseaseResponse,
    summary="Diagnose plant leaf disease",
    description=(
        "Upload a plant leaf image. Returns the predicted disease class, "
        "confidence, top-5 predictions, and a Grad-CAM explainability overlay."
    ),
)
async def predict_disease(
    file: UploadFile = File(..., description="Plant leaf image (JPEG / PNG / WebP)."),
    with_gradcam: bool = Form(default=True, description="Include Grad-CAM overlay in response."),
    settings: Settings = Depends(get_settings),
) -> DiseaseResponse:

    # Content-type check (best-effort; not a security gate)
    if file.content_type and file.content_type.lower() not in _ACCEPTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported content type: {file.content_type}. "
                f"Accepted: {sorted(_ACCEPTED_CONTENT_TYPES)}"
            ),
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=413, detail=f"File too large (max {_MAX_BYTES // 1024 // 1024} MB)."
        )

    try:
        result = disease_service.diagnose_image(
            image_bytes=image_bytes,
            settings=settings,
            with_gradcam=with_gradcam,
        )
    except RuntimeError as exc:
        # Model or artifact missing — 503 so the frontend knows to retry later
        logger.error("Disease service unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except ValueError as exc:
        # Bad image
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    # Map flat dict to response model (alias "class" → "class_")
    top5_mapped = [{"class": t["class"], "confidence": t["confidence"]} for t in result["top5"]]
    return DiseaseResponse(
        status=result["status"],
        predicted_class=result["predicted_class"],
        confidence=result["confidence"],
        message=result["message"],
        top5=[{"class": t["class"], "confidence": t["confidence"]} for t in result["top5"]],
        gradcam_overlay_b64=result.get("gradcam_overlay_b64"),
        gradcam_heatmap_b64=result.get("gradcam_heatmap_b64"),
        gradcam_error=result.get("gradcam_error"),
    )
