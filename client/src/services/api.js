const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('Could not reach the case archive. Check that the server is running, then retry.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error?.message || 'Something went wrong. Please try again.');
  return payload.data;
}

export const api = {
  createCase: (payload) => request('/cases', { method: 'POST', body: JSON.stringify(payload) }),
  getCase: (id) => request(`/cases/${encodeURIComponent(id)}`),
  getResult: (id) => request(`/cases/${encodeURIComponent(id)}/result`),
  submitAccusation: (id, payload) => request(`/cases/${encodeURIComponent(id)}/accusation`, { method: 'POST', body: JSON.stringify(payload) }),
};
