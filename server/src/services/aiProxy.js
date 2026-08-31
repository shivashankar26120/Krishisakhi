'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { aiServiceUrl } = require('../config/env');
const logger = require('../config/logger');

/**
 * Axios instance for the Python FastAPI AI service.
 * Long timeout for LLM generation (up to 120s).
 */
const aiClient = axios.create({
  baseURL: aiServiceUrl,
  timeout: 120_000,
});

/**
 * POST /api/disease/predict
 * Forwards a multipart image upload to the Python AI service.
 *
 * @param {Buffer} imageBuffer  - raw image bytes
 * @param {string} originalName - original filename (for MIME detection)
 * @param {boolean} withGradcam - request Grad-CAM overlay
 * @returns {Promise<object>}    AI service response body
 */
async function predictDisease(imageBuffer, originalName, withGradcam = false) {
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: originalName,
    contentType: 'image/jpeg', // AI service accepts JPEG/PNG/WebP
  });
  form.append('with_gradcam', withGradcam ? 'true' : 'false');

  try {
    const { data } = await aiClient.post('/api/disease/predict', form, {
      headers: form.getHeaders(),
    });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.message;
    logger.error('AI disease predict error', { status, detail });
    const error = new Error(detail);
    error.status = status || 502;
    throw error;
  }
}

/**
 * POST /api/chat/query
 *
 * @param {string} question
 * @param {string} [language='kn']
 * @returns {Promise<object>}
 */
async function chatQuery(question, language = 'kn') {
  try {
    const { data } = await aiClient.post('/api/chat/query', { question, language });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.message;
    logger.error('AI chat query error', { status, detail });
    const error = new Error(detail);
    error.status = status || 502;
    throw error;
  }
}

/**
 * POST /api/voice/transcribe
 *
 * @param {Buffer} audioBuffer
 * @param {string} originalName
 * @returns {Promise<object>}
 */
async function transcribeAudio(audioBuffer, originalName) {
  const form = new FormData();
  form.append('file', audioBuffer, { filename: originalName });

  try {
    const { data } = await aiClient.post('/api/voice/transcribe', form, {
      headers: form.getHeaders(),
    });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.message;
    logger.error('AI transcribe error', { status, detail });
    const error = new Error(detail);
    error.status = status || 502;
    throw error;
  }
}

/**
 * POST /api/voice/synthesize
 *
 * @param {string} text
 * @returns {Promise<Buffer>} WAV audio bytes
 */
async function synthesizeSpeech(text) {
  try {
    const response = await aiClient.post(
      '/api/voice/synthesize',
      { text },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(response.data);
  } catch (err) {
    const status = err.response?.status;
    const detail = err.message;
    logger.error('AI synthesize error', { status, detail });
    const error = new Error(detail);
    error.status = status || 502;
    throw error;
  }
}

/**
 * GET /health — check AI service availability.
 * @returns {Promise<boolean>}
 */
async function isAiServiceAvailable() {
  try {
    await aiClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  predictDisease,
  chatQuery,
  transcribeAudio,
  synthesizeSpeech,
  isAiServiceAvailable,
};
