// Every page gets its data through this file.
//
// With NEXT_PUBLIC_API_URL empty, the functions answer from the sample data
// in lib/mock, so the app works on its own (this is how the Vercel demo runs).
// Set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local to use the
// FastAPI back-end instead. The endpoints are listed in docs/api-contract.md.

import { indexStats, search as sampleSearch } from './mock/engine';
import {
  DEFAULT_SETTINGS,
  sampleCrawlLog,
  sampleEvaluation,
  sampleOverview,
  sampleSeeds,
} from './mock/admin';
import { readToken } from './token';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export const usingSampleData = !API_URL;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const auth = token ?? readToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can’t reach the search server at ${API_URL}. Check that it’s running.`, 0);
  }
  if (res.ok) return res.status === 204 ? null : res.json();

  const data = await res.json().catch(() => ({}));
  const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
  throw new ApiError(detail || `The search server answered with error ${res.status}.`, res.status);
}

// ---------- Search (visitor) ----------

export async function searchPages(query, page = 1) {
  if (usingSampleData) return sampleSearch(query, { page });
  return request(`/api/search?q=${encodeURIComponent(query)}&page=${page}`, { token: '' });
}

export async function getIndexSummary() {
  if (usingSampleData) {
    const stats = indexStats();
    return { pages: stats.pages, sites: sampleSeeds().length };
  }
  return request('/api/stats', { token: '' });
}

// ---------- Admin sign-in ----------

export async function login(username, password) {
  if (usingSampleData) return { token: 'sample', username };
  return request('/api/auth/login', { method: 'POST', body: { username, password }, token: '' });
}

export async function logout() {
  if (usingSampleData) return null;
  return request('/api/auth/logout', { method: 'POST' });
}

// ---------- Admin (token is passed by server pages; the browser reads the cookie) ----------

export async function getOverview(token) {
  if (usingSampleData) return sampleOverview();
  return request('/api/admin/overview', { token });
}

export async function getCrawlLog(token) {
  if (usingSampleData) return sampleCrawlLog();
  return request('/api/admin/crawl/log', { token });
}

export async function getCrawlStatus(token) {
  if (usingSampleData) return null;
  return request('/api/admin/crawl/status', { token });
}

export async function startCrawl() {
  if (usingSampleData) return { state: 'running' };
  return request('/api/admin/crawl/start', { method: 'POST' });
}

export async function stopCrawl() {
  if (usingSampleData) return { state: 'stopping' };
  return request('/api/admin/crawl/stop', { method: 'POST' });
}

export async function rebuildIndex() {
  if (usingSampleData) return { ok: true };
  return request('/api/admin/index/rebuild', { method: 'POST' });
}

export async function recomputePageRank() {
  if (usingSampleData) return { ok: true };
  return request('/api/admin/pagerank/recompute', { method: 'POST' });
}

export async function getSeeds(token) {
  if (usingSampleData) return sampleSeeds();
  return request('/api/admin/seeds', { token });
}

export async function addSeed(url) {
  if (usingSampleData) {
    return { id: Date.now(), url, host: new URL(url).host, pages: 0, status: 'Waiting', lastCrawled: null };
  }
  return request('/api/admin/seeds', { method: 'POST', body: { url } });
}

export async function removeSeed(id) {
  if (usingSampleData) return null;
  return request(`/api/admin/seeds/${id}`, { method: 'DELETE' });
}

export async function getSettings(token) {
  if (usingSampleData) return DEFAULT_SETTINGS;
  return request('/api/admin/settings', { token });
}

export async function saveSettings(settings) {
  if (usingSampleData) return settings;
  return request('/api/admin/settings', { method: 'PUT', body: settings });
}

export async function getEvaluation(token) {
  if (usingSampleData) return sampleEvaluation();
  return request('/api/admin/evaluation', { token });
}
