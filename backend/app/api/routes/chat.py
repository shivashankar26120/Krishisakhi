"""
POST /api/chat/query

Runs the full NLP/RAG pipeline on a farmer question and returns
the generated answer with retrieval metadata.

GET /api/chat/status — reports component readiness.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import nlp_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["NLP / RAG"])


@router.post(
    "/query",
    response_model=ChatResponse,
    summary="Ask a farmer question",
    description=(
        "Send a natural-language agricultural question (English or Kannada). "
        "The RAG pipeline retrieves relevant knowledge-base records and generates "
        "a grounded, farmer-friendly answer using a local LLM."
    ),
)
async def chat_query(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
) -> ChatResponse:

    try:
        result = nlp_service.run_pipeline(
            question=request.question,
            settings=settings,
            top_k=request.top_k,
            translate_from_kannada=request.translate_from_kannada,
        )
    except RuntimeError as exc:
        logger.error("NLP service error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    return ChatResponse(
        question=result["question"],
        working_question_en=result["working_question_en"],
        answer=result["answer"],
        refused=result["refused"],
        translation_used=result["translation_used"],
        retrieved_records=result["retrieved_records"],
        timings=result["timings"],
    )


@router.get(
    "/status",
    summary="NLP component readiness",
    description="Reports which NLP components (KB, FAISS, LLM, translation) are loaded.",
)
async def chat_status() -> dict:
    return nlp_service.get_status()
