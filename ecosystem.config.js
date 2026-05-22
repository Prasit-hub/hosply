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
        JWT_SECRET: process.env.JWT_SECRET || 'hosply_super_secret_jwt_key_2026_clinical_collaboration',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'hosply_refresh_super_secret_key_2026',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '32byteencryptkeyforhosplymessage'
      }
    }
  ]
};
