"""
Disease detection service — wraps the notebook's CELL 17 standalone inference utility.

Notebook source of truth:
    - CELL 12: predict_single_image (preprocessing + softmax)
    - CELL 14: GradCAM class (see gradcam_service.py)
    - CELL 15: predict_with_confidence_gate (status + message)
    - CELL 17: load_inference_pipeline / diagnose  ← primary entrypoint

Pipeline:
    image bytes
    → PIL resize to (224, 224)
    → EfficientNet preprocess_input
    → model.predict
    → argmax + top-5
    → confidence gate (threshold 0.55)
    → Grad-CAM heatmap + overlay
    → structured dict

Model is loaded once per process (singleton pattern).
"""
from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton state (lazy-loaded, thread-safe)
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_model = None
_class_names: list[str] | None = None
_gradcam = None          # GradCAM instance
_load_error: str | None = None


def _load_pipeline(settings) -> None:
    """Load model + label map + GradCAM once. Must be called under _lock."""
    global _model, _class_names, _gradcam, _load_error

    try:
        import tensorflow as tf
        from tensorflow.keras.applications.efficientnet import preprocess_input  # noqa: F401 — validates import
    except ImportError as exc:
        _load_error = f"TensorFlow is not installed: {exc}"
        return

    model_path: Path = settings.disease_model_path
    label_map_path: Path = settings.disease_label_map_path

    if not model_path.exists():
        _load_error = f"Disease model not found: {model_path}"
        return
    if not label_map_path.exists():
        _load_error = f"Label map not found: {label_map_path}"
        return

    logger.info("Loading disease model from %s …", model_path)
    loaded_model = tf.keras.models.load_model(str(model_path), compile=False)

    with open(label_map_path, encoding="utf-8") as f:
        raw_map = json.load(f)
    label_map = {int(k): v for k, v in raw_map.items()}
    class_names = [label_map[i] for i in range(len(label_map))]

    from app.services.gradcam_service import GradCAM

    gradcam = GradCAM(loaded_model, layer_name=settings.disease_gradcam_layer)

    _model = loaded_model
    _class_names = class_names
    _gradcam = gradcam
    logger.info(
        "Disease model ready. Classes: %d, Grad-CAM layer: %s",
        len(class_names),
        settings.disease_gradcam_layer,
    )


def _ensure_loaded(settings) -> None:
    """Thread-safe lazy initialisation."""
    global _load_error
    if _model is not None:
        return
    with _lock:
        if _model is not None:
            return
        _load_pipeline(settings)
    if _load_error:
        raise RuntimeError(_load_error)


# ---------------------------------------------------------------------------
# Public inference function
# ---------------------------------------------------------------------------

def diagnose_image(
    image_bytes: bytes,
    settings,
    with_gradcam: bool = True,
) -> dict[str, Any]:
    """
    Run end-to-end disease diagnosis on raw image bytes.

    Mirrors notebook CELL 17 `diagnose()`, adapted for API use:
      - Returns serialisable dict (no numpy arrays in the final output)
      - gradcam_overlay returned as base64-encoded PNG string
      - gradcam_heatmap_b64 is the raw [0,1] heatmap, also base64 PNG

    Raises RuntimeError if model artifacts are missing.
    Raises ValueError  if image bytes are invalid.
    """
    _ensure_loaded(settings)

    from tensorflow.keras.applications.efficientnet import preprocess_input
    from app.services.gradcam_service import encode_overlay_to_base64

    img_size: int = settings.disease_img_size
    threshold: float = settings.disease_confidence_threshold

    # --- Decode image ---
    try:
        import io as _io
        pil_img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        orig_img = np.array(pil_img.resize((img_size, img_size)))
    except Exception as exc:
        raise ValueError(f"Invalid image data: {exc}") from exc

    # --- Preprocess (notebook: EfficientNet preprocess_input) ---
    img_batch = preprocess_input(np.expand_dims(orig_img.astype("float32"), axis=0))

    # --- Inference ---
    preds = _model.predict(img_batch, verbose=0)[0]
    top_idx = int(np.argmax(preds))
    confidence = float(preds[top_idx])

    top5_idx = np.argsort(preds)[-5:][::-1]
    top5 = [
        {"class": _class_names[i], "confidence": round(float(preds[i]), 4)}
        for i in top5_idx
    ]

    # --- Confidence gate (notebook CELL 15 logic) ---
    status = "confident" if confidence >= threshold else "uncertain"
    if status == "uncertain":
        message = (
            f"Confidence too low ({confidence:.1%}). Please retake the photo "
            f"with better lighting and a closer, clearer view of the leaf."
        )
    else:
        message = f"{_class_names[top_idx]} ({confidence:.1%} confidence)"

    result: dict[str, Any] = {
        "status": status,
        "predicted_class": _class_names[top_idx],
        "confidence": round(confidence, 4),
        "message": message,
        "top5": top5,
        "gradcam_overlay_b64": None,
        "gradcam_heatmap_b64": None,
    }

    # --- Grad-CAM (notebook CELL 14 logic) ---
    if with_gradcam:
        try:
            import io as _io
            heatmap, _ = _gradcam.compute_heatmap(img_batch, class_idx=top_idx)
            overlay = _gradcam.overlay(heatmap, orig_img)
            result["gradcam_overlay_b64"] = encode_overlay_to_base64(overlay)

            # Raw heatmap as grayscale PNG
            import base64
            hm_uint8 = np.uint8(255 * heatmap)
            hm_pil = Image.fromarray(hm_uint8, mode="L")
            hm_buf = _io.BytesIO()
            hm_pil.save(hm_buf, format="PNG")
            result["gradcam_heatmap_b64"] = base64.b64encode(hm_buf.getvalue()).decode()
        except Exception as exc:
            logger.warning("Grad-CAM failed (non-fatal): %s", exc)
            result["gradcam_error"] = str(exc)

    return result
