import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { errorHandler } from '../src/middlewares/errorHandler.js';

// Importing the SQL models needs a URL, but these tests never connect to a DB.
process.env.NODE_ENV = 'production';
process.env.DB_URI ||= 'postgres://postgres:password@127.0.0.1:5432/exg_test';
process.env.DATABASE_URL ||= 'postgresql://postgres:password@127.0.0.1:5432/exg_test';
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/exg_test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
const { default: app } = await import('../src/app.js');

let server;
let baseURL;
let errorServer;
let errorURL;

async function listen(application) {
  const instance = application.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    instance.once('listening', resolve);
    instance.once('error', reject);
  });
  return { instance, url: `http://127.0.0.1:${instance.address().port}` };
}

function close(instance) {
  if (!instance) return Promise.resolve();
  return new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()));
}

before(async () => {
  ({ instance: server, url: baseURL } = await listen(app));
  const errors = express();
  errors.get('/duplicate/:orm', (req, res, next) => {
    const error = new Error('Private SQL statement or MongoDB document');
    if (req.params.orm === 'prisma') error.code = 'P2002';
    if (req.params.orm === 'mongoose') error.code = 11000;
    if (req.params.orm === 'sequelize') error.name = 'SequelizeUniqueConstraintError';
    next(error);
  });
  errors.get('/unexpected', (req, res, next) => {
    next(new Error('postgres://secret:password@private-host/database'));
  });
  errors.get('/invalid-status', (req, res, next) => {
    next(Object.assign(new Error('Internal failure'), { statusCode: 900 }));
  });
  errors.use(errorHandler);
  ({ instance: errorServer, url: errorURL } = await listen(errors));
});

after(async () => {
  await Promise.all([close(server), close(errorServer)]);
});

const post = (body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(`${baseURL}/api/users`, { method: 'POST', headers, body });

test('health endpoint works without a database connection', async () => {
  const response = await fetch(`${baseURL}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test('security headers are sent and framework branding is hidden', async () => {
  const response = await fetch(`${baseURL}/api/health`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  await response.arrayBuffer();
});

test('configured browser origin receives CORS permission', async () => {
  const response = await fetch(`${baseURL}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  await response.arrayBuffer();
});

test('unconfigured browser origin does not receive CORS permission', async () => {
  const response = await fetch(`${baseURL}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  await response.arrayBuffer();
});

test('unknown routes return the JSON error envelope', async () => {
  const response = await fetch(`${baseURL}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, message: 'Route not found' });
});

test('missing fields return 422 with actionable field errors', async () => {
  const response = await post('{}');
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.ok(body.errors.some((error) => error.path.includes('name')));
  assert.ok(body.errors.some((error) => error.path.includes('email')));
});

test('whitespace-only names and malformed emails are rejected', async () => {
  const response = await post(JSON.stringify({ name: '   ', email: 'not-an-email' }));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.errors.length, 2);
});

test('wrong field types and arrays are rejected before database access', async () => {
  for (const body of [{ name: 123, email: false }, []]) {
    const response = await post(JSON.stringify(body));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).success, false);
  }
});

test('malformed JSON returns 400 instead of an internal server error', async () => {
  const response = await post('{"name":');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, message: 'Invalid JSON body' });
});

test('oversized request bodies are rejected with 413', async () => {
  const response = await post(JSON.stringify({ name: 'a'.repeat(105 * 1024), email: 'ali@example.com' }));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { success: false, message: 'Request body too large' });
});

for (const orm of ['prisma', 'mongoose', 'sequelize']) {
  test(`${orm} duplicate email errors produce a safe 409 response`, async () => {
    const response = await fetch(`${errorURL}/duplicate/${orm}`);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { success: false, message: 'Email already exists' });
  });
}

test('production errors hide credentials, internal messages, and stack traces', async (context) => {
  context.mock.method(console, 'error', () => {});
  const response = await fetch(`${errorURL}/unexpected`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, message: 'Internal Server Error' });
});

test('invalid exception status codes fall back to a valid 500 response', async (context) => {
  context.mock.method(console, 'error', () => {});
  const response = await fetch(`${errorURL}/invalid-status`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, message: 'Internal Server Error' });
});
