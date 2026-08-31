"""Request and response schemas for the NLP/RAG chat API."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The farmer's question in English or Kannada.",
    )
    top_k: Optional[int] = Field(
        default=None,
        ge=1,
        le=20,
        description="Number of KB records to retrieve. Defaults to server config.",
    )
    translate_from_kannada: bool = Field(
        default=False,
        description=(
            "Set true when the question is in Kannada. "
            "Triggers Kannada→English translation before retrieval and "
            "English→Kannada translation of the final answer. "
            "Requires IndicTrans2 to be available."
        ),
    )


class RetrievedRecord(BaseModel):
    record_id: int
    question: str
    answer: str
    source_dataset: Optional[str] = None
    score: float = Field(description="Inner-product similarity score from FAISS.")


class ChatResponse(BaseModel):
    question: str
    working_question_en: str = Field(
        description="The question text used for retrieval (after optional translation)."
    )
    answer: str
    refused: bool = Field(
        description=(
            "True if the system refused to answer because retrieval confidence "
            "was below the minimum threshold."
        )
    )
    translation_used: bool
    retrieved_records: list[RetrievedRecord]
    timings: dict[str, float] = Field(description="Latency breakdown in seconds.")
