import 'dotenv/config';
import { startServer } from '@st/core';
import { connectDB } from '@st/database';
import app from './app.js';

// Graceful shutdown (Ctrl+C, SIGTERM, unexpected errors) is handled by @st/core:
// it closes the HTTP server, cache and database for you.
await startServer(app, {
  // Run in order before the port opens.
  boot: [connectDB],
});
