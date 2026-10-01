const CATEGORIES = {
  buraco: { label: 'Buraco na via', icon: '🕳️' },
  iluminacao: { label: 'Iluminação', icon: '💡' },
  semaforo: { label: 'Semáforo', icon: '🚦' },
  lixo: { label: 'Lixo / Entulho', icon: '🗑️' },
  seguranca: { label: 'Segurança', icon: '🛡️' },
};

const STATUSES = {
  aberto: { label: 'Aberto', cls: 'st-aberto' },
  em_analise: { label: 'Em análise', cls: 'st-analise' },
  em_andamento: { label: 'Em andamento', cls: 'st-andamento' },
  resolvido: { label: 'Resolvido', cls: 'st-resolvido' },
  rejeitado: { label: 'Rejeitado', cls: 'st-rejeitado' },
};

const ROLE_LABELS = {
  cidadao: 'Cidadão',
  moderador: 'Moderador',
  admin: 'Administrador',
  superadmin: 'Super Admin',
};

const DRAFT_TTL_MS = 30 * 60 * 1000;
const DRAFT_PREFIX = 'ac_draft_';
['ac_users', 'ac_denuncias', 'ac_session', 'ac_notifications', 'ac_current_user', 'ac_access_token']
  .forEach(key => localStorage.removeItem(key));
let usersCache = [];
let denunciasCache = [];
let notificationsCache = [];
let signedInUser = null;
let usersLoaded = false;

function formatDate(iso) {
  const date = new Date(iso);
  return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toUiEnum(value) {
  return String(value || '').toLowerCase();
}

function toApiEnum(value) {
  return String(value || '').toUpperCase();
}

function normalizeUser(user) {
  if (!user) return null;
  const role = toUiEnum(user.role);
  const photo = apiAssetUrl(user.photoUrl || user.photo_url || user.photo || null);
  return {
    ...user,
    role,
    email: user.email || user.authUser?.email || '',
    createdAt: user.createdAt || user.created_at || null,
    photo,
    photoUrl: photo,
  };
}

function normalizeComment(comment) {
  const author = comment.author || comment.profiles || {};
  return {
    id: comment.id,
    parentId: comment.parentId || comment.parent_id || null,
    authorId: comment.authorId || comment.user_id || author.id,
    authorName: comment.authorName || author.name || 'Usuário',
    authorPhoto: apiAssetUrl(author.photoUrl || author.photo_url || null),
    text: comment.text || comment.content || '',
    createdAt: comment.createdAt || comment.created_at,
  };
}

function normalizeDenuncia(raw, comments) {
  const author = raw.author || {};
  const media = raw.media || null;
  const count = Number(raw.likesCount || 0);
  const liked = !!raw.likedByMe;
  const likes = Array.from({ length: count }, (_, index) =>
    liked && index === 0 ? (signedInUser && signedInUser.id) || 'me' : `like-${index}`
  );
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    category: toUiEnum(raw.category),
    location: raw.location,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    status: toUiEnum(raw.status),
    validated: !!raw.validated,
    removido: !!raw.removed,
    confirmedResolved: !!raw.confirmedResolved,
    createdAt: raw.createdAt,
    authorId: raw.authorId || author.id,
    authorName: author.name || raw.authorName || 'Usuário',
    authorPhoto: apiAssetUrl(author.photoUrl || author.photo_url || null),
    media: media ? {
      ...media,
      type: toUiEnum(media.type),
      url: apiAssetUrl(media.url),
    } : null,
    likes,
    likedByMe: liked,
    comments: (comments || []).map(normalizeComment),
    commentsCount: raw.commentsCount || (comments || []).length,
    officialResponse: raw.officialResponse ? {
      ...raw.officialResponse,
      authorName: raw.officialResponse.authorName || raw.officialResponse.author?.name || 'Equipe responsável',
      date: raw.officialResponse.createdAt || raw.officialResponse.date,
    } : null,
  };
}

function currentUser() {
  return signedInUser;
}

function getUsers() {
  return usersCache;
}

function getDenuncias() {
  return denunciasCache;
}

function getDenunciaById(id) {
  return denunciasCache.find(denuncia => denuncia.id === id) || null;
}

function findUserById(id) {
  return usersCache.find(user => user.id === id) || (signedInUser?.id === id ? signedInUser : null);
}

function getUserNotifications(userId) {
  return notificationsCache.filter(notification => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function unreadCountFor(userId) {
  return getUserNotifications(userId).filter(notification => !notification.read).length;
}

async function refreshDenuncias() {
  const rows = await apiGetDenuncias();
  denunciasCache = rows.map(row => normalizeDenuncia(row));
  return denunciasCache;
}

async function refreshDenuncia(id) {
  const { denuncia, comments } = await apiGetDenuncia(id);
  const normalized = normalizeDenuncia(denuncia, comments || []);
  const index = denunciasCache.findIndex(item => item.id === id);
  if (index < 0) denunciasCache.unshift(normalized);
  else denunciasCache[index] = normalized;
  return normalized;
}

async function refreshNotifications() {
  if (!signedInUser) {
    notificationsCache = [];
    return [];
  }
  const data = await apiGetNotifications();
  notificationsCache = (data.notifications || []).map(item => ({
    ...item,
    userId: item.userId || item.user_id,
    denunciaId: item.denunciaId || item.denuncia_id || '',
    createdAt: item.createdAt || item.created_at,
  }));
  return notificationsCache;
}

async function refreshUsers() {
  const data = await apiGetUsers();
  usersCache = (data.users || []).map(normalizeUser);
  usersLoaded = true;
  return usersCache;
}

async function initializeData() {
  if (!getAccessToken()) return false;
  try {
    const data = await apiMe();
    signedInUser = normalizeUser(data.user);
    await Promise.all([refreshDenuncias(), refreshNotifications()]);
    if (signedInUser.role === 'superadmin') await refreshUsers();
    return true;
  } catch (error) {
    apiLogout();
    signedInUser = null;
    usersCache = [];
    denunciasCache = [];
    notificationsCache = [];
    return false;
  }
}

function draftKey(userId) {
  return `${DRAFT_PREFIX}${userId}`;
}

function getDraft(userId) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(userId)) || 'null');
    if (!draft) return null;
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearDraft(userId);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(userId, draft) {
  localStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, savedAt: Date.now() }));
}

function clearDraft(userId) {
  localStorage.removeItem(draftKey(userId));
}

function validationError(message) {
  return { ok: false, msg: message };
}

async function registerCitizen({ name, email, password }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!name || !email || !password) return validationError('Preencha todos os campos.');
  if (password.length < 4) return validationError('Senha deve ter ao menos 4 caracteres.');
  try {
    const result = await apiRegister({ name, email, password });
    signedInUser = normalizeUser(result.user);
    usersCache = [signedInUser];
    try {
      await Promise.all([refreshDenuncias(), refreshNotifications()]);
      return { ok: true, user: signedInUser };
    } catch (error) {
      return {
        ok: true,
        user: signedInUser,
        warning: 'Conta criada, mas não foi possível carregar todos os dados. Atualize a página para tentar novamente.',
      };
    }
  } catch (error) {
    return validationError(error.message);
  }
}

async function login({ email, password }) {
  email = (email || '').trim().toLowerCase();
  if (!email || !password) return validationError('Preencha e-mail e senha.');
  try {
    const result = await apiLogin({ email, password });
    signedInUser = normalizeUser(result.user);
    usersCache = [signedInUser];
    await Promise.all([refreshDenuncias(), refreshNotifications()]);
    if (signedInUser.role === 'superadmin') await refreshUsers();
    return { ok: true, user: signedInUser };
  } catch (error) {
    return validationError(error.message);
  }
}

function logout() {
  apiLogout();
  signedInUser = null;
  usersCache = [];
  denunciasCache = [];
  notificationsCache = [];
  usersLoaded = false;
}

async function createUserByAdmin({ name, email, password, role }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  role = (role || 'admin').toLowerCase();
  if (!name || !email || !password) return validationError('Preencha todos os campos.');
  if (password.length < 4) return validationError('Senha deve ter ao menos 4 caracteres.');
  if (!['admin', 'moderador', 'superadmin'].includes(role)) return validationError('Função inválida.');
  try {
    const { user } = await apiCreateUser({ name, email, password, role: toApiEnum(role) });
    const normalized = normalizeUser(user);
    usersCache = [normalized, ...usersCache.filter(item => item.id !== normalized.id)];
    return { ok: true, user: normalized };
  } catch (error) {
    return validationError(error.message);
  }
}

async function resetUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) return validationError('Senha deve ter ao menos 4 caracteres.');
  try {
    await apiResetUserPassword(userId, newPassword);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function updateUserRole(userId, role) {
  if (!['cidadao', 'moderador', 'admin', 'superadmin'].includes(role)) {
    return validationError('Função inválida.');
  }
  try {
    const { user } = await apiUpdateUserRole(userId, toApiEnum(role));
    const normalized = normalizeUser(user);
    usersCache = usersCache.map(item => item.id === userId ? normalized : item);
    return { ok: true, user: normalized };
  } catch (error) {
    return validationError(error.message);
  }
}

async function updateUserPhoto(userId, photoData) {
  if (!signedInUser || signedInUser.id !== userId) return validationError('Sessão expirada.');
  try {
    const { user } = await apiUpdateMyPhoto(photoData);
    signedInUser = normalizeUser(user);
    usersCache = usersCache.map(item => item.id === userId ? signedInUser : item);
    return { ok: true, user: signedInUser };
  } catch (error) {
    return validationError(error.message);
  }
}

async function createDenuncia({ title, description, category, location, latitude, longitude, media }) {
  if (!signedInUser) return validationError('Sessão expirada.');
  if (!title.trim() || !description.trim() || !category || !location.trim()) {
    return validationError('Preencha todos os campos obrigatórios.');
  }
  try {
    const data = await apiCreateDenuncia({
      title: title.trim(),
      description: description.trim(),
      category: toApiEnum(category),
      location: location.trim(),
      latitude,
      longitude,
    }, media);
    const denuncia = normalizeDenuncia(data.denuncia);
    denunciasCache.unshift(denuncia);
    return { ok: true, denuncia };
  } catch (error) {
    return validationError(error.message);
  }
}

async function toggleLike(id) {
  try {
    await apiLikeDenuncia(id);
    await refreshDenuncia(id);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function addComment(id, text, parentId) {
  if (!text.trim()) return validationError('Escreva um comentário.');
  try {
    await apiCreateComment(id, text.trim(), parentId);
    await refreshDenuncia(id);
    await refreshNotifications();
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function removeComment(denunciaId, commentId) {
  try {
    await apiDeleteComment(denunciaId, commentId);
    await refreshDenuncia(denunciaId);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function moderateValidate(id) {
  try {
    await apiValidateDenuncia(id);
    await Promise.all([refreshDenuncia(id), refreshNotifications()]);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function moderateRemove(id) {
  try {
    await apiRemoveDenuncia(id);
    denunciasCache = denunciasCache.filter(item => item.id !== id);
    await refreshNotifications();
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function adminSetStatus(id, status) {
  try {
    await apiSetDenunciaStatus(id, toApiEnum(status));
    await Promise.all([refreshDenuncia(id), refreshNotifications()]);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function adminRespond(id, text) {
  if (!text.trim()) return validationError('Escreva uma resposta antes de publicar.');
  try {
    await apiRespondToDenuncia(id, text.trim());
    await Promise.all([refreshDenuncia(id), refreshNotifications()]);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function citizenConfirmResolved(id) {
  try {
    await apiConfirmResolved(id);
    await refreshDenuncia(id);
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function markOneRead(id) {
  try {
    await apiMarkNotificationRead(id);
    const notification = notificationsCache.find(item => item.id === id);
    if (notification) notification.read = true;
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}

async function markAllRead() {
  try {
    await apiMarkAllNotificationsRead();
    notificationsCache.forEach(item => { item.read = true; });
    return { ok: true };
  } catch (error) {
    return validationError(error.message);
  }
}
