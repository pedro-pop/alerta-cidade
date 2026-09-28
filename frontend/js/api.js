const API_BASE_URL = window.ALERTACIDADE_API_URL || 'http://localhost:3333/api';
const API_ORIGIN = new URL(API_BASE_URL).origin;
const TOKEN_KEY = 'ac_token';

function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveAccessToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function apiAssetUrl(path) {
  if (!path) return null;
  try {
    return new URL(path, `${API_ORIGIN}/`).href;
  } catch {
    return path;
  }
}

async function apiFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  if (getAccessToken()) headers.set('Authorization', `Bearer ${getAccessToken()}`);

  let body = options.body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    body = JSON.stringify(body);
  }
  if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, body });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o backend está ativo em localhost:3333.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    throw new Error(data?.message || data?.error || data?.detail || 'Erro ao comunicar com a API.');
  }
  return data;
}

async function apiRegister(credentials) {
  const data = await apiFetch('/auth/register', { method: 'POST', body: credentials });
  saveAccessToken(data.token);
  return data;
}

async function apiLogin(credentials) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: credentials });
  saveAccessToken(data.token);
  return data;
}

function apiLogout() {
  clearAccessToken();
}

async function apiMe() {
  return apiFetch('/auth/me');
}

async function apiGetDenuncias() {
  const all = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total) {
    const data = await apiFetch(`/denuncias?page=${page}&pageSize=100`);
    all.push(...(data.denuncias || []));
    total = data.total ?? all.length;
    if (!data.denuncias?.length) break;
    page += 1;
  }
  return all;
}

async function apiGetDenuncia(id) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}`);
}

async function apiCreateDenuncia(fields, media) {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.append(key, value);
  });
  if (media) {
    const file = await mediaToFile(media);
    body.append('media', file, file.name);
  }
  return apiFetch('/denuncias/', { method: 'POST', body });
}

async function apiLikeDenuncia(id) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/like`, { method: 'POST' });
}

async function apiConfirmResolved(id) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/confirm-resolved`, { method: 'POST' });
}

async function apiValidateDenuncia(id) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/validate`, { method: 'POST' });
}

async function apiRemoveDenuncia(id) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/remove`, { method: 'POST' });
}

async function apiSetDenunciaStatus(id, status) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

async function apiRespondToDenuncia(id, text) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/respond`, { method: 'POST', body: { text } });
}

async function apiCreateComment(id, text, parentId) {
  return apiFetch(`/denuncias/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: { text, ...(parentId ? { parentId } : {}) },
  });
}

async function apiDeleteComment(denunciaId, commentId) {
  return apiFetch(`/denuncias/${encodeURIComponent(denunciaId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
}

async function apiGetUsers() {
  return apiFetch('/users');
}

async function apiCreateUser(user) {
  return apiFetch('/users', { method: 'POST', body: user });
}

async function apiResetUserPassword(id, password) {
  return apiFetch(`/users/${encodeURIComponent(id)}/password`, { method: 'PATCH', body: { password } });
}

async function apiUpdateMyPhoto(photo) {
  const body = new FormData();
  body.append('photo', await mediaToFile({ url: photo, type: 'photo' }), 'profile-photo.jpg');
  return apiFetch('/users/me/photo', { method: 'PATCH', body });
}

async function apiGetNotifications() {
  return apiFetch('/notifications');
}

async function apiMarkNotificationRead(id) {
  return apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

async function apiMarkAllNotificationsRead() {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}

async function mediaToFile(media) {
  if (media.file instanceof File) return media.file;
  if (media.blob instanceof Blob) {
    return new File([media.blob], media.filename || 'media.webm', {
      type: media.blob.type || (media.type === 'video' ? 'video/webm' : 'image/jpeg'),
    });
  }
  if (media.url && !media.url.startsWith('data:')) {
    throw new Error('A mídia selecionada não está mais disponível. Selecione o arquivo novamente.');
  }
  const response = await fetch(media.url);
  const blob = await response.blob();
  const ext = blob.type.includes('video') ? 'webm' : (blob.type.split('/')[1] || 'jpg');
  return new File([blob], media.filename || `media.${ext}`, {
    type: blob.type || (media.type === 'video' ? 'video/webm' : 'image/jpeg'),
  });
}
