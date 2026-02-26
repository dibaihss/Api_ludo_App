exports.up = function(knex) {
  return knex.schema.createTable('sessions', function(table) {
    table.increments('id').primary();
    table.string('name');
    table.string('status');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.integer('max_players').defaultTo(4);
    table.integer('current_players').defaultTo(0);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sessions');
};
