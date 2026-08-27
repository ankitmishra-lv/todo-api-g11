const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');
const test = require('node:test');

const app = require('../server');

const execFileAsync = promisify(execFile);
const rootDir = path.join(__dirname, '..');

function resetTodos() {
  app.locals.todos.clear();
}

async function withServer(fn) {
  resetTodos();

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn(baseUrl);
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
    resetTodos();
  }
}

async function requestJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let body = null;
  if (response.status !== 204) {
    body = await response.json();
  }

  return { response, body };
}

async function createTodo(baseUrl, title) {
  const { response, body } = await requestJson(baseUrl, '/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  assert.equal(response.status, 201);
  return body;
}

async function patchTodo(baseUrl, id, payload) {
  const { response, body } = await requestJson(baseUrl, `/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  assert.equal(response.status, 200);
  return body;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('GET /api/todos starts empty and lists newest todos first', async () => {
  await withServer(async (baseUrl) => {
    const empty = await requestJson(baseUrl, '/api/todos');
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.body, []);

    const first = await createTodo(baseUrl, 'first task');
    await delay(10);
    const second = await createTodo(baseUrl, 'second task');

    const list = await requestJson(baseUrl, '/api/todos');
    assert.equal(list.response.status, 200);
    assert.deepEqual(
      list.body.map((todo) => todo.id),
      [second.id, first.id]
    );
  });
});

test('POST /api/todos trims valid titles and rejects invalid titles', async () => {
  await withServer(async (baseUrl) => {
    const created = await createTodo(baseUrl, '  trim me  ');
    assert.equal(created.title, 'trim me');
    assert.equal(created.completed, false);
    assert.match(created.id, /^[0-9a-f-]{36}$/i);
    assert.doesNotThrow(() => new Date(created.createdAt).toISOString());

    for (const title of ['', '   ']) {
      const { response, body } = await requestJson(baseUrl, '/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title })
      });

      assert.equal(response.status, 400);
      assert.deepEqual(body, { error: 'title is required' });
    }
  });
});

test('PATCH /api/todos/:id updates title and completed fields with validation', async () => {
  await withServer(async (baseUrl) => {
    const todo = await createTodo(baseUrl, 'original');

    const updated = await patchTodo(baseUrl, todo.id, {
      title: '  renamed  ',
      completed: true
    });
    assert.equal(updated.title, 'renamed');
    assert.equal(updated.completed, true);

    const invalidTitle = await requestJson(baseUrl, `/api/todos/${todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: '   ' })
    });
    assert.equal(invalidTitle.response.status, 400);
    assert.deepEqual(invalidTitle.body, { error: 'title must be a non-empty string' });

    const invalidCompleted = await requestJson(baseUrl, `/api/todos/${todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: 'yes' })
    });
    assert.equal(invalidCompleted.response.status, 400);
    assert.deepEqual(invalidCompleted.body, { error: 'completed must be a boolean' });

    const missing = await requestJson(baseUrl, '/api/todos/missing-id', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true })
    });
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, { error: 'Todo not found' });
  });
});

test('DELETE /api/todos/completed returns deleted count and keeps active todos', async () => {
  await withServer(async (baseUrl) => {
    const active = await createTodo(baseUrl, 'active');
    const completedOne = await createTodo(baseUrl, 'done one');
    const completedTwo = await createTodo(baseUrl, 'done two');

    await patchTodo(baseUrl, completedOne.id, { completed: true });
    await patchTodo(baseUrl, completedTwo.id, { completed: true });

    const deleted = await requestJson(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.equal(deleted.response.status, 200);
    assert.deepEqual(deleted.body, { deleted: 2 });

    const remaining = await requestJson(baseUrl, '/api/todos');
    assert.equal(remaining.response.status, 200);
    assert.deepEqual(remaining.body.map((todo) => todo.id), [active.id]);
    assert.equal(remaining.body[0].completed, false);
  });
});

test('DELETE /api/todos/completed is registered before DELETE /api/todos/:id', async () => {
  await withServer(async (baseUrl) => {
    const deleted = await requestJson(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });

    assert.equal(deleted.response.status, 200);
    assert.deepEqual(deleted.body, { deleted: 0 });
  });
});

test('DELETE /api/todos/:id still deletes one todo and returns 404 for unknown ids', async () => {
  await withServer(async (baseUrl) => {
    const todo = await createTodo(baseUrl, 'delete me');

    const deleted = await fetch(`${baseUrl}/api/todos/${todo.id}`, {
      method: 'DELETE'
    });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');

    const list = await requestJson(baseUrl, '/api/todos');
    assert.deepEqual(list.body, []);

    const missing = await requestJson(baseUrl, '/api/todos/missing-id', {
      method: 'DELETE'
    });
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, { error: 'Todo not found' });
  });
});

test('Express serves static files from public', async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /id="clear-completed"/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.match(await script.text(), /\/api\/todos\/completed/);

    const styles = await fetch(`${baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get('content-type'), /text\/css/);
  });
});

test('requiring the server module does not bind a listening port', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['-e', 'require("./server/index.js"); console.log("loaded")'],
    { cwd: rootDir, timeout: 1500 }
  );

  assert.equal(stdout, 'loaded\n');
});
