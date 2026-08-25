document.addEventListener('DOMContentLoaded', () => {
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');

  async function fetchTodos() {
    try {
      const res = await fetch('/api/todos');
      const todos = await res.json();
      renderTodos(todos);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
    }
  }

  function renderTodos(todos) {
    todoList.innerHTML = '';
    todos.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'todo-item';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'todo-content';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

      const titleSpan = document.createElement('span');
      titleSpan.className = `todo-title ${todo.completed ? 'completed' : ''}`;
      titleSpan.textContent = todo.title;

      contentDiv.appendChild(checkbox);
      contentDiv.appendChild(titleSpan);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

      li.appendChild(contentDiv);
      li.appendChild(deleteBtn);
      todoList.appendChild(li);
    });
  }

  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        todoInput.value = '';
        fetchTodos();
      }
    } catch (err) {
      console.error('Failed to create todo:', err);
    }
  });

  async function toggleTodo(id, completed) {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      fetchTodos();
    } catch (err) {
      console.error('Failed to update todo:', err);
    }
  }

  async function deleteTodo(id) {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      fetchTodos();
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  }

  fetchTodos();
});
