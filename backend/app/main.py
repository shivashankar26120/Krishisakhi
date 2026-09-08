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


def _download_hf_artifacts(settings) -> None:
    """
    Download large AI artifacts from the Hugging Face repository
    (shivashankarG/krishi-sakhi-ai-assets) at application startup.

    Files managed:
        nlp/kb.index                       → settings.nlp_faiss_index_path
        nlp/final_knowledge_base.jsonl     → settings.nlp_kb_path
        disease/final_model.keras          → settings.disease_model_path

    offset_index.npy is in the GitHub repository and does not need download.

    All downloads are skipped if the target file already exists (idempotent).
    HF_TOKEN is stripped of whitespace/newlines before use.
    """
    import os
    from pathlib import Path

    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        logger.warning(
            "[ARTIFACTS] huggingface_hub not installed — cannot download artifacts."
        )
        return

    repo_id = os.getenv("AI_ARTIFACT_REPO", "shivashankarG/krishi-sakhi-ai-assets")
    revision = os.getenv("AI_ARTIFACT_REVISION", "main")
    raw_token = (os.getenv("HF_TOKEN") or "").strip()
    token = raw_token or None

    artifacts = [
        # (hf_filename_in_repo,           local_destination_path)
        ("nlp/kb.index",                  settings.nlp_faiss_index_path),
        ("nlp/final_knowledge_base.jsonl", settings.nlp_kb_path),
        ("disease/final_model.keras",     settings.disease_model_path),
    ]

    for hf_filename, local_path in artifacts:
        local_path = Path(local_path)
        if local_path.exists():
            logger.info("[ARTIFACTS] Already present, skipping: %s", local_path)
            continue

        local_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(
            "[ARTIFACTS] Downloading %s from %s (revision=%s) → %s …",
            hf_filename, repo_id, revision, local_path,
        )
        try:
            downloaded = hf_hub_download(
                repo_id=repo_id,
                filename=hf_filename,
                revision=revision,
                local_dir=str(local_path.parent),
                local_dir_use_symlinks=False,
                token=token,
            )
            # hf_hub_download may place the file in a subdirectory matching
            # the hf_filename path; move it to the flat expected location.
            src = Path(downloaded)
            if src.resolve() != local_path.resolve():
                src.rename(local_path)
            logger.info("[ARTIFACTS] Downloaded: %s", local_path)
        except Exception as exc:
            logger.error(
                "[ARTIFACTS] Failed to download %s: %s. "
                "Service will report this component as unavailable.",
                hf_filename, exc,
            )


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Krishi Sakhi backend starting up…")
    settings = get_settings()

    # ------------------------------------------------------------------
    # Download heavy AI artifacts from Hugging Face at startup.
    # These files are too large for the GitHub repository and are stored
    # in shivashankarG/krishi-sakhi-ai-assets on Hugging Face.
    #
    # Files downloaded:
    #   nlp/final_knowledge_base.jsonl  → nlp/ in project root
    #   nlp/kb.index                    → nlp/ in project root
    #   disease/final_model.keras       → disease_detection/models/ in project root
    #
    # offset_index.npy is in the GitHub repo (nlp/) and does not need download.
    # ------------------------------------------------------------------
    _download_hf_artifacts(settings)

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
