'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const userService = require('../services/userService');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Validation helpers ───────────────────────────────────────

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('fullName').optional().isString().trim(),
  body('phone').optional().isMobilePhone(),
  body('preferredLanguage').optional().isIn(['kn', 'en']),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// ── POST /api/auth/register ──────────────────────────────────

router.post('/register', registerValidation, validate, async (req, res, next) => {
  try {
    const { email, password, fullName, phone, preferredLanguage } = req.body;
    const farmer = await userService.createFarmer({ email, password, fullName, phone, preferredLanguage });
    const token = signToken(farmer);
    res.status(201).json({ farmer, token });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ─────────────────────────────────────

router.post('/login', loginValidation, validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const farmer = await userService.verifyFarmer(email, password);
    const token = signToken(farmer);
    res.json({ farmer, token });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const farmer = await userService.getFarmerById(req.farmer.sub);
    res.json({ farmer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
