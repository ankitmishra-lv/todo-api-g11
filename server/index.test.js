const { beforeEach, test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('./index');

beforeEach(() => {
  app.locals.todos.clear();
});

async function withServer(run) {
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, resolve);
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
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined
  };
}

async function createTodo(baseUrl, title) {
  const response = await request(baseUrl, '/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  assert.strictEqual(response.status, 201);
  return response.body;
}

async function updateTodo(baseUrl, id, patch) {
  const response = await request(baseUrl, `/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });

  assert.strictEqual(response.status, 200);
  return response.body;
}

async function listTodos(baseUrl) {
  const response = await request(baseUrl, '/api/todos');

  assert.strictEqual(response.status, 200);
  return response.body;
}

test('DELETE /api/todos/completed removes only completed todos', async () => {
  await withServer(async (baseUrl) => {
    const keep = await createTodo(baseUrl, 'keep this todo');
    const remove = await createTodo(baseUrl, 'remove this todo');
    await updateTodo(baseUrl, remove.id, { completed: true });

    const response = await request(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { deleted: 1 });

    const ids = (await listTodos(baseUrl)).map((todo) => todo.id);
    assert.ok(ids.includes(keep.id));
    assert.ok(!ids.includes(remove.id));
  });
});

test('DELETE /api/todos/completed returns the correct deleted count', async () => {
  await withServer(async (baseUrl) => {
    const keep = await createTodo(baseUrl, 'active todo');
    const removeOne = await createTodo(baseUrl, 'completed one');
    const removeTwo = await createTodo(baseUrl, 'completed two');
    await updateTodo(baseUrl, removeOne.id, { completed: true });
    await updateTodo(baseUrl, removeTwo.id, { completed: true });

    const response = await request(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { deleted: 2 });

    const ids = (await listTodos(baseUrl)).map((todo) => todo.id);
    assert.deepStrictEqual(ids, [keep.id]);
  });
});

test('DELETE /api/todos/completed returns deleted 0 when none are completed', async () => {
  await withServer(async (baseUrl) => {
    const todo = await createTodo(baseUrl, 'still active');

    const response = await request(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { deleted: 0 });

    const ids = (await listTodos(baseUrl)).map((item) => item.id);
    assert.deepStrictEqual(ids, [todo.id]);
  });
});

test('DELETE /api/todos/:id still deletes a single todo', async () => {
  await withServer(async (baseUrl) => {
    const todo = await createTodo(baseUrl, 'delete by id');

    const response = await request(baseUrl, `/api/todos/${todo.id}`, {
      method: 'DELETE'
    });
    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.body, undefined);

    const ids = (await listTodos(baseUrl)).map((item) => item.id);
    assert.ok(!ids.includes(todo.id));
  });
});
