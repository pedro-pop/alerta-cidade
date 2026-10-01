const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const sanitizeUser = require('../utils/sanitizeUser');
const { publicUrlFor } = require('../middlewares/upload');
const { getSupabaseAdmin } = require('../config/supabaseAdmin');

// GET /api/users — apenas SUPERADMIN. Suporta ?role= e ?search= (nome ou id).
async function listUsers(req, res) {
  const { role, search } = req.validated.query;

  const where = {
    ...(role ? { role: { in: [role, role.toUpperCase()] } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: { authUser: { select: { email: true } } },
  });
  res.json({ users: users.map(sanitizeUser) });
}

// POST /api/users — apenas SUPERADMIN. Cria ADMIN, MODERADOR ou SUPERADMIN.
// (Contas CIDADAO só se criam via /api/auth/register.)
async function createUser(req, res) {
  const { name, email, password, role } = req.validated.body;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data.user) {
    if (error?.code === 'user_already_exists') {
      throw ApiError.conflict('Já existe uma conta com esse e-mail.');
    }
    throw ApiError.badRequest(error?.message || 'Não foi possível criar a conta.');
  }

  try {
    const user = await prisma.user.upsert({
      where: { id: data.user.id },
      update: { name, role },
      create: { id: data.user.id, name, role },
    });
    res.status(201).json({ user: sanitizeUser(user, data.user.email) });
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw error;
  }
}

// PATCH /api/users/:id/role — apenas SUPERADMIN.
async function updateUserRole(req, res) {
  const { id } = req.validated.params;
  const { role } = req.validated.body;

  if (id === req.user.id) {
    throw ApiError.badRequest('Não é possível alterar o próprio papel.');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Usuário não encontrado.');

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    include: { authUser: { select: { email: true } } },
  });

  res.json({ user: sanitizeUser(user) });
}

// PATCH /api/users/:id/password — apenas SUPERADMIN.
// A senha atual nunca é exibida em lugar nenhum — só é possível redefinir.
async function resetPassword(req, res) {
  const { id } = req.validated.params;
  const { password } = req.validated.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('Usuário não encontrado.');

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { password });
  if (error) throw ApiError.badRequest(error.message);

  res.json({ ok: true });
}

// PATCH /api/users/me/photo — qualquer usuário autenticado, para a própria foto.
// Aceita tanto upload de arquivo (multipart, campo "photo") quanto uma foto
// tirada pela câmera no front-end e enviada já como arquivo (o front converte
// o snapshot do <canvas>/MediaRecorder em Blob antes de enviar).
async function updateMyPhoto(req, res) {
  if (!req.file) throw ApiError.badRequest('Envie um arquivo de imagem no campo "photo".');

  const photoUrl = publicUrlFor(req.file);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { photo_url: photoUrl } });

  res.json({ user: sanitizeUser(user, req.user.email) });
}

module.exports = { listUsers, createUser, updateUserRole, resetPassword, updateMyPhoto };
