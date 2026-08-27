const assert = require('node:assert');
const { test } = require('node:test');

const app = require('./index');

async function withServer(run) {
  app.locals.resetTodos();

  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
    listeningServer.on('error', reject);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    app.locals.resetTodos();
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const requestOptions = { method: options.method || 'GET' };

  if (options.body !== undefined) {
    requestOptions.headers = { 'content-type': 'application/json' };
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, requestOptions);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { body, response, text };
}

async function requestText(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  return { response, text };
}

async function createTodo(baseUrl, title) {
  const result = await requestJson(baseUrl, '/api/todos', {
    method: 'POST',
    body: { title }
  });

  assert.strictEqual(result.response.status, 201);
  assert.strictEqual(result.body.title, title);
  assert.strictEqual(result.body.completed, false);

  return result.body;
}

async function completeTodo(baseUrl, id) {
  const result = await requestJson(baseUrl, `/api/todos/${id}`, {
    method: 'PATCH',
    body: { completed: true }
  });

  assert.strictEqual(result.response.status, 200);
  assert.strictEqual(result.body.id, id);
  assert.strictEqual(result.body.completed, true);

  return result.body;
}

async function listTodos(baseUrl) {
  const result = await requestJson(baseUrl, '/api/todos');

  assert.strictEqual(result.response.status, 200);
  assert.ok(Array.isArray(result.body));

  return result.body;
}

test('todos API', async (t) => {
  await t.test('clear completed removes only completed todos', async () => {
    await withServer(async (baseUrl) => {
      const activeOne = await createTodo(baseUrl, 'active one');
      const completed = await createTodo(baseUrl, 'completed');
      const activeTwo = await createTodo(baseUrl, 'active two');

      await completeTodo(baseUrl, completed.id);

      const result = await requestJson(baseUrl, '/api/todos/completed', {
        method: 'DELETE'
      });

      assert.strictEqual(result.response.status, 200);
      assert.deepStrictEqual(result.body, { deleted: 1 });

      const remaining = await listTodos(baseUrl);
      assert.deepStrictEqual(
        new Set(remaining.map((todo) => todo.id)),
        new Set([activeOne.id, activeTwo.id])
      );
      assert.ok(remaining.every((todo) => todo.completed === false));
    });
  });

  await t.test('clear completed returns the correct deleted count', async () => {
    await withServer(async (baseUrl) => {
      const first = await createTodo(baseUrl, 'first completed');
      const second = await createTodo(baseUrl, 'second completed');
      const third = await createTodo(baseUrl, 'third completed');
      const active = await createTodo(baseUrl, 'still active');

      await completeTodo(baseUrl, first.id);
      await completeTodo(baseUrl, second.id);
      await completeTodo(baseUrl, third.id);

      const result = await requestJson(baseUrl, '/api/todos/completed', {
        method: 'DELETE'
      });

      assert.strictEqual(result.response.status, 200);
      assert.deepStrictEqual(result.body, { deleted: 3 });

      const remaining = await listTodos(baseUrl);
      assert.deepStrictEqual(remaining.map((todo) => todo.id), [active.id]);
    });
  });

  await t.test('clear completed returns deleted 0 when none are completed', async () => {
    await withServer(async (baseUrl) => {
      const active = await createTodo(baseUrl, 'active todo');

      const result = await requestJson(baseUrl, '/api/todos/completed', {
        method: 'DELETE'
      });

      assert.strictEqual(result.response.status, 200);
      assert.deepStrictEqual(result.body, { deleted: 0 });

      const remaining = await listTodos(baseUrl);
      assert.deepStrictEqual(remaining.map((todo) => todo.id), [active.id]);
    });
  });

  await t.test('deleting a single todo by id still works', async () => {
    await withServer(async (baseUrl) => {
      const deletedTodo = await createTodo(baseUrl, 'delete this todo');
      const remainingTodo = await createTodo(baseUrl, 'keep this todo');

      const result = await requestJson(baseUrl, `/api/todos/${deletedTodo.id}`, {
        method: 'DELETE'
      });

      assert.strictEqual(result.response.status, 204);
      assert.strictEqual(result.text, '');
      assert.strictEqual(result.body, null);

      const remaining = await listTodos(baseUrl);
      assert.deepStrictEqual(remaining.map((todo) => todo.id), [remainingTodo.id]);
    });
  });

  await t.test('serves static files from public', async () => {
    await withServer(async (baseUrl) => {
      const result = await requestText(baseUrl, '/');

      assert.strictEqual(result.response.status, 200);
      assert.match(result.response.headers.get('content-type'), /^text\/html/);
      assert.match(result.text, /<title>Todos<\/title>/);
    });
  });
});
