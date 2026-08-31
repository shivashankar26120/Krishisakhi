/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('government_schemes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('scheme_name', 500).notNullable();
    t.string('scheme_name_kn', 500); // Kannada name
    t.string('ministry', 255);
    t.string('scheme_type', 100); // subsidy | insurance | loan | training | other
    t.text('description');
    t.text('description_kn');       // Kannada description
    t.text('eligibility');
    t.text('eligibility_kn');
    t.text('benefits');
    t.text('benefits_kn');
    t.string('application_url', 1024);
    t.specificType('applicable_crops', 'text[]');
    t.specificType('applicable_states', 'text[]').defaultTo("'{}'");
    t.boolean('is_central').defaultTo(true); // central vs state scheme
    t.boolean('is_active').defaultTo(true);
    t.date('valid_from');
    t.date('valid_until');
    t.timestamps(true, true);
  });

  // Full-text search index on scheme name
  await knex.schema.raw(
    `CREATE INDEX gov_schemes_name_gin ON government_schemes USING GIN (to_tsvector('english', scheme_name))`,
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('government_schemes');
};
