'use strict';

const express = require('express');

const router = express.Router();

/**
 * GET /api/market/prices
 *
 * Mandi/market price integration is deferred to Stage 8.
 * This stub returns a clear status so the frontend can handle it gracefully.
 *
 * Integration options (to be confirmed before Stage 8):
 *   - data.gov.in AGMARKNET API
 *   - eNAM API (National Agriculture Market)
 *   - State-level market board APIs (e.g. APMC Karnataka)
 *
 * The route structure is established here so the frontend contract is stable.
 */
router.get('/prices', (req, res) => {
  res.status(503).json({
    status: 'pending_integration',
    message: 'Market price integration is pending. External data source (AGMARKNET/eNAM) will be configured in Stage 8.',
    available: false,
  });
});

router.get('/commodities', (req, res) => {
  res.status(503).json({
    status: 'pending_integration',
    message: 'Market commodity listing pending Stage 8 integration.',
    available: false,
  });
});

module.exports = router;
