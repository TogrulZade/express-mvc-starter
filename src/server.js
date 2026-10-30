import 'dotenv/config';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import cache from './services/cache.js';

const PORT = Number(process.env.PORT || 3000);
let server;
let stopping = false;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  try {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const results = await Promise.allSettled([disconnectDB(), cache.close()]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    process.exitCode = code;
  } catch (error) {
    console.error('Shutdown failed:', error.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());

try {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be between 1 and 65535');
  await connectDB();
  if (stopping) {
    await disconnectDB();
  } else {
    server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    server.on('error', (error) => {
      console.error('HTTP server failed:', error.message);
      void shutdown(1);
    });
  }
} catch (error) {
  console.error('Startup failed:', error.message);
  await shutdown(1);
}
