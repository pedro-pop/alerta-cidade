const supabase = require('../config/supabase');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized(
      'Token de autenticação ausente.'
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw ApiError.unauthorized('Token inválido ou expirado.');
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    throw ApiError.unauthorized('Perfil do usuário não encontrado.');
  }

  req.user = {
    id: profile.id,
    name: profile.name,
    email: user.email,
    role: profile.role,
    photoUrl: profile.photo_url,
  };

  next();
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Esta ação exige um dos papéis: ${allowedRoles.join(', ')}.`
      );
    }

    next();
  };
}

async function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (profile) {
        req.user = {
          id: profile.id,
          name: profile.name,
          email: user.email,
          role: profile.role,
          photoUrl: profile.photo_url,
        };
      }
    }
  } catch (err) {
    // visitante anônimo
  }

  next();
}

module.exports = {
  authenticate,
  authorize,
  optionalAuthenticate,
};