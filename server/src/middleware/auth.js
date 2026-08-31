'use strict';

const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');

/**
 * Middleware: verify JWT and attach farmer payload to req.farmer.
 *
 * Expects: Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, jwtConfig.secret);
    req.farmer = payload; // { sub: farmerId, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Helper: sign a JWT for a farmer.
 */
function signToken(farmer) {
  return jwt.sign(
    { sub: farmer.id, email: farmer.email },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn },
  );
}

module.exports = { authenticate, signToken };
