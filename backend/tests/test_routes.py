"""
Basic smoke tests for route registration and configuration loading.
Run with: pytest tests/
"""
import sys
from pathlib import Path

# Ensure backend folder is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    """
    Create a test client.
    NLP service startup is skipped in CI by patching nlp_service.initialize.
    """
    import unittest.mock as mock

    with mock.patch("app.services.nlp_service.initialize", return_value={}):
        from app.main import app
        return TestClient(app)


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "running"


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_disease_route_registered(client):
    """Route should return 422 (not 404) when no file is submitted."""
    resp = client.post("/api/disease/predict")
    assert resp.status_code == 422   # FastAPI validation, not 404


def test_chat_route_registered(client):
    """Route should return 422 (not 404) when body is missing."""
    resp = client.post("/api/chat/query", json={})
    assert resp.status_code == 422


def test_chat_status_route_registered(client):
    resp = client.get("/api/chat/status")
    # May return 200 or 500 depending on whether NLP is loaded;
    # what matters is 404 does NOT occur.
    assert resp.status_code != 404


def test_voice_transcribe_route_registered(client):
    resp = client.post("/api/voice/transcribe")
    assert resp.status_code == 422   # no file submitted


def test_voice_status_route_registered(client):
    resp = client.get("/api/voice/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "stt_model" in data
    assert "tts_available" in data


def test_disease_empty_file(client):
    """Submitting an empty file should return 400, not crash."""
    from io import BytesIO
    resp = client.post(
        "/api/disease/predict",
        files={"file": ("leaf.jpg", BytesIO(b""), "image/jpeg")},
    )
    assert resp.status_code in (400, 503)   # 503 if TF not installed in test env
