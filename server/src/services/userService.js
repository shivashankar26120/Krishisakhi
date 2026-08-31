'use strict';

const bcrypt = require('bcryptjs');
const db = require('../db/knex');

const SALT_ROUNDS = 12;

/**
 * Create a new farmer account.
 * Throws if email already registered.
 *
 * @param {{ email, password, fullName, phone, preferredLanguage }} data
 * @returns {Promise<object>} created farmer row (without password_hash)
 */
async function createFarmer({ email, password, fullName, phone, preferredLanguage = 'kn' }) {
  const existing = await db('farmers').where({ email }).first();
  if (existing) {
    const err = new Error('Email already registered.');
    err.status = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const [farmer] = await db('farmers')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash,
      full_name: fullName,
      phone,
      preferred_language: preferredLanguage,
    })
    .returning(['id', 'email', 'full_name', 'phone', 'preferred_language', 'created_at']);

  return farmer;
}

/**
 * Find a farmer by email and verify password.
 * Returns farmer row (no hash) or throws.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>}
 */
async function verifyFarmer(email, password) {
  const farmer = await db('farmers')
    .where({ email: email.toLowerCase().trim(), is_active: true })
    .first();

  if (!farmer) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, farmer.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const { password_hash, ...safe } = farmer;
  return safe;
}

/**
 * Get farmer by ID (no password).
 */
async function getFarmerById(id) {
  const farmer = await db('farmers')
    .where({ id })
    .select('id', 'email', 'full_name', 'phone', 'preferred_language', 'is_active', 'created_at')
    .first();

  if (!farmer) {
    const err = new Error('Farmer not found.');
    err.status = 404;
    throw err;
  }
  return farmer;
}

/**
 * Get or create farmer profile.
 */
async function getProfile(farmerId) {
  let profile = await db('farmer_profiles').where({ farmer_id: farmerId }).first();
  if (!profile) {
    // Return empty profile shape
    profile = {
      farmer_id: farmerId,
      village: null,
      district: null,
      state: 'Karnataka',
      primary_crops: [],
      land_area_acres: null,
      additional_info: {},
    };
  }
  return profile;
}

/**
 * Upsert farmer profile.
 */
async function upsertProfile(farmerId, data) {
  const existing = await db('farmer_profiles').where({ farmer_id: farmerId }).first();

  const payload = {
    farmer_id: farmerId,
    village: data.village ?? null,
    district: data.district ?? null,
    state: data.state ?? 'Karnataka',
    primary_crops: data.primaryCrops ?? [],
    land_area_acres: data.landAreaAcres ?? null,
    additional_info: data.additionalInfo ?? {},
    updated_at: db.fn.now(),
  };

  if (existing) {
    const [updated] = await db('farmer_profiles')
      .where({ farmer_id: farmerId })
      .update(payload)
      .returning('*');
    return updated;
  } else {
    const [created] = await db('farmer_profiles')
      .insert(payload)
      .returning('*');
    return created;
  }
}

module.exports = { createFarmer, verifyFarmer, getFarmerById, getProfile, upsertProfile };
