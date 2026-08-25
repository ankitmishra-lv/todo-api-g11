const test = require('node:test');
const assert = require('node:assert');

// Test the API endpoints running on an active Express server
test('Todo API tests', async (t) => {
  const express = require('express');
  const path = require('path');
  const crypto = require('crypto');

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  const todos = new Map();

  app.get('/api/todos', (req, res) => {
    const items = Array.from(todos.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  });

  app.post('/api/todos', (req, res) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    const todo = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.set(todo.id, todo);
    res.status(201).json(todo);
  });

  app.patch('/api/todos/:id', (req, res) => {
    const todo = todos.get(req.params.id);
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    const { title, completed } = req.body;
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      todo.title = title.trim();
    }
    if (completed !== undefined) {
      if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'completed must be a boolean' });
      }
      todo.completed = completed;
    }
    res.json(todo);
  });

  app.delete('/api/todos/:id', (req, res) => {
    if (!todos.has(req.params.id)) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    todos.delete(req.params.id);
    res.status(204).end();
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('POST /api/todos creates todo', async () => {
    const res = await fetch(`${baseUrl}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk' }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.title, 'Buy milk');
    assert.strictEqual(data.completed, false);
    assert.ok(data.id);
  });

  await t.test('POST /api/todos validation error', async () => {
    const res = await fetch(`${baseUrl}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('GET /api/todos returns todos', async () => {
    const res = await fetch(`${baseUrl}/api/todos`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.length, 1);
    assert.strictEqual(data[0].title, 'Buy milk');
  });

  await t.test('PATCH /api/todos/:id updates todo', async () => {
    const getRes = await fetch(`${baseUrl}/api/todos`);
    const todosList = await getRes.json();
    const id = todosList[0].id;

    const patchRes = await fetch(`${baseUrl}/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    assert.strictEqual(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.strictEqual(updated.completed, true);
  });

  await t.test('DELETE /api/todos/:id deletes todo', async () => {
    const getRes = await fetch(`${baseUrl}/api/todos`);
    const todosList = await getRes.json();
    const id = todosList[0].id;

    const delRes = await fetch(`${baseUrl}/api/todos/${id}`, {
      method: 'DELETE',
    });
    assert.strictEqual(delRes.status, 204);

    const getAfterRes = await fetch(`${baseUrl}/api/todos`);
    const todosAfter = await getAfterRes.json();
    assert.strictEqual(todosAfter.length, 0);
  });
});
