const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../server');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function baseUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function api(server, path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  return fetch(`${baseUrl(server)}${path}`, {
    ...options,
    headers
  });
}

async function createTodo(server, title) {
  const response = await api(server, '/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  assert.equal(response.status, 201);
  return response.json();
}

async function setCompleted(server, id, completed) {
  const response = await api(server, `/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed })
  });

  assert.equal(response.status, 200);
  return response.json();
}

async function clearTodos(server) {
  const listResponse = await api(server, '/api/todos');
  assert.equal(listResponse.status, 200);

  const todos = await listResponse.json();
  await Promise.all(todos.map((todo) => api(server, `/api/todos/${todo.id}`, { method: 'DELETE' })));
}

test('GET /api/todos/stats returns counts for mixed todos', async (t) => {
  const server = await startServer();
  t.after(() => closeServer(server));
  await clearTodos(server);

  const first = await createTodo(server, 'Buy milk');
  await createTodo(server, 'Write tests');
  await createTodo(server, 'Ship feature');
  await setCompleted(server, first.id, true);

  const response = await api(server, '/api/todos/stats');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    total: 3,
    completed: 1,
    active: 2
  });

  await clearTodos(server);
});

test('GET /api/todos/stats returns zeros when there are no todos', async (t) => {
  const server = await startServer();
  t.after(() => closeServer(server));
  await clearTodos(server);

  const response = await api(server, '/api/todos/stats');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    total: 0,
    completed: 0,
    active: 0
  });
});
