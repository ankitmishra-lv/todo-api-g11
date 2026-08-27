const form = document.querySelector('#todo-form');
const titleInput = document.querySelector('#todo-title');
const list = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const clearCompletedButton = document.querySelector('#clear-completed');
const errorMessage = document.querySelector('#error');
const submitButton = form.querySelector('button[type="submit"]');

let todos = [];
let initialized = false;

function setError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function render() {
  list.replaceChildren();

  for (const todo of todos) {
    const item = document.createElement('li');
    item.className = 'todo-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Mark "${todo.title}" ${todo.completed ? 'active' : 'completed'}`);
    checkbox.addEventListener('change', async () => {
      setError('');

      try {
        await toggleTodo(todo, checkbox.checked);
      } catch (error) {
        render();
        setError(error.message);
      }
    });

    const title = document.createElement('span');
    title.className = 'todo-title';
    title.textContent = todo.title;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      setError('');

      try {
        await deleteTodo(todo.id);
      } catch (error) {
        setError(error.message);
      }
    });

    item.toggleAttribute('data-completed', todo.completed);
    item.append(checkbox, title, deleteButton);
    list.append(item);
  }

  emptyState.hidden = todos.length > 0;
  clearCompletedButton.hidden = !todos.some((todo) => todo.completed);
}

function setComposerDisabled(disabled) {
  titleInput.disabled = disabled;
  submitButton.disabled = disabled;
}

async function loadTodos() {
  todos = await api('/api/todos');
  render();
}

async function addTodo(title) {
  const todo = await api('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title })
  });
  todos = [todo, ...todos];
  render();
}

async function toggleTodo(todo, completed) {
  const updated = await api(`/api/todos/${todo.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed })
  });
  todos = todos.map((item) => (item.id === updated.id ? updated : item));
  render();
}

async function deleteTodo(id) {
  await api(`/api/todos/${id}`, { method: 'DELETE' });
  todos = todos.filter((todo) => todo.id !== id);
  render();
}

async function clearCompleted() {
  await api('/api/todos/completed', { method: 'DELETE' });
  todos = todos.filter((todo) => !todo.completed);
  render();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');

  if (!initialized) {
    return;
  }

  const title = titleInput.value.trim();
  if (!title) {
    return;
  }

  try {
    await addTodo(title);
    form.reset();
    titleInput.focus();
  } catch (error) {
    setError(error.message);
  }
});

clearCompletedButton.addEventListener('click', async () => {
  setError('');

  try {
    await clearCompleted();
  } catch (error) {
    setError(error.message);
  }
});

setComposerDisabled(true);

loadTodos()
  .catch((error) => setError(error.message))
  .finally(() => {
    initialized = true;
    setComposerDisabled(false);
  });
