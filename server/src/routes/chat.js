'use strict';

const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const aiProxy = require('../services/aiProxy');
const db = require('../db/knex');
const logger = require('../config/logger');

const router = express.Router();
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

router.use(authenticate);

// ── POST /api/chat/sessions ──────────────────────────────────

router.post('/sessions', async (req, res, next) => {
  try {
    const language = req.body.language || 'kn';
    const [session] = await db('chat_sessions')
      .insert({ farmer_id: req.farmer.sub, language, title: 'New conversation' })
      .returning('*');
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/chat/sessions ───────────────────────────────────

router.get('/sessions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    const [sessions, [{ count }]] = await Promise.all([
      db('chat_sessions')
        .where({ farmer_id: req.farmer.sub })
        .orderBy('updated_at', 'desc')
        .limit(limit).offset(offset),
      db('chat_sessions').where({ farmer_id: req.farmer.sub }).count('id as count'),
    ]);

    res.json({ sessions, pagination: { page, limit, total: parseInt(count, 10) } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/chat/sessions/:sessionId/messages ───────────────

router.get('/sessions/:sessionId/messages', async (req, res, next) => {
  try {
    // Verify session belongs to this farmer
    const session = await db('chat_sessions')
      .where({ id: req.params.sessionId, farmer_id: req.farmer.sub })
      .first();
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const messages = await db('chat_messages')
      .where({ session_id: req.params.sessionId })
      .orderBy('created_at', 'asc');

    res.json({ session, messages });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat/sessions/:sessionId/query ─────────────────
//
// Sends a text question to the NLP/RAG pipeline.
// Saves both the user message and assistant response to history.

const queryValidation = [
  body('question').isString().trim().isLength({ min: 1, max: 2000 }),
  body('language').optional().isIn(['kn', 'en']),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

router.post('/sessions/:sessionId/query', queryValidation, validate, async (req, res, next) => {
  try {
    const session = await db('chat_sessions')
      .where({ id: req.params.sessionId, farmer_id: req.farmer.sub })
      .first();
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const { question, language = 'kn' } = req.body;

    // Save user message
    await db('chat_messages').insert({
      session_id: session.id,
      role: 'user',
      content: question,
    });

    // Call AI service
    const aiResult = await aiProxy.chatQuery(question, language);

    // Save assistant message
    await db('chat_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: aiResult.answer,
      retrieval_meta: JSON.stringify(aiResult.retrieval_metadata || {}),
      retrieval_records_used: aiResult.retrieval_metadata?.records_used,
      retrieval_latency_ms: aiResult.timings?.retrieval_ms,
      generation_latency_ms: aiResult.timings?.generation_ms,
    });

    // Update session title from first question (if still default)
    if (session.title === 'New conversation') {
      const title = question.slice(0, 80);
      await db('chat_sessions').where({ id: session.id }).update({ title, updated_at: db.fn.now() });
    } else {
      await db('chat_sessions').where({ id: session.id }).update({ updated_at: db.fn.now() });
    }

    res.json({
      session_id: session.id,
      question,
      answer: aiResult.answer,
      retrieval_metadata: aiResult.retrieval_metadata,
      timings: aiResult.timings,
    });
  } catch (err) {
    logger.error('Chat query error', { message: err.message });
    next(err);
  }
});

// ── POST /api/chat/sessions/:sessionId/voice-query ───────────
//
// Audio input → Whisper STT → NLP/RAG → response text (+ optional TTS)

router.post(
  '/sessions/:sessionId/voice-query',
  audioUpload.single('audio'),
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });

    try {
      const session = await db('chat_sessions')
        .where({ id: req.params.sessionId, farmer_id: req.farmer.sub })
        .first();
      if (!session) return res.status(404).json({ error: 'Session not found.' });

      const language = req.body.language || 'kn';

      // 1. Transcribe audio
      const sttResult = await aiProxy.transcribeAudio(req.file.buffer, req.file.originalname);
      const transcribedText = sttResult.text;

      // 2. Save user message (with transcription metadata)
      await db('chat_messages').insert({
        session_id: session.id,
        role: 'user',
        content: transcribedText,
        transcription_confidence: sttResult.confidence || null,
      });

      // 3. Query NLP/RAG
      const aiResult = await aiProxy.chatQuery(transcribedText, language);

      // 4. Save assistant message
      await db('chat_messages').insert({
        session_id: session.id,
        role: 'assistant',
        content: aiResult.answer,
        retrieval_meta: JSON.stringify(aiResult.retrieval_metadata || {}),
        retrieval_records_used: aiResult.retrieval_metadata?.records_used,
        retrieval_latency_ms: aiResult.timings?.retrieval_ms,
        generation_latency_ms: aiResult.timings?.generation_ms,
      });

      await db('chat_sessions').where({ id: session.id }).update({ updated_at: db.fn.now() });

      res.json({
        session_id: session.id,
        transcribed_text: transcribedText,
        transcription_confidence: sttResult.confidence,
        answer: aiResult.answer,
        retrieval_metadata: aiResult.retrieval_metadata,
        timings: aiResult.timings,
      });
    } catch (err) {
      logger.error('Voice query error', { message: err.message });
      next(err);
    }
  },
);

// ── DELETE /api/chat/sessions/:sessionId ─────────────────────

router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const deleted = await db('chat_sessions')
      .where({ id: req.params.sessionId, farmer_id: req.farmer.sub })
      .delete();
    if (!deleted) return res.status(404).json({ error: 'Session not found.' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
