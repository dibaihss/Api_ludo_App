require('dotenv').config();
const { buildConnection, createKnex, isValidDatabaseUrl } = require('./database-factory');

const knex = createKnex(process.env);

module.exports = knex;
module.exports.buildConnection = buildConnection;
module.exports.createKnex = createKnex;
module.exports.isValidDatabaseUrl = isValidDatabaseUrl;
