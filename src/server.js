import 'dotenv/config';
import { startServer } from '@st/core';
import { connectDB } from '@st/database';
import User from './models/User.js';
import app from './app.js';

// Graceful shutdown (Ctrl+C, SIGTERM, unexpected errors) is handled by @st/core:
// it closes the HTTP server, cache and database for you.
await startServer(app, {
  // Run in order before the port opens.
  boot: [
    connectDB,
    // Ensure the unique email index exists before accepting writes.
    async () => { await User.init(); await User.createIndexes(); },
  ],
});
