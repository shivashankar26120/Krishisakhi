# Krishi Sakhi — AI API Integration Status

## Disease Detection API

| Item | Status |
|------|--------|
| Route `POST /api/disease/predict` | ✅ Implemented |
| Model loading (`final_model.keras`) | ✅ Artifact present |
| Label map (`label_map.json`) | ✅ Artifact present |
| Preprocessing (EfficientNet `preprocess_input`, 224×224) | ✅ Implemented |
| Softmax prediction + top-5 | ✅ Implemented |
| Confidence gating (threshold 0.55, `confident`/`uncertain`) | ✅ Implemented from notebook CELL 15 |
| Model singleton (loaded once per process) | ✅ Implemented |

## Grad-CAM Status

| Item | Status |
|------|--------|
| `GradCAM` class (notebook CELL 14, faithfully extracted) | ✅ Implemented |
| Target layer: `top_conv` | ✅ Confirmed from notebook CELL 17 |
| Gradient tape + pooled gradients | ✅ Implemented |
| ReLU + min-max normalisation | ✅ Implemented |
| JET colormap overlay (alpha=0.4) | ✅ Implemented |
| API response: base64-encoded overlay PNG | ✅ Implemented |
| API response: base64-encoded grayscale heatmap PNG | ✅ Implemented |

## NLP / RAG API

| Item | Status |
|------|--------|
| Route `POST /api/chat/query` | ✅ Implemented |
| KB offset index (`offset_index.npy`) loaded | ✅ Artifact present, loaded at startup |
| O(1) seek record access (no full JSONL in RAM) | ✅ Implemented from notebook SECTION 11 |
| Embedding model: `BAAI/bge-m3` | ⏳ Downloaded from HuggingFace on first run |
| FAISS index (`kb.index`) load from disk | ✅ Artifact present |
| FAISS retrieval (inner product, normalised) | ✅ Implemented from notebook SECTION 21 |
| Low-score refusal path | ✅ Implemented from notebook SECTION 24 |
| System prompt (grounded, no hallucination) | ✅ Verbatim from notebook SECTION 24 |
| LLM: Qwen2.5 with 4-bit candidate chain | ⏳ Downloaded from HuggingFace on first run |
| Translation: IndicTrans2 (Kannada↔English) | ⏳ Downloaded from HuggingFace on first run |
| `translate_from_kannada` pipeline param | ✅ Implemented from notebook SECTION 25 |
| NLP component status endpoint | ✅ `GET /api/chat/status` |

## Whisper STT Status

| Item | Status |
|------|--------|
| Route `POST /api/voice/transcribe` | ✅ Implemented |
| Model: `openai/whisper-small` (architecture-declared) | ⏳ Downloaded on first STT request |
| Lazy loading (not at startup) | ✅ Implemented |
| Configurable via `WHISPER_MODEL_ID` env var | ✅ Implemented |
| Language: Kannada (`kn`) | ✅ Configured |

## Piper TTS Status

| Item | Status |
|------|--------|
| Route `POST /api/voice/synthesize` | ✅ Implemented |
| Piper binary | ❌ **Not present** — download from https://github.com/rhasspy/piper/releases |
| Kannada voice model (`.onnx`) | ❌ **Not present** — download from https://huggingface.co/rhasspy/piper-voices |
| Kannada voice config (`.onnx.json`) | ❌ **Not present** |
| Configurable paths via env vars | ✅ Implemented |
| Clear 503 error when artifacts missing | ✅ Implemented |

## Missing Artifacts

| Artifact | Impact | Action required |
|----------|--------|----------------|
| Piper binary | TTS non-functional | Download from https://github.com/rhasspy/piper/releases |
| Piper Kannada voice model | TTS non-functional | Download `kn_IN-female.onnx` from https://huggingface.co/rhasspy/piper-voices |
| BGE-M3 weights | NLP non-functional | Auto-downloaded from HuggingFace on first run (needs internet) |
| Qwen2.5 weights | NLP generation non-functional | Auto-downloaded from HuggingFace on first run (~3–14 GB) |
| IndicTrans2 weights | Translation non-functional | Auto-downloaded from HuggingFace on first run |

## Known Limitations

1. **LLM memory requirements**: Qwen2.5-7B-Instruct with 4-bit quantisation requires ~6 GB VRAM. The candidate chain automatically falls back to 3B or 1.5B if the 7B model is too slow or unavailable. CPU-only inference is supported but very slow.

3. **IndicTransToolkit install**: Not available as a standard PyPI package. Install via:
   ```
   pip install IndicTransToolkit==1.1.1
   ```
   or from GitHub source. If unavailable, translation is disabled and English-only queries work normally.

4. **Piper on Windows**: Piper provides pre-built binaries for Linux and macOS. Windows support is limited; consider WSL or Docker for TTS in a Windows development environment.

5. **TF cold start**: First disease prediction request incurs TensorFlow model load time (~5-15 seconds). Subsequent requests are fast.
