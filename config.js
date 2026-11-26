// Shared settings
const path = require("node:path");

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, "data", "yulinkup.db"),
  MIN_TEAM_SIZE: 2 // Team includes the creator(so minimum 2)
};
