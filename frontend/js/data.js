const DB = {
  USERS: 'ac_users',
  DENUNCIAS: 'ac_denuncias',
  SESSION: 'ac_session',
  NOTIFICATIONS: 'ac_notifications',
};

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

function uid(prefix) {
  return `${prefix ? `${prefix}_` : ''}${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function formatDate(iso) {
  const date = new Date(iso);

  return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
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

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return readJSON(DB.USERS, []);
}

function saveUsers(users) {
  writeJSON(DB.USERS, users);
}

function getDenuncias() {
  return readJSON(DB.DENUNCIAS, []);
}

function saveDenuncias(denuncias) {
  writeJSON(DB.DENUNCIAS, denuncias);
}

function getSession() {
  return readJSON(DB.SESSION, null);
}

function setSession(userId) {
  writeJSON(DB.SESSION, { userId });
}

function clearSession() {
  localStorage.removeItem(DB.SESSION);
}

function currentUser() {
  const session = getSession();

  return session ? findUserById(session.userId) : null;
}

function findUserByEmail(email) {
  return getUsers().find(
    user => user.email.toLowerCase() === email.toLowerCase()
  );
}

function findUserById(id) {
  return getUsers().find(user => user.id === id) || null;
}


function ensureSeedData() {
  if (getUsers().length) return;

  const users = [
    ['Super Admin', 'super@urbano.com', 'super123', 'superadmin'],
    ['Carlos Mendes', 'admin@urbano.com', 'admin123', 'admin'],
    ['Fernanda Lima', 'moderadora@urbano.com', 'mod123', 'moderador'],
    ['Ana Souza', 'ana@mail.com', '123456', 'cidadao'],
    ['Pedro Rocha', 'pedro@mail.com', '123456', 'cidadao'],
  ].map(([name, email, password, role]) => ({
    id: uid('u'),
    name,
    email,
    password,
    role,
    photo: null,
    photoUrl: null,
    createdAt: nowISO()
  }));

  saveUsers(users);

  const ana = users.find(user => user.email === 'ana@mail.com');
  const pedro = users.find(user => user.email === 'pedro@mail.com');
  const admin = users.find(user => user.role === 'admin');

  const daysAgo = days =>
    new Date(Date.now() - days * 86400000).toISOString();

  saveDenuncias([
    {
      id: uid('d'),
      title: 'Buraco grande na Av. das Palmeiras',
      description: 'Buraco profundo próximo ao ponto de ônibus.',
      category: 'buraco',
      location: 'Av. das Palmeiras, 450 - Centro',
      media: null,
      authorId: ana.id,
      authorName: ana.name,
      createdAt: daysAgo(6),
      status: 'em_andamento',
      validated: true,
      removido: false,
      confirmedResolved: false,
      officialResponse: {
        text: 'Equipe de manutenção acionada.',
        authorName: admin.name,
        date: daysAgo(2)
      },
      likes: [pedro.id],
      comments: []
    },

    {
      id: uid('d'),
      title: 'Poste de luz apagado há 2 semanas',
      description: 'A rua fica totalmente escura à noite.',
      category: 'iluminacao',
      location: 'Rua das Acácias, esquina com Rua Bela Vista',
      media: null,
      authorId: pedro.id,
      authorName: pedro.name,
      createdAt: daysAgo(4),
      status: 'aberto',
      validated: false,
      removido: false,
      confirmedResolved: false,
      officialResponse: null,
      likes: [ana.id],
      comments: []
    },

    {
      id: uid('d'),
      title: 'Lixo acumulado em terreno baldio',
      description: 'Moradores estão descartando entulho irregularmente.',
      category: 'lixo',
      location: 'Rua Tiradentes, 120',
      media: null,
      authorId: ana.id,
      authorName: ana.name,
      createdAt: daysAgo(15),
      status: 'resolvido',
      validated: true,
      removido: false,
      confirmedResolved: true,
      officialResponse: {
        text: 'Terreno limpo pela equipe de zeladoria urbana.',
        authorName: admin.name,
        date: daysAgo(9)
      },
      likes: [pedro.id, admin.id],
      comments: []
    }
  ]);
}


function getNotifications() {
  return readJSON(DB.NOTIFICATIONS, []);
}

function addNotification(userId, message, denunciaId) {
  if (userId) {
    writeJSON(
      DB.NOTIFICATIONS,
      [
        {
          id: uid('n'),
          userId,
          message,
          denunciaId,
          read: false,
          createdAt: nowISO()
        },
        ...getNotifications()
      ].slice(0, 300)
    );
  }
}

function getUserNotifications(userId) {
  return getNotifications()
    .filter(notification => notification.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
}

function unreadCountFor(userId) {
  return getUserNotifications(userId)
    .filter(notification => !notification.read)
    .length;
}

function markAllRead(userId) {
  const notifications = getNotifications();

  notifications.forEach(notification => {
    if (notification.userId === userId) {
      notification.read = true;
    }
  });

  writeJSON(DB.NOTIFICATIONS, notifications);
}

function markOneRead(id) {
  const notifications = getNotifications();

  const notification = notifications.find(
    item => item.id === id
  );

  if (notification) {
    notification.read = true;
  }

  writeJSON(DB.NOTIFICATIONS, notifications);
}


function draftKey(userId) {
  return `ac_draft_${userId}`;
}

function getDraft(userId) {
  const draft = readJSON(draftKey(userId), null);

  if (!draft) return null;

  if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
    clearDraft(userId);
    return null;
  }

  return draft;
}

function saveDraft(userId, draft) {
  writeJSON(
    draftKey(userId),
    {
      ...draft,
      savedAt: Date.now()
    }
  );
}

function clearDraft(userId) {
  localStorage.removeItem(draftKey(userId));
}


/* =========================
   AUTENTICAÇÃO VIA API
========================= */

async function registerCitizen({ name, email, password }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();

  if (!name || !email || !password) {
    return {
      ok: false,
      msg: 'Preencha todos os campos.'
    };
  }

  if (password.length < 4) {
    return {
      ok: false,
      msg: 'Senha deve ter ao menos 4 caracteres.'
    };
  }

  try {
    const data = await apiRegister({
      name,
      email,
      password
    });

    /*
     * O Supabase pode exigir confirmação de e-mail.
     * Nesse caso o cadastro funciona, mas ainda não existe
     * uma sessão para o usuário.
     */

    if (!data.session) {
      return {
        ok: true,
        requiresConfirmation: true,
        msg: 'Cadastro realizado! Confirme seu e-mail para entrar.'
      };
    }

    localStorage.setItem(
      'ac_session',
      JSON.stringify({
        userId: data.user.id
      })
    );

    return {
      ok: true,
      user: data.user
    };

  } catch (error) {
    return {
      ok: false,
      msg: error.message
    };
  }
}


async function login({ email, password }) {
  email = (email || '').trim().toLowerCase();

  if (!email || !password) {
    return {
      ok: false,
      msg: 'Preencha e-mail e senha.'
    };
  }

  try {
    const data = await apiLogin({
      email,
      password
    });

    localStorage.setItem(
      'ac_session',
      JSON.stringify({
        userId: data.user.id
      })
    );

    return {
      ok: true,
      user: data.user
    };

  } catch (error) {
    return {
      ok: false,
      msg: error.message
    };
  }
}


function logout() {
  apiLogout();
}


/* =========================
   ADMIN / USUÁRIOS
========================= */

function createUserByAdmin({ name, email, password, role }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  role = (role || 'admin').toLowerCase();

  if (!name || !email || !password) {
    return {
      ok: false,
      msg: 'Preencha todos os campos.'
    };
  }

  if (password.length < 4) {
    return {
      ok: false,
      msg: 'Senha deve ter ao menos 4 caracteres.'
    };
  }

  if (!['admin', 'moderador', 'superadmin'].includes(role)) {
    return {
      ok: false,
      msg: 'Função inválida.'
    };
  }

  if (findUserByEmail(email)) {
    return {
      ok: false,
      msg: 'Este e-mail já está cadastrado.'
    };
  }

  const user = {
    id: uid('u'),
    name,
    email,
    password,
    role,
    photo: null,
    photoUrl: null,
    createdAt: nowISO()
  };

  saveUsers([
    ...getUsers(),
    user
  ]);

  return {
    ok: true,
    user
  };
}


function resetUserPassword(userId, newPassword) {
  const users = getUsers();

  const user = users.find(
    item => item.id === userId
  );

  if (!user) {
    return {
      ok: false,
      msg: 'Usuário não encontrado.'
    };
  }

  if (!newPassword || newPassword.length < 4) {
    return {
      ok: false,
      msg: 'Senha deve ter ao menos 4 caracteres.'
    };
  }

  user.password = newPassword;

  saveUsers(users);

  return {
    ok: true
  };
}


function updateUserPhoto(userId, photoDataUrl) {
  const users = getUsers();

  const user = users.find(
    item => item.id === userId
  );

  if (!user) {
    return {
      ok: false
    };
  }

  user.photo = photoDataUrl;
  user.photoUrl = photoDataUrl;

  saveUsers(users);

  return {
    ok: true,
    user
  };
}


/* =========================
   DENÚNCIAS
========================= */

function createDenuncia({
  title,
  description,
  category,
  location,
  latitude,
  longitude,
  media
}) {
  const user = currentUser();

  if (!user) {
    return {
      ok: false,
      msg: 'Sessão expirada.'
    };
  }

  if (
    !title.trim() ||
    !description.trim() ||
    !category ||
    !location.trim()
  ) {
    return {
      ok: false,
      msg: 'Preencha todos os campos obrigatórios.'
    };
  }

  const denuncia = {
    id: uid('d'),
    title: title.trim(),
    description: description.trim(),
    category,
    location: location.trim(),
    latitude: latitude || null,
    longitude: longitude || null,
    media: media || null,
    authorId: user.id,
    authorName: user.name,
    createdAt: nowISO(),
    status: 'aberto',
    validated: false,
    removido: false,
    confirmedResolved: false,
    officialResponse: null,
    likes: [],
    comments: []
  };

  saveDenuncias([
    denuncia,
    ...getDenuncias()
  ]);

  return {
    ok: true,
    denuncia
  };
}


function getDenunciaById(id) {
  return getDenuncias().find(
    denuncia => denuncia.id === id
  ) || null;
}


function updateDenuncia(id, patch) {
  const denuncias = getDenuncias();

  const index = denuncias.findIndex(
    denuncia => denuncia.id === id
  );

  if (index < 0) {
    return {
      ok: false
    };
  }

  denuncias[index] = {
    ...denuncias[index],
    ...patch
  };

  saveDenuncias(denuncias);

  return {
    ok: true,
    denuncia: denuncias[index]
  };
}


function toggleLike(id) {
  const user = currentUser();
  const denuncia = getDenunciaById(id);

  if (!user || !denuncia) return;

  const index = denuncia.likes.indexOf(user.id);

  if (index < 0) {
    denuncia.likes.push(user.id);
  } else {
    denuncia.likes.splice(index, 1);
  }

  updateDenuncia(id, {
    likes: denuncia.likes
  });
}


function addComment(id, text, parentId) {
  const user = currentUser();
  const denuncia = getDenunciaById(id);

  if (!user || !denuncia || !text.trim()) return;

  const comment = {
    id: uid('c'),
    parentId: parentId || null,
    authorId: user.id,
    authorName: user.name,
    text: text.trim(),
    createdAt: nowISO()
  };

  denuncia.comments.push(comment);

  updateDenuncia(id, {
    comments: denuncia.comments
  });

  if (denuncia.authorId !== user.id) {
    addNotification(
      denuncia.authorId,
      `${user.name} comentou na sua denúncia "${denuncia.title}".`,
      id
    );
  }
}


function removeComment(denunciaId, commentId) {
  const denuncia = getDenunciaById(denunciaId);

  if (!denuncia) return;

  const removed = new Set([commentId]);

  let changed = true;

  while (changed) {
    changed = false;

    denuncia.comments.forEach(comment => {
      if (
        removed.has(comment.parentId) &&
        !removed.has(comment.id)
      ) {
        removed.add(comment.id);
        changed = true;
      }
    });
  }

  updateDenuncia(
    denunciaId,
    {
      comments: denuncia.comments.filter(
        comment => !removed.has(comment.id)
      )
    }
  );
}


function moderateValidate(id) {
  const denuncia = getDenunciaById(id);

  const result = updateDenuncia(
    id,
    {
      validated: true
    }
  );

  if (denuncia) {
    addNotification(
      denuncia.authorId,
      `Sua denúncia "${denuncia.title}" foi validada pela moderação.`,
      id
    );
  }

  return result;
}


function moderateRemove(id) {
  const denuncia = getDenunciaById(id);

  const result = updateDenuncia(
    id,
    {
      removido: true
    }
  );

  if (denuncia) {
    addNotification(
      denuncia.authorId,
      `Sua denúncia "${denuncia.title}" foi removida pela moderação.`,
      id
    );
  }

  return result;
}


function adminSetStatus(id, status) {
  const denuncia = getDenunciaById(id);

  const result = updateDenuncia(
    id,
    {
      status
    }
  );

  if (denuncia) {
    addNotification(
      denuncia.authorId,
      `O status da denúncia "${denuncia.title}" foi atualizado.`,
      id
    );
  }

  return result;
}


function adminRespond(id, text) {
  const user = currentUser();
  const denuncia = getDenunciaById(id);

  if (!user || !denuncia || !text.trim()) {
    return {
      ok: false
    };
  }

  const result = updateDenuncia(
    id,
    {
      officialResponse: {
        text: text.trim(),
        authorName: user.name,
        date: nowISO()
      }
    }
  );

  addNotification(
    denuncia.authorId,
    `Você recebeu uma resposta oficial na denúncia "${denuncia.title}".`,
    id
  );

  return result;
}


function citizenConfirmResolved(id) {
  return updateDenuncia(
    id,
    {
      confirmedResolved: true
    }
  );
}