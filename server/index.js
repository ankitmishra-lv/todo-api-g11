const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const todos = new Map();
app.locals.todos = todos;

// GET /api/todos - list all todos, newest first
app.get('/api/todos', (req, res) => {
  const items = Array.from(todos.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

// POST /api/todos - create a todo
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

// PATCH /api/todos/:id - update a todo
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

// DELETE /api/todos/completed - delete completed todos
app.delete('/api/todos/completed', (req, res) => {
  let deleted = 0;

  for (const [id, todo] of todos) {
    if (todo.completed) {
      todos.delete(id);
      deleted += 1;
    }
  }

  res.json({ deleted });
});

// DELETE /api/todos/:id - delete a todo
app.delete('/api/todos/:id', (req, res) => {
  if (!todos.has(req.params.id)) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  todos.delete(req.params.id);
  res.status(204).end();
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Todo API server listening on port ${PORT}`);
  });
}

module.exports = app;
