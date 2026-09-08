'use strict';

const express = require('express');
const axios   = require('axios');
const logger  = require('../config/logger');

const router = express.Router();

// data.gov.in resource ID for "Current Daily Price of Various Commodities from Various Markets (Mandi)"
const AGMARKNET_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const AGMARKNET_BASE_URL    = 'https://api.data.gov.in/resource/' + AGMARKNET_RESOURCE_ID;

/**
 * GET /api/market/prices
 *
 * Query params forwarded to data.gov.in:
 *   state      : e.g. "Karnataka"
 *   district   : e.g. "Bangalore"
 *   commodity  : e.g. "Tomato"
 *   limit      : number of records (default 20, max 100)
 *   offset     : pagination offset
 *
 * Requires MANDI_API_KEY environment variable (data.gov.in API key).
 */
router.get('/prices', async (req, res) => {
  const apiKey = process.env.MANDI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status: 'misconfigured',
      message: 'MANDI_API_KEY environment variable is not set on the server.',
      available: false,
    });
  }

  const limit  = Math.min(parseInt(req.query.limit  || '20', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);

  // Build filter string for data.gov.in API
  const filters = [];
  if (req.query.state)     filters.push(`state:${req.query.state}`);
  if (req.query.district)  filters.push(`district:${req.query.district}`);
  if (req.query.commodity) filters.push(`commodity:${req.query.commodity}`);

  const params = {
    'api-key': apiKey,
    format:    'json',
    limit,
    offset,
  };
  if (filters.length > 0) {
    params.filters = filters.join(',');
  }

  try {
    const { data } = await axios.get(AGMARKNET_BASE_URL, { params, timeout: 15000 });
    return res.json({
      status:    'ok',
      available: true,
      total:     data.total,
      count:     data.count,
      offset:    data.offset,
      records:   data.records || [],
    });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.message || err.message;
    logger.error('Mandi API error', { status, detail });
    return res.status(502).json({
      status:    'upstream_error',
      message:   `data.gov.in API error: ${detail}`,
      available: false,
    });
  }
});

/**
 * GET /api/market/commodities
 *
 * Returns a distinct list of commodities available for a given state/district.
 */
router.get('/commodities', async (req, res) => {
  const apiKey = process.env.MANDI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status:  'misconfigured',
      message: 'MANDI_API_KEY environment variable is not set on the server.',
      available: false,
    });
  }

  const params = {
    'api-key': apiKey,
    format:    'json',
    limit:     100,
    offset:    0,
    fields:    'commodity',
  };
  if (req.query.state)    params.filters = `state:${req.query.state}`;
  if (req.query.district) params.filters = (params.filters ? params.filters + ',' : '') + `district:${req.query.district}`;

  try {
    const { data } = await axios.get(AGMARKNET_BASE_URL, { params, timeout: 15000 });
    // Deduplicate commodity names
    const commodities = [...new Set(
      (data.records || []).map(r => r.commodity).filter(Boolean)
    )].sort();
    return res.json({ status: 'ok', available: true, commodities });
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    logger.error('Mandi commodities API error', { detail });
    return res.status(502).json({
      status: 'upstream_error', message: `data.gov.in API error: ${detail}`, available: false,
    });
  }
});

module.exports = router;
