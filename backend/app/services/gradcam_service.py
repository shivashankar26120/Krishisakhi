"""
Grad-CAM service — extracted from the disease detection notebook (CELL 14).

Implements the exact GradCAM class and overlay logic from the notebook:
- Target layer: "top_conv"  (EfficientNet-B0 top convolutional layer)
- Inner product gradient pooling
- ReLU + min-max normalisation
- JET colormap overlay (alpha=0.4)
"""
from __future__ import annotations

import base64
import io
from typing import Tuple

import cv2
import numpy as np


class GradCAM:
    """
    Gradient-weighted Class Activation Mapping.

    Faithfully reproduced from CELL 14 of the disease detection notebook.
    The grad_model is built once at construction time and reused for every
    inference call.
    """

    def __init__(self, model, layer_name: str = "top_conv"):
        import tensorflow as tf  # deferred — imported after TF is ready

        self._tf = tf
        self.grad_model = tf.keras.Model(
            inputs=model.inputs,
            outputs=[model.get_layer(layer_name).output, model.output],
        )

    def compute_heatmap(
        self,
        img_batch,
        class_idx: int | None = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Returns (heatmap, predictions_array).
        heatmap values are in [0, 1].
        """
        tf = self._tf
        with tf.GradientTape() as tape:
            conv_outputs, predictions = self.grad_model(img_batch)
            if class_idx is None:
                class_idx = int(tf.argmax(predictions[0]))
            loss = predictions[:, class_idx]

        grads = tape.gradient(loss, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs_0 = conv_outputs[0]

        heatmap = conv_outputs_0 @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.nn.relu(heatmap)
        heatmap = (heatmap - tf.reduce_min(heatmap)) / (
            tf.reduce_max(heatmap) - tf.reduce_min(heatmap) + 1e-8
        )
        return heatmap.numpy(), predictions.numpy()[0]

    def overlay(
        self,
        heatmap: np.ndarray,
        original_img_uint8: np.ndarray,
        alpha: float = 0.4,
    ) -> np.ndarray:
        """Returns RGB uint8 overlay array."""
        H, W = original_img_uint8.shape[:2]
        heatmap_resized = cv2.resize(heatmap, (W, H))
        heatmap_color = cv2.applyColorMap(
            np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET
        )
        heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)
        return cv2.addWeighted(original_img_uint8, 1 - alpha, heatmap_color, alpha, 0)


def encode_overlay_to_base64(overlay_array: np.ndarray) -> str:
    """Encode an RGB uint8 overlay numpy array to a base64 PNG string."""
    from PIL import Image

    img = Image.fromarray(overlay_array.astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")
