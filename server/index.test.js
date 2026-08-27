const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('./index');

async function withApi(run) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, () => resolve(instance));
    instance.on('error', reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await clearAllTodos(baseUrl);
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

async function requestJson(baseUrl, path, options = {}) {
  const headers = { ...options.headers };
  const init = { ...options, headers };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body, text };
}

async function createTodo(baseUrl, title) {
  const { response, body } = await requestJson(baseUrl, '/api/todos', {
    method: 'POST',
    body: { title }
  });

  assert.equal(response.status, 201);
  return body;
}

async function updateTodo(baseUrl, id, changes) {
  const { response, body } = await requestJson(baseUrl, `/api/todos/${id}`, {
    method: 'PATCH',
    body: changes
  });

  assert.equal(response.status, 200);
  return body;
}

async function listTodos(baseUrl) {
  const { response, body } = await requestJson(baseUrl, '/api/todos');

  assert.equal(response.status, 200);
  return body;
}

async function clearAllTodos(baseUrl) {
  const todos = await listTodos(baseUrl);

  await Promise.all(todos.map(async (todo) => {
    const { response } = await requestJson(baseUrl, `/api/todos/${todo.id}`, {
      method: 'DELETE'
    });
    assert.ok(response.status === 204 || response.status === 404);
  }));
}

test('DELETE /api/todos/completed removes only completed todos', async () => {
  await withApi(async (baseUrl) => {
    const active = await createTodo(baseUrl, 'keep this');
    const completed = await createTodo(baseUrl, 'remove this');

    await updateTodo(baseUrl, completed.id, { completed: true });

    const { response, body } = await requestJson(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { deleted: 1 });

    const remaining = await listTodos(baseUrl);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, active.id);
    assert.equal(remaining[0].completed, false);
  });
});

test('DELETE /api/todos/completed returns the correct deleted count', async () => {
  await withApi(async (baseUrl) => {
    const doneOne = await createTodo(baseUrl, 'done one');
    const doneTwo = await createTodo(baseUrl, 'done two');
    const doneThree = await createTodo(baseUrl, 'done three');
    const active = await createTodo(baseUrl, 'still active');

    await updateTodo(baseUrl, doneOne.id, { completed: true });
    await updateTodo(baseUrl, doneTwo.id, { completed: true });
    await updateTodo(baseUrl, doneThree.id, { completed: true });

    const { response, body } = await requestJson(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { deleted: 3 });

    const remaining = await listTodos(baseUrl);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, active.id);
  });
});

test('DELETE /api/todos/completed returns deleted 0 when no todos are completed', async () => {
  await withApi(async (baseUrl) => {
    const first = await createTodo(baseUrl, 'first active');
    const second = await createTodo(baseUrl, 'second active');

    const { response, body } = await requestJson(baseUrl, '/api/todos/completed', {
      method: 'DELETE'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { deleted: 0 });

    const remaining = await listTodos(baseUrl);
    const remainingIds = remaining.map((todo) => todo.id).sort();
    const expectedIds = [first.id, second.id].sort();
    assert.deepEqual(remainingIds, expectedIds);
  });
});

test('DELETE /api/todos/:id still deletes a single todo', async () => {
  await withApi(async (baseUrl) => {
    const todo = await createTodo(baseUrl, 'single delete');

    const { response, text } = await requestJson(baseUrl, `/api/todos/${todo.id}`, {
      method: 'DELETE'
    });
    assert.equal(response.status, 204);
    assert.equal(text, '');

    const remaining = await listTodos(baseUrl);
    assert.equal(remaining.some((item) => item.id === todo.id), false);
  });
});
