# Krishi Sakhi — Backend API

AI inference backend for plant disease detection, agricultural NLP/RAG, and Kannada voice I/O.

---

## How to start

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API docs: http://localhost:8000/docs

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Component health check |
| POST | `/api/disease/predict` | Plant disease diagnosis + Grad-CAM |
| POST | `/api/chat/query` | NLP/RAG farmer Q&A |
| GET | `/api/chat/status` | NLP component readiness |
| POST | `/api/voice/transcribe` | Kannada audio → text (Whisper) |
| POST | `/api/voice/synthesize` | Kannada text → WAV audio (Piper) |
| GET | `/api/voice/status` | STT/TTS readiness |

---

## Request / Response formats

### POST `/api/disease/predict`

**Request** — `multipart/form-data`
```
file        : plant leaf image (JPEG / PNG / WebP, max 20 MB)
with_gradcam: bool (default true)
```

**Response** — JSON
```json
{
  "status": "confident",
  "predicted_class": "Tomato___Late_blight",
  "confidence": 0.9234,
  "message": "Tomato___Late_blight (92.3% confidence)",
  "top5": [
    {"class": "Tomato___Late_blight", "confidence": 0.9234},
    ...
  ],
  "gradcam_overlay_b64": "<base64 PNG>",
  "gradcam_heatmap_b64": "<base64 grayscale PNG>",
  "gradcam_error": null
}
```

When `confidence < 0.55`, `status` is `"uncertain"` and the message asks the farmer
to retake the photo.

---

### POST `/api/chat/query`

**Request** — JSON body
```json
{
  "question": "My rice crop has yellow leaves, what should I do?",
  "top_k": 5,
  "translate_from_kannada": false
}
```

**Response** — JSON
```json
{
  "question": "My rice crop has yellow leaves, what should I do?",
  "working_question_en": "My rice crop has yellow leaves, what should I do?",
  "answer": "Yellow leaves in rice can indicate ...",
  "refused": false,
  "translation_used": false,
  "retrieved_records": [
    {
      "record_id": 12345,
      "question": "...",
      "answer": "...",
      "source_dataset": "dataset_26k",
      "score": 0.812
    }
  ],
  "timings": {"retrieval_s": 0.12, "generation_s": 3.4, "total_s": 3.52}
}
```

`refused: true` means retrieval confidence was below threshold — no answer is fabricated.

For Kannada input, set `translate_from_kannada: true` (requires IndicTrans2 to be loaded).

---

### POST `/api/voice/transcribe`

**Request** — `multipart/form-data`
```
file : audio file (WAV / MP3 / OGG, max 50 MB)
```

**Response** — JSON
```json
{
  "text": "ನನ್ನ ಟೊಮೇಟೊ ಗಿಡಕ್ಕೆ ರೋಗ ಬಂದಿದೆ",
  "language": "kn",
  "model": "openai/whisper-small"
}
```

---

### POST `/api/voice/synthesize`

**Request** — JSON body
```json
{
  "text": "ನಿಮ್ಮ ಫಸಲು ಚೆನ್ನಾಗಿ ಇರಲಿ"
}
```

**Response** — `audio/wav` bytes (binary stream)

Returns `503` with missing artifact list if Piper binary or voice model is absent.

---

## Model / artifact locations

| Artifact | Default path | Configurable |
|----------|--------------|-------------|
| Disease model | `disease_detection/models/final_model.keras` | `DISEASE_MODEL_PATH` |
| Label map | `disease_detection/models/label_map.json` | `DISEASE_LABEL_MAP_PATH` |
| Knowledge base JSONL | `nlp/final_knowledge_base.jsonl` | `NLP_KB_PATH` |
| Offset index | `nlp/offset_index.npy` | `NLP_OFFSET_INDEX_PATH` |
| FAISS index | `nlp/kb.index` | `NLP_FAISS_INDEX_PATH` |
| Provenance stats | `nlp/provenance_stats.json` | `NLP_PROVENANCE_STATS_PATH` |
| Piper binary | `tts/piper` | `PIPER_EXECUTABLE_PATH` |
| Piper voice model | `tts/kn_IN-female.onnx` | `PIPER_VOICE_MODEL_PATH` |
| Piper voice config | `tts/kn_IN-female.onnx.json` | `PIPER_VOICE_CONFIG_PATH` |

Paths are project-relative. All can be overridden via environment variables or a `.env` file
placed in the `backend/` directory.

---

## Environment variables

Create `backend/.env` (optional):

```env
# Disease
DISEASE_MODEL_PATH=/absolute/path/to/final_model.keras
DISEASE_CONFIDENCE_THRESHOLD=0.55

# NLP
NLP_EMBEDDING_MODEL=BAAI/bge-m3
NLP_FAISS_INDEX_PATH=/absolute/path/to/kb.index
NLP_TRANSLATION_ENABLED=true

# LLM candidates (comma-separated name:require_4bit:min_tokens_per_sec)
NLP_LLM_CANDIDATE_MODELS=Qwen/Qwen2.5-7B-Instruct:true:8,Qwen/Qwen2.5-3B-Instruct:false:0

# Voice
WHISPER_MODEL_ID=openai/whisper-small
WHISPER_LANGUAGE=kn
PIPER_EXECUTABLE_PATH=/path/to/piper
PIPER_VOICE_MODEL_PATH=/path/to/kn_IN-female.onnx
```

---

## Missing artifacts (current state)

| Artifact | Status |
|----------|--------|
| `disease_detection/models/final_model.keras` | ✅ Present |
| `disease_detection/models/label_map.json` | ✅ Present |
| `nlp/final_knowledge_base.jsonl` | ✅ Present |
| `nlp/offset_index.npy` | ✅ Present |
| `nlp/kb.index` | ✅ Present |
| Piper binary + voice model | ❌ **Missing** — download from Piper releases |
| BGE-M3 model weights | Downloaded on first run from HuggingFace |
| Qwen2.5 model weights | Downloaded on first run from HuggingFace |
| IndicTrans2 model weights | Downloaded on first run from HuggingFace |

---

## Local testing

```bash
# Start server
cd backend
uvicorn app.main:app --reload

# Test disease endpoint (requires a leaf image)
curl -X POST http://localhost:8000/api/disease/predict \
  -F "file=@/path/to/leaf.jpg" \
  -F "with_gradcam=true"

# Test NLP endpoint
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I treat rice blast disease?"}'

# Check status
curl http://localhost:8000/health
curl http://localhost:8000/api/chat/status
curl http://localhost:8000/api/voice/status

# Test STT (requires audio file)
curl -X POST http://localhost:8000/api/voice/transcribe \
  -F "file=@/path/to/audio.wav"
```
