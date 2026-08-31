/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('farmer_profiles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('farmer_id').notNullable().references('id').inTable('farmers').onDelete('CASCADE');
    t.string('village', 255);
    t.string('district', 255);
    t.string('state', 100).defaultTo('Karnataka');
    t.specificType('primary_crops', 'text[]'); // e.g. ['tomato','maize']
    t.decimal('land_area_acres', 8, 2);
    t.jsonb('additional_info').defaultTo('{}');
    t.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('farmer_profiles');
};
