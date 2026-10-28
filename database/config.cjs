require('dotenv/config');
const config = { use_env_variable: 'DB_URI', dialect: 'postgres', logging: false };
module.exports = { development: config, test: config, production: config };
