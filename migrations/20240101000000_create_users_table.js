exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('name');
    table.boolean('status').defaultTo(false);
    table.boolean('is_guest').defaultTo(false);
    table.string('email').unique();
    table.string('password');
    table.timestamp('last_activity');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
