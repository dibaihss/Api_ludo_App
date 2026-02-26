exports.up = function(knex) {
  return knex.schema.createTable('session_users', function(table) {
    table.integer('session_id').unsigned().references('id').inTable('sessions').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.primary(['session_id', 'user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('session_users');
};
