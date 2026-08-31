"""Krishi Sakhi FastAPI application."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import disease, chat, voice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Krishi Sakhi backend starting up…")
    settings = get_settings()

    # NLP initialisation (loads FAISS index + embedding model)
    from app.services import nlp_service
    statuses = nlp_service.initialize(settings)
    for component, st in statuses.items():
        level = logging.INFO if "ok" in st or "disabled" in st else logging.WARNING
        logger.log(level, "  [NLP] %-25s → %s", component, st)

    # TTS — download Kannada voice model from HF if not cached
    from app.services import tts_service
    tts_errors = tts_service.ensure_ready(settings)
    if tts_errors:
        for e in tts_errors:
            logger.warning("  [TTS] %s", e)
    else:
        logger.info("  [TTS] Piper voice model ready ✓")

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        description=(
            "Krishi Sakhi backend — AI API layer for plant disease detection, "
            "agricultural NLP/RAG, and Kannada voice I/O."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — restrict origins in production via env vars / reverse proxy
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes
    app.include_router(disease.router, prefix="/api")
    app.include_router(chat.router,   prefix="/api")
    app.include_router(voice.router,  prefix="/api")

    @app.get("/", tags=["Health"])
    async def root() -> dict:
        return {
            "service": settings.app_title,
            "version": settings.app_version,
            "status": "running",
            "docs": "/docs",
        }

    @app.get("/health", tags=["Health"])
    async def health() -> dict:
        from app.services import nlp_service, tts_service
        return {
            "status": "ok",
            "nlp": nlp_service.get_status(),
            "tts": tts_service.get_status(settings),
        }

    return app


app = create_app()
