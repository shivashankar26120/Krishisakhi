'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const userService = require('../services/userService');

const router = express.Router();

// All farmer routes require authentication
router.use(authenticate);

// ── GET /api/farmer/profile ──────────────────────────────────

router.get('/profile', async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.farmer.sub);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/farmer/profile ──────────────────────────────────

const profileValidation = [
  body('village').optional().isString().trim().isLength({ max: 255 }),
  body('district').optional().isString().trim().isLength({ max: 255 }),
  body('state').optional().isString().trim().isLength({ max: 100 }),
  body('primaryCrops').optional().isArray(),
  body('primaryCrops.*').optional().isString().trim(),
  body('landAreaAcres').optional().isFloat({ min: 0, max: 99999 }),
  body('additionalInfo').optional().isObject(),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

router.put('/profile', profileValidation, validate, async (req, res, next) => {
  try {
    const profile = await userService.upsertProfile(req.farmer.sub, req.body);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
