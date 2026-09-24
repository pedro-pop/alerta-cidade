const API_URL = 'http://127.0.0.1:8000';

function getAccessToken() {
    return localStorage.getItem('ac_access_token');
}

function saveAccessToken(token) {
    localStorage.setItem('ac_access_token', token);
}

function clearAccessToken() {
    localStorage.removeItem('ac_access_token');
}

async function apiFetch(endpoint, options = {}) {
    const token = getAccessToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(
            data?.detail ||
            data?.message ||
            'Erro ao comunicar com a API.'
        );
    }

    return data;
}


async function apiRegister({ name, email, password }) {
    return apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name,
            email,
            password
        })
    });
}


async function apiLogin({ email, password }) {
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email,
            password
        })
    });

    if (data.access_token) {
        saveAccessToken(data.access_token);
    }

    return data;
}


function apiLogout() {
    clearAccessToken();
    localStorage.removeItem('ac_session');
}


async function apiMe() {
    return apiFetch('/auth/me');
}


async function apiCreateDenuncia(data) {
    return apiFetch('/denuncias/', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}


async function apiGetDenuncias() {
    return apiFetch('/denuncias/');
}


async function apiGetDenuncia(id) {
    return apiFetch(`/denuncias/${id}`);
}


async function apiUpdateDenuncia(id, data) {
    return apiFetch(`/denuncias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
}


async function apiDeleteDenuncia(id) {
    return apiFetch(`/denuncias/${id}`, {
        method: 'DELETE'
    });
}


async function apiGetComments(denunciaId) {
    return apiFetch(
        `/interacoes/denuncias/${denunciaId}/comments`
    );
}


async function apiCreateComment(denunciaId, content) {
    return apiFetch(
        `/interacoes/denuncias/${denunciaId}/comments`,
        {
            method: 'POST',
            body: JSON.stringify({
                content
            })
        }
    );
}


async function apiUpdateComment(commentId, content) {
    return apiFetch(
        `/interacoes/comments/${commentId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                content
            })
        }
    );
}


async function apiDeleteComment(commentId) {
    return apiFetch(
        `/interacoes/comments/${commentId}`,
        {
            method: 'DELETE'
        }
    );
}


async function apiLikeDenuncia(denunciaId) {
    return apiFetch(
        `/interacoes/denuncias/${denunciaId}/like`,
        {
            method: 'POST'
        }
    );
}


async function apiUnlikeDenuncia(denunciaId) {
    return apiFetch(
        `/interacoes/denuncias/${denunciaId}/like`,
        {
            method: 'DELETE'
        }
    );
}


async function apiCountLikes(denunciaId) {
    return apiFetch(
        `/interacoes/denuncias/${denunciaId}/likes`
    );
}


async function apiGetNotifications() {
    return apiFetch('/notificacoes/');
}


async function apiMarkNotificationRead(notificationId) {
    return apiFetch(
        `/notificacoes/${notificationId}/read`,
        {
            method: 'PATCH'
        }
    );
}


async function apiMarkAllNotificationsRead() {
    return apiFetch(
        '/notificacoes/read-all',
        {
            method: 'PATCH'
        }
    );
}