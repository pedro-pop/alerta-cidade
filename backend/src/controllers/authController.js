const supabase = require('../config/supabase');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const sanitizeUser = require('../utils/sanitizeUser');

async function register(req, res) {
  const { name, email, password } = req.validated.body;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      throw ApiError.conflict('Já existe uma conta com esse e-mail.');
    }

    throw ApiError.badRequest(error.message);
  }

  if (!data.user) {
    throw ApiError.badRequest('Não foi possível criar a conta.');
  }

  let user = await prisma.user.findUnique({
    where: { id: data.user.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: data.user.id,
        name,
        role: 'cidadao',
      },
    });
  }

  res.status(201).json({
    token: data.session?.access_token || null,
    user: sanitizeUser(user),
  });
}

async function login(req, res) {
  const { email, password } = req.validated.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw ApiError.unauthorized('E-mail ou senha inválidos.');
  }

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
  });

  if (!user) {
    throw ApiError.unauthorized('Perfil do usuário não encontrado.');
  }

  res.json({
    token: data.session.access_token,
    user: sanitizeUser(user),
  });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };