export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { data = { error: 'Invalid response' }; }
  if (!res.ok) throw new Error((data && data.error) || `Error (${res.status})`);
  return data;
}