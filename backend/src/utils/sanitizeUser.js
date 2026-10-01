// Nunca devolvemos o hash da senha pela API. Toda vez que um controller for
// montar uma resposta contendo um usuário (perfil próprio, item de uma lista
// de usuários, autor de uma denúncia, etc.), passa por aqui antes.

function sanitizeUser(user, email) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: email || user.authUser?.email || user.email || null,
    photoUrl: user.photo_url || user.photoUrl || null,
    createdAt: user.created_at || user.createdAt || null,
  };
}

module.exports = sanitizeUser;
