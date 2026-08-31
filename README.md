# Krishi Sakhi (ಕೃಷಿ ಸಖಿ) / Raithamitra

Farmer-focused, mobile-responsive web application designed to empower farmers in Karnataka with AI-driven plant disease detection, agricultural NLP/RAG chat assistance (in Kannada and English), voice interaction, government scheme navigation, and market price tracking.

---

## 🏛️ Application Architecture

The project follows a decoupled multi-service architecture:

```
                  ┌─────────────────────────────────┐
                  │   Farmer Mobile / Web Browser   │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │    React Frontend (Vercel)      │
                  │        (Vite SPA + i18n)        │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │   Node/Express API (Railway)    │
                  │   (Auth, Profiles, DB Proxy)    │
                  └────────┬───────────────┬────────┘
                           │               │
                           ▼               ▼
           ┌───────────────────┐       ┌──────────────────────┐
           │ PostgreSQL DB     │       │ Python AI Service    │
           │ (Knex Migrations) │       │ (FastAPI Inference)  │
           └───────────────────┘       └──────────────────────┘
```

1. **Frontend (`frontend/`)**: React SPA with Vite, Bootstrap styling, custom mobile navigation, and global bilingual Kannada/English i18n system. Deployed on **Vercel**.
2. **Application Backend (`server/`)**: Node.js + Express API managing farmer profiles, authentication (JWT + bcrypt), disease & chat history persistence, government scheme query API, and mandi price endpoints. Deployed on **Railway**.
3. **Database**: PostgreSQL managed via Knex.js migrations and seeders (`server/src/db/`).
4. **AI Service (`backend/`)**: Python FastAPI wrapper handling inference for:
   - Plant Disease Detection (ResNet50 / ConvNet Keras model)
   - Grad-CAM heatmap visualization overlay
   - Agricultural RAG pipeline (BGE-M3 embeddings + FAISS vector search + Qwen2.5 / IndicTrans2)
   - Voice STT (Whisper Small) & TTS (Piper Kannada voice)

---

## 🚀 Services & Project Structure

```
krishisakhi/
├── frontend/             # React Vite SPA (Vercel target)
├── server/               # Node/Express backend (Railway target)
├── backend/              # Python FastAPI AI service (Railway target)
├── disease_detection/    # Model artifacts (final_model.keras, label_map.json)
├── nlp/                  # RAG Knowledge base (final_knowledge_base.jsonl, kb.index)
├── tts/                  # Piper TTS runtime directory
├── .gitignore            # Root gitignore
└── README.md             # Project documentation
```

---

## 🔑 Environment Variables Reference

### 1. Node Server (`server/.env`)
```ini
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://krishisakhi.vercel.app,http://localhost:5173
AI_SERVICE_URL=https://krishisakhi-ai.up.railway.app
```

### 2. Python AI Service (`backend/.env`)
```ini
PORT=8000
HF_TOKEN=your_huggingface_access_token
```

### 3. React Frontend (`frontend/.env`)
```ini
VITE_API_BASE_URL=https://krishisakhi-server.up.railway.app
```

---

## 🛠️ Local Development Quickstart

1. **Install Dependencies**:
   ```bash
   cd server && npm install
   cd ../frontend && npm install
   cd ../backend && pip install -r requirements.txt
   ```
2. **Start Python AI Service**:
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```
3. **Start Node Server**:
   ```bash
   cd server
   npm run dev
   ```
4. **Start Frontend App**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173`.

---

## 🌐 Production Deployment

- **Frontend**: Deploy `frontend/` directory to **Vercel** with build command `npm run build` and output directory `dist`.
- **Node Server**: Deploy `server/` directory to **Railway** connected to a PostgreSQL plugin.
- **AI Service**: Deploy `backend/` directory to **Railway** (Python 3.12 environment).
