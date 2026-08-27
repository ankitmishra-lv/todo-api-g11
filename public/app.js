const fields = {
  total: document.querySelector('#total'),
  completed: document.querySelector('#completed'),
  active: document.querySelector('#active')
};

const refreshButton = document.querySelector('#refresh');
const statusText = document.querySelector('#status');

function setStatus(message) {
  statusText.textContent = message;
}

function renderStats(stats) {
  fields.total.textContent = stats.total;
  fields.completed.textContent = stats.completed;
  fields.active.textContent = stats.active;
}

async function fetchStats() {
  refreshButton.disabled = true;
  setStatus('Refreshing...');

  try {
    const response = await fetch('/api/todos/stats');
    if (!response.ok) {
      throw new Error(`Stats request failed with ${response.status}`);
    }

    renderStats(await response.json());
    setStatus('Stats updated.');
  } catch (error) {
    setStatus('Unable to load stats.');
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', fetchStats);
fetchStats();
