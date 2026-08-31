# Krishi Sakhi — Farmer Mobile Web App (Frontend)

Mobile-first React application built for Karnataka farmers with full bilingual support (Kannada/English).

## Features
- **Global i18n System**: Toggle between Kannada (ಕನ್ನಡ) and English at any time.
- **Disease Detection**: Camera capture & gallery upload, Grad-CAM visualization, confidence meter.
- **Krishi Chat**: Natural language AI chatbot with voice input (Whisper STT).
- **Government Schemes**: Search, filter, and view official subsidy/loan/insurance details.
- **Mandi Prices**: Market prices overview (AGMARKNET integration stub).
- **Farmer Profile**: Crop management, land area, location details, preferred language sync.

## Development Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The app runs on `http://localhost:5173`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL of the Node/Express backend | `http://localhost:3001` |

## Production Build

```bash
npm run build
```

The output `dist/` directory is ready for deployment on **Vercel**, **Netlify**, or any static host.
