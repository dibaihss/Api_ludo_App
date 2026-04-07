exports.up = async function(knex) {
  const hasOwnerUserId = await knex.schema.hasColumn('sessions', 'owner_user_id');
  const hasExpiresAt = await knex.schema.hasColumn('sessions', 'expires_at');
  const hasLastActivityAt = await knex.schema.hasColumn('sessions', 'last_activity_at');

  await knex.schema.alterTable('sessions', function(table) {
    if (!hasOwnerUserId) {
      table.integer('owner_user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    }

    if (!hasExpiresAt) {
      table.timestamp('expires_at');
    }

    if (!hasLastActivityAt) {
      table.timestamp('last_activity_at');
    }
  });

  await knex('sessions')
    .whereNull('expires_at')
    .update({
      expires_at: knex.raw("NOW() + interval '30 minutes'"),
      last_activity_at: knex.fn.now()
    });

  await knex.raw('ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL');
  await knex.raw('ALTER TABLE sessions ALTER COLUMN last_activity_at SET NOT NULL');

  await knex.schema.alterTable('sessions', function(table) {
    table.index(['owner_user_id', 'status', 'expires_at'], 'sessions_owner_status_expires_idx');
    table.index(['expires_at'], 'sessions_expires_at_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('sessions', function(table) {
    table.dropIndex(['owner_user_id', 'status', 'expires_at'], 'sessions_owner_status_expires_idx');
    table.dropIndex(['expires_at'], 'sessions_expires_at_idx');
    table.dropColumn('last_activity_at');
    table.dropColumn('expires_at');
    table.dropColumn('owner_user_id');
  });
};
