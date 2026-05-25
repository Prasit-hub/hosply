// Load environment variables from .env file before configuring PM2
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'hosply',
      script: 'server.js',
      // Run in fork mode because SQLite and WebSockets are best in a single persistent node process.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3006,
        DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
        JWT_SECRET: process.env.JWT_SECRET || '761d04cd-6464-4cb8-a9c7-865827c4a691',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'f1285f04-c39e-4949-a4f4-ba811a49d0f5',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '1bcf168e-0d56-425c-b042-7437b5edc3dd'
      }
    }
  ]
};
