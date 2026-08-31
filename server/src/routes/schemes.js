'use strict';

const express = require('express');
const { query: qv, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const db = require('../db/knex');

const router = express.Router();

// Schemes are public — no authentication required for reading
// but authenticated farmers can save favourites (later stage)

// ── GET /api/schemes ─────────────────────────────────────────
//
// Query params:
//   q        : text search (scheme name)
//   type     : scheme_type filter (subsidy | insurance | loan | training | other)
//   is_central: true | false
//   page, limit

const listValidation = [
  qv('q').optional().isString().trim().isLength({ max: 200 }),
  qv('type').optional().isIn(['subsidy', 'insurance', 'loan', 'training', 'other']),
  qv('is_central').optional().isBoolean(),
  qv('page').optional().isInt({ min: 1 }),
  qv('limit').optional().isInt({ min: 1, max: 50 }),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

router.get('/', listValidation, validate, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    let query = db('government_schemes').where({ is_active: true });

    if (req.query.q) {
      // Full-text search on scheme_name
      query = query.whereRaw(
        `to_tsvector('english', scheme_name) @@ plainto_tsquery('english', ?)`,
        [req.query.q],
      );
    }
    if (req.query.type) {
      query = query.where({ scheme_type: req.query.type });
    }
    if (req.query.is_central !== undefined) {
      query = query.where({ is_central: req.query.is_central === 'true' });
    }

    const [schemes, [{ count }]] = await Promise.all([
      query.clone().orderBy('scheme_name').limit(limit).offset(offset),
      query.clone().count('id as count'),
    ]);

    res.json({
      schemes,
      pagination: { page, limit, total: parseInt(count, 10), pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/schemes/:id ─────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const scheme = await db('government_schemes')
      .where({ id: req.params.id, is_active: true })
      .first();
    if (!scheme) return res.status(404).json({ error: 'Scheme not found.' });
    res.json({ scheme });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
