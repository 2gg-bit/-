// 后端 API 封装
const BASE = '/api';

async function request(url, options) {
  const res = await fetch(BASE + url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

const json = (body) => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  getState: () => request('/state'),
  putSamples: (samples) => request('/samples', json({ samples })),
  putStaff: (staff) => request('/staff', json({ staff })),
  putTasks: (tasks) => request('/tasks', json({ tasks })),
  generateSchedule: (tasks) =>
    request('/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks }) }),
  saveSchedule: () => request('/schedule/save', { method: 'POST' }),
  clearHistory: () => request('/history', { method: 'DELETE' }),
  reset: () => request('/reset', { method: 'POST' }),
  predict: (tasks) =>
    request('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks }) }),
};
