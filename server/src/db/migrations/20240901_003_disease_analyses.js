/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('disease_analyses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('farmer_id').notNullable().references('id').inTable('farmers').onDelete('CASCADE');

    // Image reference (stored path or cloud URL, not binary blob)
    t.string('image_url', 1024);

    // Prediction result
    t.string('predicted_disease', 255);
    t.decimal('confidence', 5, 4); // 0.0000 – 1.0000
    t.boolean('low_confidence').defaultTo(false);

    // Top-5 predictions from the model
    t.jsonb('top5_predictions').defaultTo('[]');

    // Grad-CAM overlay URL (stored separately, may be null if not requested)
    t.string('gradcam_url', 1024);

    // Crop context supplied by farmer at time of analysis
    t.string('crop_name', 100);
    t.string('notes', 1000);

    t.timestamps(true, true);
  });

  await knex.schema.raw(
    'CREATE INDEX disease_analyses_farmer_id_idx ON disease_analyses(farmer_id)',
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('disease_analyses');
};
