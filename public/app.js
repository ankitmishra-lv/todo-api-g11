const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-title');
const list = document.querySelector('#todo-list');
const count = document.querySelector('#todo-count');
const emptyState = document.querySelector('#empty-state');
const errorMessage = document.querySelector('#error-message');
const clearCompletedButton = document.querySelector('#clear-completed');

const state = {
  clearingCompleted: false,
  pendingTodoIds: new Set(),
  saving: false,
  todos: []
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body && body.error && body.error.message
      ? body.error.message
      : body && body.error
        ? body.error
        : 'Request failed';
    throw new Error(message);
  }

  return body;
}

function showError(error) {
  errorMessage.textContent = error.message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.hidden = true;
}

function todoCountText(activeCount, completedCount) {
  if (state.todos.length === 0) {
    return '0 todos';
  }

  const activeLabel = activeCount === 1 ? '1 active' : `${activeCount} active`;
  const completedLabel = completedCount === 1 ? '1 completed' : `${completedCount} completed`;
  return `${activeLabel} / ${completedLabel}`;
}

function render() {
  const sortedTodos = [...state.todos].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const completedCount = sortedTodos.filter((todo) => todo.completed).length;
  const activeCount = sortedTodos.length - completedCount;

  count.textContent = todoCountText(activeCount, completedCount);
  emptyState.hidden = sortedTodos.length !== 0;
  list.replaceChildren(...sortedTodos.map(renderTodo));

  clearCompletedButton.hidden = completedCount === 0;
  clearCompletedButton.disabled = state.clearingCompleted;
  clearCompletedButton.textContent = state.clearingCompleted
    ? 'Clearing...'
    : `Clear completed (${completedCount})`;
}

function renderTodo(todo) {
  const item = document.createElement('li');
  item.className = 'todo-item';
  item.dataset.completed = String(todo.completed);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.completed;
  checkbox.disabled = state.pendingTodoIds.has(todo.id);
  checkbox.setAttribute(
    'aria-label',
    todo.completed ? `Mark "${todo.title}" active` : `Mark "${todo.title}" complete`
  );
  checkbox.addEventListener('change', () => toggleTodo(todo));

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = todo.title;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'icon-button';
  deleteButton.textContent = 'Delete';
  deleteButton.disabled = state.pendingTodoIds.has(todo.id);
  deleteButton.setAttribute('aria-label', `Delete "${todo.title}"`);
  deleteButton.addEventListener('click', () => deleteTodo(todo.id));

  item.append(checkbox, title, deleteButton);
  return item;
}

async function loadTodos() {
  clearError();
  state.todos = await api('/api/todos');
  render();
}

async function addTodo(title) {
  state.saving = true;
  form.querySelector('button').disabled = true;

  try {
    await api('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    input.value = '';
    await loadTodos();
  } catch (error) {
    showError(error);
  } finally {
    state.saving = false;
    form.querySelector('button').disabled = false;
    input.focus();
  }
}

async function toggleTodo(todo) {
  state.pendingTodoIds.add(todo.id);
  render();

  try {
    const updatedTodo = await api(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !todo.completed })
    });
    state.todos = state.todos.map((currentTodo) =>
      currentTodo.id === updatedTodo.id ? updatedTodo : currentTodo
    );
    clearError();
  } catch (error) {
    showError(error);
  } finally {
    state.pendingTodoIds.delete(todo.id);
    render();
  }
}

async function deleteTodo(id) {
  state.pendingTodoIds.add(id);
  render();

  try {
    await api(`/api/todos/${id}`, { method: 'DELETE' });
    state.todos = state.todos.filter((todo) => todo.id !== id);
    clearError();
  } catch (error) {
    showError(error);
  } finally {
    state.pendingTodoIds.delete(id);
    render();
  }
}

async function clearCompleted() {
  state.clearingCompleted = true;
  render();

  try {
    await api('/api/todos/completed', { method: 'DELETE' });
    await loadTodos();
  } catch (error) {
    showError(error);
  } finally {
    state.clearingCompleted = false;
    render();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = input.value.trim();
  if (!title || state.saving) {
    return;
  }

  addTodo(title);
});

clearCompletedButton.addEventListener('click', () => {
  if (!state.clearingCompleted) {
    clearCompleted();
  }
});

loadTodos().catch(showError);
