import { readFileSync } from 'node:fs';
import path from 'node:path';

const SHUTDOWN_TIMEOUT_MS = 10000;
const hooks = [];
let stopping = false;
let processEventsHandled = false;

// Core modules register their cleanup here, so the app never has to list them.
// phase 'stop' runs first (stop taking new work: HTTP server, queue worker),
// phase 'cleanup' runs after it (close connections: database, Redis).
export function onShutdown(fn, phase = 'cleanup') {
  if (!['stop', 'cleanup'].includes(phase)) throw new TypeError("onShutdown phase must be 'stop' or 'cleanup'");
  hooks.push({ fn, phase });
}

export const isStopping = () => stopping;

// The app's package.json name; used as the default Redis key prefix.
export function appName() {
  try {
    return JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')).name || 'app';
  } catch {
    return 'app';
  }
}

export async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  timer.unref();
  try {
    // A failing hook never skips the others: every connection still gets closed.
    const errors = [];
    for (const phase of ['stop', 'cleanup']) {
      const results = await Promise.allSettled(hooks.filter((hook) => hook.phase === phase).map((hook) => hook.fn()));
      for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
    }
    if (errors.length) throw errors[0];
    process.exitCode = code;
  } catch (error) {
    console.error('Shutdown failed:', error.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    // AdminJS's dev file watcher keeps the event loop alive, so exit explicitly
    // instead of waiting for it to drain (otherwise node --watch restarts hang).
    process.exit();
  }
}

// Ctrl+C, deploys and unexpected errors all go through shutdown().
export function handleProcessEvents() {
  if (processEventsHandled) return;
  processEventsHandled = true;
  process.once('SIGINT', () => shutdown());
  process.once('SIGTERM', () => shutdown());
  // Without these, an unexpected error kills the process without closing DB, Redis and open requests.
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    void shutdown(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    void shutdown(1);
  });
}

// Runs the boot steps (e.g. config checks, database connect), then opens the HTTP port.
export async function startServer(app, { port = process.env.PORT || 3000, boot = [] } = {}) {
  handleProcessEvents();
  const PORT = Number(port);
  try {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be between 1 and 65535');
    for (const step of boot) await step();
    if (stopping) return;
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (app.locals.adminPath) console.log(`Admin panel at http://localhost:${PORT}${app.locals.adminPath}`);
    });
    onShutdown(() => server.listening && new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), 'stop');
    server.on('error', (error) => {
      console.error('HTTP server failed:', error.message);
      void shutdown(1);
    });
    return server;
  } catch (error) {
    console.error('Startup failed:', error.message);
    await shutdown(1);
  }
}
