/* =========================================================
   AlertaCidade — Camada de interface
   Responsável por: renderização, roteamento de telas e
   eventos. Toda a lógica de dados vem de data.js; a captura
   de câmera vem de camera.js.
   ========================================================= */

const state = {
  screen: 'auth',          // auth | dashboard | create | detail | profile | admin
  authMode: 'login',       // login | cadastro
  selectedId: null,
  filters: { category: 'all', status: 'all', sort: 'recent', search: '' },
  adminFilters: { role: 'all', search: '' },
  pendingMedia: null,      // { type: 'photo'|'video', url, durationSeconds } — mídia da denúncia em edição
  draft: null,             // rascunho da denúncia (persistido em LocalStorage)
  replyingTo: null,        // id do comentário sendo respondido
  notifOpen: false,
  toast: null,
  // estado transitório do modal de câmera
  cameraAllowVideo: false,
  cameraMode: 'photo',
  cameraRecording: false,
  cameraOnDone: null,
  sourceCallbacks: null,
};

const app = document.getElementById('app');
let locationMap = null;
let locationMarker = null;
let locationLookupId = 0;

function go(screen, extra) {
  state.screen = screen;
  state.notifOpen = false;
  if (extra) Object.assign(state, extra);

  if (screen === 'create') {
    const user = currentUser();
    if (user) {
      const draft = getDraft(user.id);
      state.draft = draft || {};
      state.pendingMedia = (draft && draft.media) || null;
    }
  }

  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function showToast(msg, type) {
  state.toast = { msg, type: type || 'success' };
  render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { state.toast = null; renderToastOnly(); }, 2800);
}

function renderToastOnly() {
  const el = document.getElementById('toast-root');
  if (el) el.outerHTML = toastHTML();
}

function toastHTML() {
  if (!state.toast) return '<div id="toast-root"></div>';
  return `<div id="toast-root"><div class="toast toast-${state.toast.type}">${escapeHTML(state.toast.msg)}</div></div>`;
}

/* ---------------- ícones (SVG inline, stroke = currentColor) ---------------- */

const ICONS = {
  logo: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2 3 6.5V11c0 5.2 3.8 9.9 9 11 5.2-1.1 9-5.8 9-11V6.5L12 2Z" fill="currentColor"/></svg>`,
  grid: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.5-4 5-5.5 7.5-5.5s6 1.5 7.5 5.5"/></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Z"/></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.5s-7.5-4.7-10-9.4C.4 7.8 2.2 4 5.7 4c2 0 3.4 1 4.3 2.3C11 5 12.4 4 14.4 4c3.5 0 5.3 3.8 3.7 7.1-2.5 4.7-10 9.4-10 9.4Z"/></svg>`,
  heartFill: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.7-10-9.4C.4 7.8 2.2 4 5.7 4c2 0 3.4 1 4.3 2.3C11 5 12.4 4 14.4 4c3.5 0 5.3 3.8 3.7 7.1-2.5 4.7-10 9.4-10 9.4Z"/></svg>`,
  comment: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z"/></svg>`,
  pin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>`,
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
  image: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>`,
  camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/></svg>`,
  video: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5 21 7.5v9l-5.5-3Z"/></svg>`,
  play: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  key: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M10.5 12.5 20 3M16 7l2 2M13 10l2 2"/></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  bell: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
};

/* ---------------- avatar (foto de perfil ou iniciais) ---------------- */

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

function avatarHTML(userId, fallbackName, sizeClass) {
  const u = findUserById(userId);
  const name = u ? u.name : (fallbackName || '?');
  const cls = 'avatar' + (sizeClass ? ' ' + sizeClass : '');
  const photoUrl = (u && (u.photo || u.photoUrl)) || null;
  if (photoUrl) return `<img src="${photoUrl}" class="${cls} avatar-img" alt="${escapeHTML(name)}">`;
  return `<span class="${cls}">${initials(name)}</span>`;
}

/* ---------------- render raiz ---------------- */

function render() {
  const user = currentUser();
  if (!user) { state.screen = 'auth'; }
  else if (state.screen === 'auth') { state.screen = 'dashboard'; }

  if (locationMap) {
    locationMap.remove();
    locationMap = null;
    locationMarker = null;
  }

  let body = '';
  if (!user) {
    body = authScreen();
  } else {
    body = `
      ${navHTML(user)}
      <main class="main">
        ${state.screen === 'dashboard' ? dashboardScreen(user) : ''}
        ${state.screen === 'create' ? createScreen(user) : ''}
        ${state.screen === 'detail' ? detailScreen(user) : ''}
        ${state.screen === 'profile' ? profileScreen(user) : ''}
        ${state.screen === 'admin' ? adminScreen() : ''}
      </main>
      ${mobileNavHTML(user)}
    `;
  }

  // #modal-root fica FORA do que é re-renderizado aqui — ver index.html.
  // Isso é proposital: se um modal de câmera estiver aberto (com um <video>
  // e um MediaStream ativos), um render() disparado por outro motivo (ex.:
  // o toast expirando) não deve destruir esse elemento no meio da captura.
  app.innerHTML = body + toastHTML();
  if (state.screen === 'create') initializeLocationMap();
}

/* ---------------- navegação ---------------- */

function navHTML(user) {
  const items = navItems(user.role);
  const unread = unreadCountFor(user.id);
  return `
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <span class="brand-mark">${ICONS.logo}</span>
        <span class="brand-name">Alerta<b>Cidade</b></span>
      </div>
      <nav class="nav-desktop">
        ${items.map(i => `
          <button class="nav-link ${state.screen === i.screen ? 'active' : ''}" data-action="go" data-screen="${i.screen}">
            ${i.icon}<span>${i.label}</span>
          </button>`).join('')}
      </nav>

      <div class="notif-wrap">
        <button class="icon-btn bell-btn" data-action="toggle-notifications" title="Notificações">
          ${ICONS.bell}
          ${unread > 0 ? `<span class="notif-dot">${unread > 9 ? '9+' : unread}</span>` : ''}
        </button>
        ${state.notifOpen ? notifDropdownHTML(user.id) : ''}
      </div>

      <div class="user-chip" data-action="go" data-screen="profile" title="Ver perfil">
        ${avatarHTML(user.id, user.name)}
        <span class="user-chip-text">
          <b>${escapeHTML(user.name.split(' ')[0])}</b>
          <small>${ROLE_LABELS[user.role]}</small>
        </span>
      </div>
      <button class="icon-btn logout-btn" data-action="logout" title="Sair">${ICONS.logout}</button>
    </div>
  </header>`;
}

function mobileNavHTML(user) {
  const items = navItems(user.role);
  return `
  <nav class="nav-mobile">
    ${items.map(i => `
      <button class="nav-mobile-link ${state.screen === i.screen ? 'active' : ''}" data-action="go" data-screen="${i.screen}">
        ${i.icon}<span>${i.label}</span>
      </button>`).join('')}
  </nav>`;
}

function navItems(role) {
  const items = [{ screen: 'dashboard', label: 'Painel', icon: ICONS.grid }];
  if (role === 'cidadao' || role === 'superadmin') {
    
  }
  items.push({ screen: 'profile', label: 'Perfil', icon: ICONS.user });
  if (role === 'superadmin') {
    items.push({ screen: 'admin', label: 'Admin', icon: ICONS.shield });
  }
  return items;
}

/* ---------------- notificações (dropdown do sino) ---------------- */

function notifDropdownHTML(userId) {
  const list = getUserNotifications(userId).slice(0, 20);
  return `
  <div class="notif-dropdown">
    <div class="notif-dropdown-head">
      <b>Notificações</b>
      ${list.some(n => !n.read) ? `<button class="link-btn" data-action="mark-all-read">Marcar todas como lidas</button>` : ''}
    </div>
    <div class="notif-list">
      ${list.length === 0 ? `<p class="muted notif-empty">Nenhuma notificação por aqui.</p>` : list.map(n => `
        <button class="notif-item ${n.read ? '' : 'unread'}" data-action="open-notification" data-id="${n.id}" data-denuncia="${n.denunciaId}">
          <span class="notif-dotmark"></span>
          <span class="notif-text">${escapeHTML(n.message)}<small>${timeAgo(n.createdAt)}</small></span>
        </button>`).join('')}
    </div>
  </div>`;
}

/* ---------------- tela de autenticação ---------------- */

function authScreen() {
  const isLogin = state.authMode === 'login';
  return `
  <div class="auth-wrap">
    <div class="auth-side">
      <div class="brand brand-lg">
        <span class="brand-mark">${ICONS.logo}</span>
        <span class="brand-name">Alerta<b>Cidade</b></span>
      </div>
      <h1>A cidade fica melhor quando todo mundo aponta o que precisa mudar.</h1>
      <p class="auth-side-copy">Registre buracos, postes apagados, semáforos quebrados, lixo acumulado e pontos de risco — acompanhe o que a prefeitura está fazendo a respeito.</p>
      <ul class="auth-side-list">
        <li>${ICONS.check} Denuncie com foto ou vídeo, em segundos</li>
        <li>${ICONS.check} Acompanhe o status em tempo real</li>
        <li>${ICONS.check} Confirme quando o problema for resolvido</li>
      </ul>
    </div>
    <div class="auth-card">
      <div class="auth-toggle">
        <button class="${isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="login">Entrar</button>
        <button class="${!isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="cadastro">Criar conta</button>
      </div>
      ${isLogin ? loginForm() : registerForm()}
    </div>
  </div>`;
}

function loginForm() {
  return `
  <form data-action="submit-login" class="form">
    <h2>Bem-vindo de volta</h2>
    <p class="form-sub">Entre com seu e-mail e senha.</p>
    <label class="field">
      <span>E-mail</span>
      <input type="email" name="email" placeholder="voce@email.com" required autocomplete="username">
    </label>
    <label class="field">
      <span>Senha</span>
      <input type="password" name="password" placeholder="••••••••" required autocomplete="current-password">
    </label>
    <button type="submit" class="btn btn-primary btn-block">Entrar</button>
  </form>`;
}

function registerForm() {
  return `
  <form data-action="submit-register" class="form">
    <h2>Criar conta de cidadão</h2>
    <p class="form-sub">Toda conta criada aqui é automaticamente do tipo <b>cidadão</b>.</p>
    <label class="field">
      <span>Nome completo</span>
      <input type="text" name="name" placeholder="Seu nome" required>
    </label>
    <label class="field">
      <span>E-mail</span>
      <input type="email" name="email" placeholder="voce@email.com" required>
    </label>
    <label class="field">
      <span>Senha</span>
      <input type="password" name="password" placeholder="Mínimo 4 caracteres" required minlength="4">
    </label>
    <button type="submit" class="btn btn-primary btn-block">Criar conta</button>
  </form>`;
}

/* ---------------- painel (dashboard) ---------------- */

function dashboardScreen(user) {
  const list = filteredDenuncias(user);
  return `
  <div class="page-head">
    <div>
      <h1>Denúncias da cidade</h1>
      <p class="muted">${list.length} ocorrência${list.length === 1 ? '' : 's'} encontrada${list.length === 1 ? '' : 's'}</p>
    </div>
    ${(user.role === 'cidadao' || user.role === 'superadmin') ? `<button class="btn btn-primary" data-action="go" data-screen="create">${ICONS.plus} Nova denúncia</button>` : ''}
  </div>

  <div class="filters">
    <label class="search-box">
      ${ICONS.search}
      <input type="text" placeholder="Buscar por título, local ou descrição..." value="${escapeHTML(state.filters.search)}" data-action="filter-search">
    </label>
    <select data-action="filter-category">
      <option value="all">Todas as categorias</option>
      ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${state.filters.category === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
    </select>
    <select data-action="filter-status">
      <option value="all">Todos os status</option>
      ${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${state.filters.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
    </select>
    <select data-action="filter-sort">
      <option value="recent" ${state.filters.sort === 'recent' ? 'selected' : ''}>Mais recentes</option>
      <option value="old" ${state.filters.sort === 'old' ? 'selected' : ''}>Mais antigas</option>
      <option value="likes" ${state.filters.sort === 'likes' ? 'selected' : ''}>Mais curtidas</option>
    </select>
  </div>

  ${list.length === 0 ? emptyState('Nenhuma denúncia por aqui', 'Ajuste os filtros ou seja o primeiro a relatar um problema na sua região.') : `
    <div class="cards-grid">
      ${list.map(d => denunciaCard(d, user)).join('')}
    </div>
  `}
  `;
}

function filteredDenuncias(user) {
  let list = getDenuncias().filter(d => !d.removido);
  const f = state.filters;
  if (f.category !== 'all') list = list.filter(d => d.category === f.category);
  if (f.status !== 'all') list = list.filter(d => d.status === f.status);
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    list = list.filter(d => {
      const title = String(d.title || '').toLowerCase();
      const description = String(d.description || '').toLowerCase();
      const location = String(d.location || '').toLowerCase();
      return title.includes(q) || description.includes(q) || location.includes(q);
    });
  }
  if (f.sort === 'recent') list = list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (f.sort === 'old') list = list.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (f.sort === 'likes') list = list.slice().sort((a, b) => (b.likes || []).length - (a.likes || []).length);
  return list;
}

function mediaThumbHTML(media, catIcon) {
  if (!media) return `<div class="card-image card-image-empty">${catIcon}</div>`;
  if (media.type === 'video') {
    return `<div class="card-image card-image-video">
      <video muted preload="metadata" src="${media.url}"></video>
      <span class="video-play-badge">${ICONS.play}</span>
      ${media.durationSeconds ? `<span class="video-duration-badge">${formatMMSS(media.durationSeconds)}</span>` : ''}
    </div>`;
  }
  return `<div class="card-image" style="background-image:url('${media.url}')"></div>`;
}

function denunciaCard(d, user) {
  const cat = CATEGORIES[d.category];
  const st = STATUSES[d.status];
  const liked = user && d.likes.includes(user.id);
  return `
  <article class="card denuncia-card" data-action="go" data-screen="detail" data-id="${d.id}">
    ${mediaThumbHTML(d.media, cat.icon)}
    <div class="card-body">
      <div class="card-top-row">
        <span class="chip">${cat.icon} ${cat.label}</span>
        <span class="badge ${st.cls}">${st.label}</span>
      </div>
      <h3 class="card-title">${escapeHTML(d.title)}</h3>
      <p class="card-desc">${escapeHTML(truncate(d.description, 110))}</p>
      <div class="card-meta">${ICONS.pin}<span>${escapeHTML(d.location)}</span></div>
      <div class="card-footer">
        <span class="card-author">por ${escapeHTML(d.authorName)} · ${timeAgo(d.createdAt)}</span>
        <span class="card-stats">
          <button class="mini-btn ${liked ? 'liked' : ''}" data-action="like" data-id="${d.id}" title="Curtir">${liked ? ICONS.heartFill : ICONS.heart}${d.likes.length}</button>
          <span class="mini-stat">${ICONS.comment}${d.comments.length}</span>
        </span>
      </div>
      ${d.validated ? `<div class="tag-validated">${ICONS.check} Validado pela moderação</div>` : ''}
    </div>
  </article>`;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `há ${dd}d`;
  return formatDate(iso);
}

function emptyState(title, sub) {
  return `<div class="empty-state">
    <div class="empty-icon">${ICONS.grid}</div>
    <h3>${escapeHTML(title)}</h3>
    <p>${escapeHTML(sub)}</p>
  </div>`;
}

/* ---------------- tela de criação de denúncia ---------------- */

function createScreen(user) {
  const draft = state.draft || {};
  const hasDraft = !!(draft.title || draft.description || draft.location || draft.category || state.pendingMedia);
  return `
  <div class="page-narrow">
    <button class="back-link" data-action="go" data-screen="dashboard">${ICONS.back} Voltar ao painel</button>
    <div class="page-head create-page-head">
      <div>
        <h1>Registrar nova denúncia</h1>
        <p class="muted">Dê o máximo de detalhes possível — isso ajuda a prefeitura a agir mais rápido.</p>
      </div>
    </div>
    ${hasDraft ? `<div class="draft-hint">Continuando de onde você parou. <button type="button" class="link-btn" data-action="discard-draft">Descartar rascunho</button></div>` : ''}

    <form data-action="submit-create" class="form card form-card">
      <label class="field">
        <span>Título*</span>
        <input type="text" name="title" placeholder="Ex: Buraco na Rua das Flores" required maxlength="90" value="${escapeHTML(draft.title || '')}">
      </label>
      <label class="field">
        <span>Categoria*</span>
        <select name="category" required>
          <option value="">Selecione...</option>
          ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${draft.category === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Localização*</span>
        <input type="text" name="location" placeholder="Rua, número, bairro ou ponto de referência" required maxlength="140" value="${escapeHTML(draft.location || '')}">
      </label>
      <div class="field location-picker-field">
        <div class="location-picker-head">
          <span>Marque o ponto exato no mapa</span>
          <button type="button" class="btn btn-outline btn-sm" data-action="use-current-location">Usar minha localização</button>
        </div>
        <div id="location-map" class="location-map" aria-label="Mapa para marcar a localização da denúncia"></div>
        <small class="field-hint">Clique no mapa ou arraste o marcador. O endereço acima continua sendo usado como referência.</small>
        <input type="hidden" name="latitude" value="${escapeHTML(draft.latitude || '')}">
        <input type="hidden" name="longitude" value="${escapeHTML(draft.longitude || '')}">
      </div>
      <label class="field">
        <span>Descrição*</span>
        <textarea name="description" rows="4" placeholder="Descreva o problema com detalhes..." required maxlength="600">${escapeHTML(draft.description || '')}</textarea>
      </label>
      <div class="field">
        <span>Foto ou vídeo (opcional, vídeo com até 3 minutos)</span>
        ${mediaPickerHTML()}
        <input id="media-input" type="file" accept="image/*,video/*" hidden>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Publicar denúncia</button>
    </form>
  </div>`;
}

function initializeLocationMap() {
  const mapElement = document.getElementById('location-map');
  if (!mapElement || !window.L) return;

  const draft = state.draft || {};
  const defaultCenter = [-15.7801, -47.9292];
  const hasDraftCoordinates = Number.isFinite(Number(draft.latitude)) && Number.isFinite(Number(draft.longitude));
  const center = hasDraftCoordinates ? [Number(draft.latitude), Number(draft.longitude)] : defaultCenter;

  locationMap = L.map(mapElement).setView(center, hasDraftCoordinates ? 16 : 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(locationMap);

  if (hasDraftCoordinates) setLocationMarker(center[0], center[1], false);
  locationMap.on('click', (event) => setLocationMarker(event.latlng.lat, event.latlng.lng, true));
}

function setLocationMarker(latitude, longitude, centerMap) {
  if (!locationMap) return;
  if (locationMarker) locationMarker.setLatLng([latitude, longitude]);
  else locationMarker = L.marker([latitude, longitude]).addTo(locationMap);
  if (centerMap) locationMap.setView([latitude, longitude], 16);

  const form = document.querySelector('form[data-action="submit-create"]');
  const input = form && form.elements.location;
  if (!input) return;
  input.value = `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  state.draft = { ...state.draft, latitude, longitude };
  persistDraftFromForm(form);
  reverseGeocode(latitude, longitude, input, ++locationLookupId);
}

async function reverseGeocode(latitude, longitude, input, lookupId) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`);
    if (!response.ok) return;
    const result = await response.json();
    const address = result.display_name;
    if (!address || !input.isConnected || lookupId !== locationLookupId) return;
    input.value = `${address} (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`.slice(0, 140);
    persistDraftFromForm(input.form);
  } catch (error) {
    // As coordenadas já foram preenchidas; o endereço é apenas complementar.
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Seu navegador não oferece geolocalização.', 'error');
    return;
  }

  const form = document.querySelector('form[data-action="submit-create"]');
  const input = form && form.elements.location;
  if (input) {
    input.value = 'Obtendo sua localização atual...';
    state.draft = { ...state.draft, location: '' };
    persistDraftFromForm(form);
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => setLocationMarker(coords.latitude, coords.longitude, true),
    () => {
      if (input && input.isConnected) input.value = '';
      showToast('Não foi possível acessar sua localização.', 'error');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

function mediaPickerHTML() {
  const media = state.pendingMedia;
  if (!media) {
    return `
    <button type="button" class="file-drop" data-action="open-media-source">
      <span>${ICONS.image} Adicionar foto ou vídeo</span>
    </button>`;
  }
  const preview = media.type === 'video'
    ? `<video src="${media.url}" controls class="file-preview"></video>`
    : `<img src="${media.url}" class="file-preview">`;
  return `
  <div class="media-preview-box">
    ${preview}
    <div class="media-preview-actions">
      <span class="chip">${media.type === 'video' ? ICONS.video : ICONS.image} ${media.type === 'video' ? 'Vídeo' + (media.durationSeconds ? ' · ' + formatMMSS(media.durationSeconds) : '') : 'Foto'}</span>
      <button type="button" class="btn btn-outline btn-sm" data-action="remove-media">${ICONS.trash} Remover</button>
    </div>
  </div>`;
}

/* ---------------- tela de detalhe ---------------- */

function detailScreen(user) {
  const d = getDenunciaById(state.selectedId);
  if (!d) return `<div class="page-narrow">${emptyState('Denúncia não encontrada', 'Ela pode ter sido removida.')}</div>`;

  const cat = CATEGORIES[d.category];
  const st = STATUSES[d.status];
  const liked = d.likes.includes(user.id);
  const isAuthor = d.authorId === user.id;
  const isMod = user.role === 'moderador' || user.role === 'superadmin';
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const mediaBlock = d.media
    ? (d.media.type === 'video'
        ? `<video src="${d.media.url}" controls class="detail-image"></video>`
        : `<img src="${d.media.url}" class="detail-image">`)
    : '';

  return `
  <div class="page-narrow">
    <button class="back-link" data-action="go" data-screen="dashboard">${ICONS.back} Voltar</button>

    <div class="detail-card card">
      ${mediaBlock}
      <div class="detail-body">
        <div class="card-top-row">
          <span class="chip">${cat.icon} ${cat.label}</span>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        <h1 class="detail-title">${escapeHTML(d.title)}</h1>
        <div class="card-meta">${ICONS.pin}<span>${escapeHTML(d.location)}</span></div>
        ${d.latitude && d.longitude ? `<a class="map-link" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(d.latitude)}&mlon=${encodeURIComponent(d.longitude)}#map=18/${encodeURIComponent(d.latitude)}/${encodeURIComponent(d.longitude)}" target="_blank" rel="noopener">${ICONS.pin} Ver ponto no mapa</a>` : ''}
        <p class="detail-desc">${escapeHTML(d.description)}</p>
        <div class="detail-author">Relatado por <b>${escapeHTML(d.authorName)}</b> em ${formatDate(d.createdAt)}</div>

        ${d.validated ? `<div class="tag-validated">${ICONS.check} Validado pela moderação</div>` : ''}
        ${d.confirmedResolved ? `<div class="tag-confirmed">${ICONS.check} Solução confirmada pelo autor</div>` : ''}

        ${d.officialResponse ? `
          <div class="official-box">
            <div class="official-head">${ICONS.shield} Resposta oficial — ${escapeHTML(d.officialResponse.authorName)}</div>
            <p>${escapeHTML(d.officialResponse.text)}</p>
            <small>${formatDate(d.officialResponse.date)}</small>
          </div>` : ''}

        <div class="action-row">
          <button class="mini-btn lg ${liked ? 'liked' : ''}" data-action="like" data-id="${d.id}">${liked ? ICONS.heartFill : ICONS.heart} <span>${d.likes.length} curtidas</span></button>
          <span class="mini-stat lg">${ICONS.comment} <span>${d.comments.length} comentários</span></span>
        </div>

        ${isAuthor && d.status === 'resolvido' && !d.confirmedResolved ? `
          <button class="btn btn-primary" data-action="confirm-resolved" data-id="${d.id}">${ICONS.check} Confirmar que o problema foi resolvido</button>
        ` : ''}

        ${isMod ? moderationPanel(d) : ''}
        ${isAdmin ? adminPanel(d) : ''}
      </div>
    </div>

    <div class="comments-section">
      <h3>Comentários (${d.comments.length})</h3>
      <form class="comment-form" data-action="submit-comment" data-id="${d.id}">
        <input type="text" name="text" placeholder="Escreva um comentário..." maxlength="300" required>
        <button type="submit" class="btn btn-primary">Enviar</button>
      </form>
      <div class="comment-list">
        ${renderComments(d, user, isMod)}
      </div>
    </div>
  </div>`;
}

/* comentários em árvore, com respostas aninhadas */

function renderComments(d, user, isMod) {
  const roots = d.comments.filter(c => !c.parentId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (roots.length === 0) return '<p class="muted">Seja o primeiro a comentar.</p>';
  return roots.map(c => renderCommentNode(c, d, isMod, 0)).join('');
}

function renderCommentNode(c, d, isMod, depth) {
  const children = d.comments.filter(x => x.parentId === c.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const indent = Math.min(depth, 4) * 26;
  const replying = state.replyingTo === c.id;
  return `
  <div class="comment-thread" style="margin-left:${indent}px">
    <div class="comment">
      ${avatarHTML(c.authorId, c.authorName, 'small')}
      <div class="comment-body">
        <div class="comment-head"><b>${escapeHTML(c.authorName)}</b><small>${timeAgo(c.createdAt)}</small></div>
        <p>${escapeHTML(c.text)}</p>
        <div class="comment-actions">
          <button type="button" class="link-btn" data-action="toggle-reply" data-id="${c.id}">${replying ? 'Cancelar' : 'Responder'}</button>
        </div>
      </div>
      ${isMod ? `<button class="icon-btn tiny" data-action="remove-comment" data-id="${d.id}" data-cid="${c.id}" title="Remover comentário">${ICONS.trash}</button>` : ''}
    </div>
    ${replying ? `
      <form class="reply-form" data-action="submit-reply" data-id="${d.id}" data-parent="${c.id}">
        <input type="text" name="text" placeholder="Responder a ${escapeHTML(c.authorName)}..." maxlength="300" required autofocus>
        <button type="submit" class="btn btn-primary btn-sm">Enviar</button>
      </form>` : ''}
    ${children.map(ch => renderCommentNode(ch, d, isMod, depth + 1)).join('')}
  </div>`;
}

function moderationPanel(d) {
  return `
  <div class="mod-panel">
    <div class="mod-panel-title">${ICONS.shield} Painel de moderação</div>
    <div class="mod-panel-actions">
      ${d.validated ? `<span class="pill pill-green">${ICONS.check} Já validada</span>` : `<button class="btn btn-outline" data-action="mod-validate" data-id="${d.id}">${ICONS.check} Validar denúncia</button>`}
      <button class="btn btn-danger-outline" data-action="mod-remove" data-id="${d.id}">${ICONS.trash} Remover conteúdo</button>
    </div>
  </div>`;
}

function adminPanel(d) {
  return `
  <div class="admin-panel">
    <div class="mod-panel-title">${ICONS.shield} Painel administrativo</div>
    <form class="admin-status-form" data-action="admin-status" data-id="${d.id}">
      <label>
        <span>Atualizar status</span>
        <select name="status">
          ${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </label>
      <button type="submit" class="btn btn-outline">Salvar status</button>
    </form>
    <form class="admin-response-form" data-action="admin-respond" data-id="${d.id}">
      <label>
        <span>Resposta oficial</span>
        <textarea name="response" rows="2" placeholder="Escreva uma resposta oficial para o cidadão...">${d.officialResponse ? escapeHTML(d.officialResponse.text) : ''}</textarea>
      </label>
      <button type="submit" class="btn btn-outline">Publicar resposta</button>
    </form>
  </div>`;
}

/* ---------------- tela de perfil ---------------- */

function profileScreen(user) {
  const mine = getDenuncias().filter(d => d.authorId === user.id && !d.removido)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return `
  <div class="page-narrow">
    <div class="profile-head card">
      <button type="button" class="avatar-edit-wrap" data-action="open-profile-photo-source" title="Alterar foto de perfil">
        ${avatarHTML(user.id, user.name, 'large')}
        <span class="avatar-edit-badge">${ICONS.camera}</span>
      </button>
      <div>
        <h1>${escapeHTML(user.name)}</h1>
        <p class="muted">${escapeHTML(user.email)}</p>
        <span class="pill pill-green">${ROLE_LABELS[user.role]}</span>
      </div>
    </div>

    <h3 class="section-title">Minhas denúncias (${mine.length})</h3>
    ${mine.length === 0 ? emptyState('Você ainda não criou denúncias', 'Registre um problema urbano para começar a acompanhar aqui.') : `
      <div class="list-simple">
        ${mine.map(d => {
          const st = STATUSES[d.status]; const cat = CATEGORIES[d.category];
          return `
          <div class="list-row" data-action="go" data-screen="detail" data-id="${d.id}">
            <span class="chip">${cat.icon}</span>
            <div class="list-row-main">
              <b>${escapeHTML(d.title)}</b>
              <small>${escapeHTML(d.location)} · ${formatDate(d.createdAt)}</small>
            </div>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>`;
        }).join('')}
      </div>
    `}
  </div>`;
}

/* ---------------- painel do super admin ---------------- */

function adminScreen() {
  const users = getUsers();
  const f = state.adminFilters;
  let list = users.slice();
  if (f.role !== 'all') list = list.filter(u => u.role === f.role);
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    list = list.filter(u => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
  }

  return `
  <div class="page-head">
    <div>
      <h1>Painel do Super Admin</h1>
      <p class="muted">Gerencie contas de administradores, moderadores e super admins.</p>
    </div>
    <button class="btn btn-primary" data-action="open-create-user">${ICONS.plus} Criar usuário</button>
  </div>

  <div class="filters">
    <label class="search-box">
      ${ICONS.search}
      <input type="text" placeholder="Buscar por nome ou ID..." value="${escapeHTML(f.search)}" data-action="admin-filter-search">
    </label>
    <select data-action="admin-filter-role">
      <option value="all" ${f.role === 'all' ? 'selected' : ''}>Todas as funções</option>
      <option value="cidadao" ${f.role === 'cidadao' ? 'selected' : ''}>Cidadão</option>
      <option value="moderador" ${f.role === 'moderador' ? 'selected' : ''}>Moderador</option>
      <option value="admin" ${f.role === 'admin' ? 'selected' : ''}>Administrador</option>
      <option value="superadmin" ${f.role === 'superadmin' ? 'selected' : ''}>Super Admin</option>
    </select>
  </div>

  <div class="table-wrap card">
    <table class="user-table">
      <thead><tr><th>Usuário</th><th>ID</th><th>Função</th><th>Criado em</th><th></th></tr></thead>
      <tbody>
        ${list.map(u => `
          <tr>
            <td class="user-cell">${avatarHTML(u.id, u.name, 'small')}<div><b>${escapeHTML(u.name)}</b><small>${escapeHTML(u.email)}</small></div></td>
            <td><code>${u.id}</code></td>
            <td><span class="pill ${u.role === 'superadmin' ? 'pill-black' : 'pill-green'}">${ROLE_LABELS[u.role]}</span></td>
            <td>${formatDate(u.createdAt)}</td>
            <td><button class="btn btn-outline btn-sm" data-action="open-reset-password" data-id="${u.id}">${ICONS.key} Redefinir senha</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${list.length === 0 ? `<div class="empty-state"><p>Nenhum usuário encontrado.</p></div>` : ''}
  </div>`;
}

/* ---------------- modais genéricos ---------------- */

function openModal(html) {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-overlay" data-action="close-modal">
      <div class="modal" data-stop>
        ${html}
      </div>
    </div>`;
}

function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function createUserModal() {
  openModal(`
    <div class="modal-head">
      <h2>Criar novo usuário</h2>
      <button class="icon-btn" data-action="close-modal">${ICONS.close}</button>
    </div>
    <form data-action="submit-create-user" class="form">
      <label class="field"><span>Nome completo</span><input type="text" name="name" required></label>
      <label class="field"><span>E-mail</span><input type="email" name="email" required></label>
      <label class="field"><span>Senha</span><input type="password" name="password" minlength="4" required></label>
      <label class="field">
        <span>Função</span>
        <select name="role" required>
          <option value="admin">Administrador</option>
          <option value="moderador">Moderador</option>
          <option value="superadmin">Super Admin</option>
        </select>
      </label>
      <button type="submit" class="btn btn-primary btn-block">Criar usuário</button>
    </form>
  `);
}

function resetPasswordModal(userId) {
  const u = findUserById(userId);
  if (!u) return;
  openModal(`
    <div class="modal-head">
      <h2>Redefinir senha</h2>
      <button class="icon-btn" data-action="close-modal">${ICONS.close}</button>
    </div>
    <p class="muted">Usuário: <b>${escapeHTML(u.name)}</b> (${escapeHTML(u.email)}). A senha atual não é exibida por segurança.</p>
    <form data-action="submit-reset-password" data-id="${u.id}" class="form">
      <label class="field"><span>Nova senha</span><input type="password" name="password" minlength="4" required autofocus></label>
      <button type="submit" class="btn btn-primary btn-block">Salvar nova senha</button>
    </form>
  `);
}

/* ---------------- escolha de origem da mídia (galeria x câmera) ---------------- */

function openPhotoSourceModal({ title, allowVideo, onFile, onCamera }) {
  openModal(`
    <div class="modal-head">
      <h2>${escapeHTML(title)}</h2>
      <button class="icon-btn" data-action="close-modal">${ICONS.close}</button>
    </div>
    <div class="source-options">
      <button type="button" class="source-option" data-action="source-file">${ICONS.image}<span>Escolher da galeria</span></button>
      <button type="button" class="source-option" data-action="source-camera">${ICONS.camera}<span>Usar câmera</span></button>
    </div>
    ${allowVideo ? `<p class="muted source-hint">Vídeos gravados pela câmera ou enviados da galeria têm limite de 3 minutos.</p>` : ''}
  `);
  state.sourceCallbacks = { onFile, onCamera };
}

/* ---------------- captura por câmera (foto e vídeo) ---------------- */

function openCameraCapture({ allowVideo, title, onDone }) {
  if (!Camera.isSupported()) {
    showToast('Câmera não suportada neste navegador.', 'error');
    return;
  }
  state.cameraAllowVideo = !!allowVideo;
  state.cameraMode = 'photo';
  state.cameraRecording = false;
  state.cameraOnDone = onDone;

  document.getElementById('modal-root').innerHTML = cameraModalHTML(title);

  const videoEl = document.getElementById('camera-preview');
  Camera.start(videoEl).catch(() => {
    showToast('Não foi possível acessar a câmera. Verifique as permissões do navegador.', 'error');
    closeModal();
  });
}

function cameraModalHTML(title) {
  return `
  <div class="modal-overlay" data-action="camera-cancel">
    <div class="modal modal-camera" data-stop>
      <div class="modal-head">
        <h2>${escapeHTML(title || 'Usar câmera')}</h2>
        <button class="icon-btn" data-action="camera-cancel">${ICONS.close}</button>
      </div>
      <div class="camera-preview-wrap">
        <video id="camera-preview" autoplay playsinline muted></video>
        <div id="camera-rec-badge" class="camera-rec-badge" hidden>
          <span class="dot"></span><span id="camera-timer">00:00</span> / ${formatMMSS(Camera.MAX_VIDEO_SECONDS)}
        </div>
      </div>
      ${state.cameraAllowVideo ? `
        <div class="camera-mode-toggle">
          <button type="button" class="${state.cameraMode === 'photo' ? 'active' : ''}" data-action="camera-mode" data-mode="photo">${ICONS.image} Foto</button>
          <button type="button" class="${state.cameraMode === 'video' ? 'active' : ''}" data-action="camera-mode" data-mode="video">${ICONS.video} Vídeo (máx. 3 min)</button>
        </div>` : ''}
      <div class="camera-actions" id="camera-actions">
        ${cameraActionButtonsHTML()}
      </div>
    </div>
  </div>`;
}

function cameraActionButtonsHTML() {
  if (state.cameraAllowVideo && state.cameraMode === 'video') {
    return `<button type="button" class="btn ${state.cameraRecording ? 'btn-danger-outline' : 'btn-primary'} btn-block" data-action="camera-record-toggle">
      ${state.cameraRecording ? ICONS.check + ' Parar e usar vídeo' : ICONS.video + ' Iniciar gravação'}
    </button>`;
  }
  return `<button type="button" class="btn btn-primary btn-block" data-action="camera-capture-photo">${ICONS.camera} Capturar foto</button>`;
}

function updateCameraModeUI() {
  document.querySelectorAll('.camera-mode-toggle button').forEach(b => b.classList.toggle('active', b.dataset.mode === state.cameraMode));
  const actions = document.getElementById('camera-actions');
  if (actions) actions.innerHTML = cameraActionButtonsHTML();
}

function handleRecordToggle() {
  const badge = document.getElementById('camera-rec-badge');
  const timerEl = document.getElementById('camera-timer');

  if (!state.cameraRecording) {
    state.cameraRecording = true;
    if (badge) badge.hidden = false;
    updateCameraModeUI();
    Camera.startRecording(
      (secs) => { if (timerEl) timerEl.textContent = formatMMSS(secs); },
      () => { finishRecording(); } // limite de 3 minutos atingido
    );
  } else {
    finishRecording();
  }
}

async function finishRecording() {
  state.cameraRecording = false;
  const badge = document.getElementById('camera-rec-badge');
  if (badge) badge.hidden = true;
  updateCameraModeUI();

  const result = await Camera.stopRecording();
  if (result && result.blob && result.blob.size > 0) {
    const dataUrl = await blobToBase64(result.blob);
    finalizeCameraCapture({ type: 'video', dataUrl, durationSeconds: result.duration });
  }
}

function finalizeCameraCapture(result) {
  Camera.stop();
  const cb = state.cameraOnDone;
  state.cameraOnDone = null;
  closeModal();
  if (cb) cb(result);
}

/* ---------------- rascunho: mídia e campos do formulário ---------------- */

function setDraftMedia(media) {
  state.pendingMedia = media;
  const user = currentUser();
  if (user) { state.draft = { ...state.draft, media }; saveDraft(user.id, state.draft); }
  render();
}

function persistDraftFromForm(form) {
  const user = currentUser();
  if (!user) return;
  const data = Object.fromEntries(new FormData(form).entries());
  state.draft = { ...state.draft, ...data, media: state.pendingMedia };
  saveDraft(user.id, state.draft);
}

function handleMediaFileSelect(input) {
  const file = input.files && input.files[0];
  input.value = ''; // permite selecionar o mesmo arquivo novamente depois
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) { showToast('Selecione um arquivo de imagem ou vídeo.', 'error'); return; }

  if (isVideo) {
    const tempUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const duration = probe.duration;
      URL.revokeObjectURL(tempUrl);
      if (duration > Camera.MAX_VIDEO_SECONDS) {
        showToast('O vídeo excede o limite de 3 minutos.', 'error');
        return;
      }
      readFileAsMedia(file, 'video', Math.round(duration));
    };
    probe.src = tempUrl;
  } else {
    readFileAsMedia(file, 'photo', null);
  }
}

function readFileAsMedia(file, type, durationSeconds) {
  const reader = new FileReader();
  reader.onload = () => setDraftMedia({ type, url: reader.result, durationSeconds });
  reader.readAsDataURL(file);
}

function handleProfilePhotoFileSelect(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Selecione uma imagem válida para a foto de perfil.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const user = currentUser();
    if (!user) return;
    updateUserPhoto(user.id, reader.result);
    render();
    showToast('Foto de perfil atualizada!', 'success');
  };
  reader.readAsDataURL(file);
}

/* ---------------- delegação de eventos (em document, para alcançar o #modal-root também) ---------------- */

document.addEventListener('click', (e) => {
  // fecha o dropdown de notificações ao clicar fora dele
  const outsideNotifClick = state.notifOpen && !e.target.closest('.notif-wrap');
  if (outsideNotifClick) state.notifOpen = false;

  const closeModalTarget = e.target.closest('[data-action="close-modal"]');
  if (closeModalTarget) {
    const clickedInsideModal = !!e.target.closest('[data-stop]');
    const clickedCloseButton = !!closeModalTarget.closest('.icon-btn');
    if (!clickedInsideModal || clickedCloseButton) {
      closeModal();
      if (outsideNotifClick) render();
      return;
    }
  }

  const cameraCancelTarget = e.target.closest('[data-action="camera-cancel"]');
  if (cameraCancelTarget) {
    const clickedInsideModal = !!e.target.closest('[data-stop]');
    const clickedCloseButton = !!cameraCancelTarget.closest('.icon-btn');
    if (!clickedInsideModal || clickedCloseButton) {
      Camera.stop();
      state.cameraOnDone = null;
      closeModal();
      if (outsideNotifClick) render();
      return;
    }
  }

  const el = e.target.closest('[data-action]');
  if (!el) {
    if (outsideNotifClick) render();
    return;
  }

  const action = el.dataset.action;

  switch (action) {
    case 'go':
      go(el.dataset.screen, el.dataset.id ? { selectedId: el.dataset.id } : { selectedId: null });
      break;

    case 'auth-mode':
      state.authMode = el.dataset.mode;
      render();
      break;

    case 'use-my-location':
      useCurrentLocation();
      break;

    case 'logout':
      logout();
      state.screen = 'auth';
      render();
      showToast('Você saiu da sua conta.', 'success');
      break;

    case 'like':
      toggleLike(el.dataset.id);
      render();
      break;

    case 'confirm-resolved':
      citizenConfirmResolved(el.dataset.id);
      render();
      showToast('Obrigado por confirmar! ✅', 'success');
      break;

    case 'mod-validate':
      moderateValidate(el.dataset.id);
      render();
      showToast('Denúncia validada.', 'success');
      break;

    case 'mod-remove':
      if (confirm('Remover este conteúdo? Ele deixará de ser exibido publicamente.')) {
        moderateRemove(el.dataset.id);
        go('dashboard');
        showToast('Conteúdo removido pela moderação.', 'success');
      }
      break;

    case 'remove-comment':
      removeComment(el.dataset.id, el.dataset.cid);
      render();
      break;

    case 'toggle-reply':
      state.replyingTo = state.replyingTo === el.dataset.id ? null : el.dataset.id;
      render();
      break;

    case 'toggle-notifications':
      state.notifOpen = !state.notifOpen;
      render();
      break;

    case 'mark-all-read': {
      const u = currentUser();
      if (u) markAllRead(u.id);
      render();
      break;
    }

    case 'open-notification':
      markOneRead(el.dataset.id);
      go('detail', { selectedId: el.dataset.denuncia });
      break;

    case 'discard-draft': {
      const u = currentUser();
      if (u) clearDraft(u.id);
      state.draft = {};
      state.pendingMedia = null;
      render();
      showToast('Rascunho descartado.', 'success');
      break;
    }

    case 'open-create-user':
      createUserModal();
      break;

    case 'open-reset-password':
      resetPasswordModal(el.dataset.id);
      break;

    /* ---- mídia da denúncia ---- */
    case 'open-media-source':
      openPhotoSourceModal({
        title: 'Adicionar foto ou vídeo',
        allowVideo: true,
        onFile: () => document.getElementById('media-input').click(),
        onCamera: () => openCameraCapture({
          allowVideo: true,
          title: 'Capturar mídia da denúncia',
          onDone: (res) => setDraftMedia({
            type: res.type,
            url: res.dataUrl,
            durationSeconds: res.durationSeconds || null
          }),
        }),
      });
      break;

    case 'remove-media':
      setDraftMedia(null);
      break;

    case 'use-current-location':
      useCurrentLocation();
      break;

    /* ---- foto de perfil ---- */
    case 'open-profile-photo-source':
      openPhotoSourceModal({
        title: 'Foto de perfil',
        allowVideo: false,
        onFile: () => document.getElementById('profile-photo-input').click(),
        onCamera: () => openCameraCapture({
          allowVideo: false,
          title: 'Tirar foto de perfil',
          onDone: (res) => {
            const user = currentUser();
            if (user) updateUserPhoto(user.id, res.dataUrl);
            render();
            showToast('Foto de perfil atualizada!', 'success');
          },
        }),
      });
      break;

    /* ---- modal genérico de escolha de origem ---- */
    case 'source-file': {
      const cb = state.sourceCallbacks;
      closeModal();
      if (cb && cb.onFile) cb.onFile();
      break;
    }

    case 'source-camera': {
      const cb = state.sourceCallbacks;
      closeModal();
      if (cb && cb.onCamera) cb.onCamera();
      break;
    }

    /* ---- modal de câmera ---- */
    case 'camera-mode':
      state.cameraMode = el.dataset.mode;
      updateCameraModeUI();
      break;

    case 'camera-capture-photo': {
      const videoEl = document.getElementById('camera-preview');
      const dataUrl = Camera.capturePhoto(videoEl);
      finalizeCameraCapture({ type: 'photo', dataUrl });
      break;
    }

    case 'camera-record-toggle':
      handleRecordToggle();
      break;

    default:
      break;
  }
});

document.addEventListener('change', (e) => {
  if (!e.target.dataset) return;

  if (e.target.dataset.action === 'filter-category') {
    state.filters.category = e.target.value;
    render();
  }

  if (e.target.dataset.action === 'filter-status') {
    state.filters.status = e.target.value;
    render();
  }

  if (e.target.dataset.action === 'filter-sort') {
    state.filters.sort = e.target.value;
    render();
  }

  if (e.target.dataset.action === 'admin-filter-role') {
    state.adminFilters.role = e.target.value;
    render();
  }

  if (e.target.id === 'media-input') {
    handleMediaFileSelect(e.target);
  }

  if (e.target.id === 'profile-photo-input') {
    handleProfilePhotoFileSelect(e.target);
  }

  const createForm = e.target.closest('form[data-action="submit-create"]');
  if (createForm && e.target.name === 'category') {
    persistDraftFromForm(createForm);
  }
});

document.addEventListener('input', (e) => {
  if (!e.target.dataset) return;

  if (e.target.dataset.action === 'filter-search') {
    state.filters.search = e.target.value;
    render();
    focusSearchEnd();
  }

  if (e.target.dataset.action === 'admin-filter-search') {
    state.adminFilters.search = e.target.value;
    render();
    focusSearchEnd(true);
  }

  // salva o rascunho da denúncia silenciosamente, sem re-renderizar (preserva o foco/cursor)
  const createForm = e.target.closest('form[data-action="submit-create"]');
  if (createForm) persistDraftFromForm(createForm);
});

function focusSearchEnd(isAdmin) {
  const sel = isAdmin
    ? '[data-action="admin-filter-search"]'
    : '[data-action="filter-search"]';

  const input = document.querySelector(sel);

  if (input) {
    input.focus();
    const v = input.value;
    input.value = '';
    input.value = v;
  }
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-action]');
  if (!form) return;

  e.preventDefault();

  const action = form.dataset.action;
  const data = Object.fromEntries(new FormData(form).entries());

  switch (action) {
    case 'submit-login': {
      const res = await login(data);

      if (!res.ok) return showToast(res.msg, 'error');

      state.screen = 'dashboard';
      render();
      showToast(`Bem-vindo, ${res.user.name.split(' ')[0]}!`, 'success');
      break;
    }

    case 'submit-register': {
      const res = await registerCitizen(data);

      if (!res.ok) return showToast(res.msg, 'error');

      state.screen = 'dashboard';
      render();
      showToast('Conta criada com sucesso!', 'success');
      break;
    }

    case 'submit-create': {
      const res = createDenuncia({ ...data, media: state.pendingMedia });

      if (!res.ok) return showToast(res.msg, 'error');

      const u = currentUser();
      if (u) clearDraft(u.id);

      state.draft = null;
      state.pendingMedia = null;

      go('detail', { selectedId: res.denuncia.id });
      showToast('Denúncia publicada!', 'success');
      break;
    }

    case 'submit-comment': {
      addComment(form.dataset.id, data.text);
      form.reset();
      render();
      break;
    }

    case 'submit-reply': {
      addComment(form.dataset.id, data.text, form.dataset.parent);
      state.replyingTo = null;
      render();
      break;
    }

    case 'admin-status': {
      adminSetStatus(form.dataset.id, data.status);
      render();
      showToast('Status atualizado.', 'success');
      break;
    }

    case 'admin-respond': {
      const res = adminRespond(form.dataset.id, data.response || '');

      if (res && res.ok === false) {
        return showToast('Escreva uma resposta antes de publicar.', 'error');
      }

      render();
      showToast('Resposta oficial publicada.', 'success');
      break;
    }

    case 'submit-create-user': {
      const res = createUserByAdmin(data);

      if (!res.ok) return showToast(res.msg, 'error');

      closeModal();
      render();
      showToast('Usuário criado com sucesso.', 'success');
      break;
    }

    case 'submit-reset-password': {
      const res = resetUserPassword(form.dataset.id, data.password);

      if (!res.ok) return showToast(res.msg, 'error');

      closeModal();
      showToast('Senha redefinida com sucesso.', 'success');
      break;
    }

    default:
      break;
  }
});

/* ---------------- inicialização ---------------- */

ensureSeedData();
if (currentUser()) state.screen = 'dashboard';
render();