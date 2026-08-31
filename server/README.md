# Krishi Sakhi — Node/Express Application Server

Application backend handling authentication, farmer data, AI proxying, disease history, chat history, government schemes, and market data.

**Runs on**: `http://localhost:3001`

---

## Quick Start

```bash
cd server

# 1. Copy env template
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

# 2. Install dependencies
npm install

# 3. Run database migrations
npm run migrate

# 4. Seed starter data (optional — adds sample government schemes)
npm run seed

# 5. Start dev server (auto-reload)
npm run dev

# OR start production server
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 64 chars) |
| `PORT` | — | Server port (default: 3001) |
| `NODE_ENV` | — | `development` or `production` |
| `AI_SERVICE_URL` | — | Python AI service URL (default: http://localhost:8000) |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register farmer account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | 🔒 | Get current farmer |

### Farmer Profile
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/farmer/profile` | 🔒 | Get farmer profile |
| PUT | `/api/farmer/profile` | 🔒 | Update farmer profile |

### Disease Detection
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/disease/predict` | 🔒 | Upload image → prediction + Grad-CAM |
| GET | `/api/disease/history` | 🔒 | Paginated analysis history |
| GET | `/api/disease/history/:id` | 🔒 | Single analysis detail |

**Predict request** — `multipart/form-data`:
- `file`: image (JPEG/PNG/WebP, max 10MB)
- `with_gradcam`: `"true"` | `"false"` (optional)
- `crop_name`: string (optional)
- `notes`: string (optional)

### Chat (NLP/RAG)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/sessions` | 🔒 | Create new chat session |
| GET | `/api/chat/sessions` | 🔒 | List chat sessions |
| GET | `/api/chat/sessions/:id/messages` | 🔒 | Get messages for session |
| POST | `/api/chat/sessions/:id/query` | 🔒 | Text query → RAG answer |
| POST | `/api/chat/sessions/:id/voice-query` | 🔒 | Audio → Whisper → RAG |
| DELETE | `/api/chat/sessions/:id` | 🔒 | Delete session |

### Government Schemes (public)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/schemes?q=&type=&page=` | — | List/search schemes |
| GET | `/api/schemes/:id` | — | Scheme detail |

### Market Prices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/prices` | Pending Stage 8 integration |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + uptime check |

---

## Database Migrations

```bash
# Run all pending migrations
npm run migrate

# Rollback last batch
npm run migrate:rollback

# Create new migration
npm run migrate:make migration_name
```

---

## Architecture

```
Browser (React @ :5173)
       │
Node/Express Server (@ :3001)
       │  internal HTTP
Python FastAPI AI Service (@ :8000)
       │
ML artifacts (disease model, FAISS index, Qwen2.5, Whisper)
```

The Node server is the only service the frontend talks to.
The Python AI service is an internal implementation detail.
