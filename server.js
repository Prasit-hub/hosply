// Load environment variables from .env file
require('dotenv').config();

// Bootstrapper to register ts-node and run the TypeScript server
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    moduleResolution: 'node',
  },
});

require('./src/server.ts');
