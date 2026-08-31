/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // Chat sessions — groups messages into a named conversation
  await knex.schema.createTable('chat_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('farmer_id').notNullable().references('id').inTable('farmers').onDelete('CASCADE');
    t.string('title', 500); // auto-generated from first message, editable
    t.string('language', 10).defaultTo('kn');
    t.timestamps(true, true);
  });

  // Individual messages within a session
  await knex.schema.createTable('chat_messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('session_id').notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');

    // 'user' | 'assistant'
    t.string('role', 20).notNullable();

    // Original text (Kannada or English)
    t.text('content').notNullable();

    // Voice input metadata (optional)
    t.string('audio_url', 1024);        // stored audio path
    t.decimal('transcription_confidence', 5, 4);

    // RAG metadata from NLP service (optional)
    t.jsonb('retrieval_meta').defaultTo('{}');
    t.integer('retrieval_records_used');
    t.decimal('retrieval_latency_ms', 10, 2);
    t.decimal('generation_latency_ms', 10, 2);

    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX chat_sessions_farmer_id_idx ON chat_sessions(farmer_id)',
  );
  await knex.schema.raw(
    'CREATE INDEX chat_messages_session_id_idx ON chat_messages(session_id)',
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
};
