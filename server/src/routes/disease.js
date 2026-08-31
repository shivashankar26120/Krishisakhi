'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const aiProxy = require('../services/aiProxy');
const db = require('../db/knex');
const logger = require('../config/logger');

const router = express.Router();

// Multer — memory storage (buffer forwarded to AI service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted.'));
    }
  },
});

// All disease routes require authentication
router.use(authenticate);

// ── POST /api/disease/predict ────────────────────────────────
//
// Accepts: multipart/form-data
//   file        : image file
//   with_gradcam: 'true' | 'false' (optional, default false)
//   crop_name   : string (optional, stored in history)
//   notes       : string (optional, stored in history)

router.post('/predict', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  try {
    const withGradcam = req.body.with_gradcam === 'true';
    const cropName = req.body.crop_name || null;
    const notes = req.body.notes || null;

    // Forward to AI service
    const result = await aiProxy.predictDisease(req.file.buffer, req.file.originalname, withGradcam);

    // Persist to disease history
    const [saved] = await db('disease_analyses')
      .insert({
        farmer_id: req.farmer.sub,
        predicted_disease: result.predicted_disease,
        confidence: result.confidence,
        low_confidence: result.low_confidence || false,
        top5_predictions: JSON.stringify(result.top5 || []),
        gradcam_url: result.gradcam_image ? null : null, // placeholder — image storage to be added in later stage
        crop_name: cropName,
        notes,
      })
      .returning('id');

    res.json({
      analysis_id: saved.id,
      ...result,
    });
  } catch (err) {
    logger.error('Disease predict route error', { message: err.message });
    next(err);
  }
});

// ── GET /api/disease/history ─────────────────────────────────

router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    const [analyses, [{ count }]] = await Promise.all([
      db('disease_analyses')
        .where({ farmer_id: req.farmer.sub })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select('id', 'predicted_disease', 'confidence', 'low_confidence', 'top5_predictions',
                'crop_name', 'notes', 'image_url', 'gradcam_url', 'created_at'),
      db('disease_analyses')
        .where({ farmer_id: req.farmer.sub })
        .count('id as count'),
    ]);

    res.json({
      analyses,
      pagination: {
        page,
        limit,
        total: parseInt(count, 10),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/disease/history/:id ─────────────────────────────

router.get('/history/:id', async (req, res, next) => {
  try {
    const analysis = await db('disease_analyses')
      .where({ id: req.params.id, farmer_id: req.farmer.sub })
      .first();

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
