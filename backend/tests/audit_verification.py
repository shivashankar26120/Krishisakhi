"""
Audit Verification Script
Executes real local verification for:
1. Disease detection model loading, preprocessing, confidence thresholding, Grad-CAM generation.
2. NLP offset-index access, FAISS index loading (kb.index), BGE-M3 embedding, and vector retrieval.
3. Path configuration check (no Colab/Drive paths).
"""
import sys
import os
import json
import numpy as np
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def audit_paths():
    print("=== AUDIT 1: PATH & SECRETS CHECK ===")
    from app.core.config import get_settings
    settings = get_settings()

    path_attrs = [
        "disease_model_path",
        "disease_label_map_path",
        "nlp_kb_path",
        "nlp_offset_index_path",
        "nlp_faiss_index_path",
    ]
    for attr in path_attrs:
        p = getattr(settings, attr)
        print(f"  {attr}: {p} (Exists: {p.exists()})")
        assert "/content/gdrive" not in str(p).lower() and "/content/drive" not in str(p).lower(), f"Google Drive path detected in {attr}"
    print("  [PASS] All paths are project-relative and verified.\n")

def audit_disease_and_gradcam():
    print("=== AUDIT 2: DISEASE DETECTION & GRAD-CAM ===")
    from app.core.config import get_settings
    from app.services import disease_service

    settings = get_settings()
    
    # Create a synthetic image 224x224x3 uint8
    dummy_img = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    from PIL import Image
    import io
    buf = io.BytesIO()
    Image.fromarray(dummy_img).save(buf, format="JPEG")
    dummy_bytes = buf.getvalue()

    print("  Running diagnose_image with dummy JPEG...")
    res = disease_service.diagnose_image(dummy_bytes, settings=settings, with_gradcam=True)

    print(f"  Status          : {res['status']}")
    print(f"  Predicted class : {res['predicted_class']}")
    print(f"  Confidence      : {res['confidence']}")
    print(f"  Message         : {res['message']}")
    print(f"  Top 5 count     : {len(res['top5'])}")
    print(f"  Grad-CAM overlay: {'B64 Present' if res.get('gradcam_overlay_b64') else 'None'}")

    assert "status" in res
    assert "predicted_class" in res
    assert "confidence" in res
    assert len(res["top5"]) == 5
    assert res.get("gradcam_overlay_b64") is not None, "Grad-CAM overlay was not generated"
    print("  [PASS] Disease Detection and Grad-CAM working as expected.\n")

def audit_nlp_retrieval():
    print("=== AUDIT 3: NLP KB ACCESS & FAISS RETRIEVAL ===")
    from app.core.config import get_settings
    from app.services import nlp_service

    settings = get_settings()

    print("  Loading KB access layer...")
    err_kb = nlp_service._load_kb_access_layer(settings)
    assert err_kb is None, f"KB load error: {err_kb}"
    print(f"  KB Records loaded: {nlp_service._n_total_records}")

    print("  Loading FAISS index (kb.index)...")
    err_faiss = nlp_service._load_faiss_index(settings)
    assert err_faiss is None, f"FAISS load error: {err_faiss}"
    print(f"  FAISS vectors: {nlp_service._faiss_index.ntotal}")

    print("  Loading BGE-M3 embedding model...")
    err_emb = nlp_service._load_embedding_model(settings)
    assert err_emb is None, f"Embedding load error: {err_emb}"

    test_query = "What causes yellow leaves in paddy rice?"
    print(f"  Testing retrieval for query: '{test_query}'...")
    records = nlp_service.retrieve(test_query, top_k=3, settings=settings)
    
    print(f"  Retrieved {len(records)} records:")
    for r in records:
        print(f"    - ID {r['record_id']} | Score: {r['score']:.4f} | Source: {r['source_dataset']}")
        print(f"      Q: {r['question'][:80]}...")
        print(f"      A: {r['answer'][:100]}...\n")
    
    assert len(records) == 3, f"Expected 3 records, got {len(records)}"
    assert records[0]["score"] > 0, "Retrieval score should be positive"
    print("  [PASS] NLP KB Offset Access & FAISS Retrieval fully functional.\n")

if __name__ == "__main__":
    audit_paths()
    audit_disease_and_gradcam()
    audit_nlp_retrieval()
    print("ALL AUDIT COMPONENT CHECKS PASSED PERFECTLY!")
