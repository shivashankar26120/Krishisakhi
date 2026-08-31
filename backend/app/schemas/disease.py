"""Request and response schemas for the disease detection API."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class Top5Entry(BaseModel):
    class_: str = Field(alias="class")
    confidence: float

    model_config = {"populate_by_name": True}


class DiseaseResponse(BaseModel):
    status: str = Field(
        description="'confident' if confidence ≥ threshold, else 'uncertain'."
    )
    predicted_class: str
    confidence: float
    message: str
    top5: list[Top5Entry]
    gradcam_overlay_b64: Optional[str] = Field(
        default=None,
        description=(
            "Base64-encoded PNG of the Grad-CAM overlay (original + heatmap). "
            "Null if with_gradcam=false or if Grad-CAM failed."
        ),
    )
    gradcam_heatmap_b64: Optional[str] = Field(
        default=None,
        description="Base64-encoded grayscale PNG of the raw Grad-CAM heatmap [0,1].",
    )
    gradcam_error: Optional[str] = Field(
        default=None,
        description="Error message if Grad-CAM failed (non-fatal).",
    )
