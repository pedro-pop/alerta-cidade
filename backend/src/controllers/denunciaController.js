const fs = require('fs');
const path = require('path');

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { publicUrlFor } = require('../middlewares/upload');
const { getVideoDurationSeconds } = require('../utils/videoDuration');
const { notifyUnlessSelf } = require('../services/notificationService');

const STATUS_LABELS = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em análise',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  REJEITADO: 'Rejeitado',
};

const denunciaListSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  location: true,
  latitude: true,
  longitude: true,
  status: true,
  validated: true,
  removido: true,
  confirmed_resolved: true,
  created_at: true,
  updated_at: true,
  user_id: true,

  profiles_denuncias_user_idToprofiles: {
    select: {
      id: true,
      name: true,
      photo_url: true,
    },
  },

  denuncia_media: true,

  _count: {
    select: {
      comments: true,
      likes: true,
    },
  },
};

function serializeDenuncia(d, likedByMe) {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    location: d.location,
    latitude: d.latitude,
    longitude: d.longitude,
    status: d.status,
    validated: d.validated,
    removed: d.removido,
    confirmedResolved: d.confirmed_resolved,
    createdAt: d.created_at,
    updatedAt: d.updated_at,

    author: d.profiles_denuncias_user_idToprofiles
      ? {
          id: d.profiles_denuncias_user_idToprofiles.id,
          name: d.profiles_denuncias_user_idToprofiles.name,
          photoUrl: d.profiles_denuncias_user_idToprofiles.photo_url,
        }
      : null,

    media: d.denuncia_media || null,
    officialResponse: d.official_response || null,

    commentsCount: d._count ? d._count.comments : 0,
    likesCount: d._count ? d._count.likes : 0,

    likedByMe: !!likedByMe,
  };
}

// GET /api/denuncias
async function list(req, res) {
  const {
    category,
    status,
    search,
    sort,
    page = 1,
    pageSize = 20,
  } = req.validated.query;

  const where = {
    removido: false,

    ...(category ? { category: category.toLowerCase() } : {}),
    ...(status ? { status } : {}),

    ...(search
      ? {
          OR: [
            {
              title: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              location: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === 'old'
      ? { created_at: 'asc' }
      : sort === 'likes'
        ? { likes: { _count: 'desc' } }
        : { created_at: 'desc' };

  const [total, rows] = await Promise.all([
    prisma.denuncia.count({ where }),

    prisma.denuncia.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: denunciaListSelect,
    }),
  ]);

  let likedIds = new Set();

  if (req.user) {
    const myLikes = await prisma.like.findMany({
      where: {
        user_id: req.user.id,
        denuncia_id: {
          in: rows.map((r) => r.id),
        },
      },
      select: {
        denuncia_id: true,
      },
    });

    likedIds = new Set(myLikes.map((l) => l.denuncia_id));
  }

  res.json({
    page,
    pageSize,
    total,
    denuncias: rows.map((d) =>
      serializeDenuncia(d, likedIds.has(d.id))
    ),
  });
}

// GET /api/denuncias/:id
async function getById(req, res) {
  const { id } = req.validated.params;

  const d = await prisma.denuncia.findUnique({
    where: { id },
    select: denunciaListSelect,
  });

  if (!d || d.removido) {
    throw ApiError.notFound('Denúncia não encontrada.');
  }

  const comments = await prisma.comment.findMany({
    where: {
      denuncia_id: id,
    },
    orderBy: {
      created_at: 'asc',
    },
    include: {
      profiles: {
        select: {
          id: true,
          name: true,
          photo_url: true,
        },
      },
    },
  });

  let likedByMe = false;

  if (req.user) {
    likedByMe = !!(
      await prisma.like.findUnique({
        where: {
          denuncia_id_user_id: {
            denuncia_id: id,
            user_id: req.user.id,
          },
        },
      })
    );
  }

  res.json({
    denuncia: serializeDenuncia(d, likedByMe),
    comments,
  });
}

// POST /api/denuncias
async function create(req, res) {
  const {
    title,
    description,
    category,
    location,
    latitude,
    longitude,
  } = req.validated.body;

  const normalizedCategory = category.toLowerCase();

  try {
    const mediaData = req.file
      ? await prepareMedia(req.file)
      : null;

    const full = await prisma.$transaction(async (transaction) => {
      const denuncia = await transaction.denuncia.create({
        data: {
          title,
          description,
          category: normalizedCategory,
          location,
          latitude,
          longitude,

          profiles_denuncias_user_idToprofiles: {
            connect: {
              id: req.user.id,
            },
          },
        },
      });

      if (mediaData) {
        await transaction.denuncia_media.create({
          data: {
            ...mediaData,
            denuncia_id: denuncia.id,
          },
        });
      }

      return transaction.denuncia.findUnique({
        where: {
          id: denuncia.id,
        },
        select: denunciaListSelect,
      });
    });

    res.status(201).json({
      denuncia: serializeDenuncia(full, false),
    });
  } catch (error) {
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }

    throw error;
  }
}

async function prepareMedia(file) {
  const { fileTypeFromFile } = await import('file-type');

  const detectedType = await fileTypeFromFile(file.path);
  const claimedType = file.mimetype.split('/')[0];
  const actualType = detectedType?.mime.split('/')[0];

  if (
    !detectedType ||
    !['image', 'video'].includes(actualType) ||
    claimedType !== actualType
  ) {
    throw ApiError.badRequest(
      'O conteúdo do arquivo não corresponde a uma imagem ou vídeo válido.'
    );
  }

  const isVideo = actualType === 'video';

  if (!isVideo) {
    const maxBytes = env.maxImageSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      throw ApiError.badRequest(
        `Imagem excede o limite de ${env.maxImageSizeMb}MB.`
      );
    }
  }

  let durationSeconds = null;

  if (isVideo) {
    durationSeconds = await getVideoDurationSeconds(file.path);

    if (durationSeconds === null) {
      throw ApiError.badRequest(
        'Não foi possível validar a duração do vídeo. Tente outro arquivo.'
      );
    }

    if (durationSeconds > env.maxVideoDurationSeconds) {
      throw ApiError.badRequest(
        `Vídeo excede o limite de ${
          env.maxVideoDurationSeconds / 60
        } minutos.`
      );
    }
  }

  const originalExtension = path.extname(file.filename);

  const safePath = path.join(
    path.dirname(file.path),
    `${path.basename(
      file.filename,
      originalExtension
    )}.${detectedType.ext}`
  );

  await fs.promises.rename(file.path, safePath);

  file.path = safePath;

  return {
    media_type: isVideo ? 'video' : 'image',
    
    storage_path: file.path,
    
  };
}

// POST /api/denuncias/:id/like
async function toggleLike(req, res) {
  const { id } = req.validated.params;

  const denuncia = await prisma.denuncia.findUnique({
    where: { id },
  });

  if (!denuncia || denuncia.removido) {
    throw ApiError.notFound('Denúncia não encontrada.');
  }

  const existing = await prisma.like.findUnique({
    where: {
      denuncia_id_user_id: {
      denuncia_id: id,
      user_id: req.user.id,
      },
    },
  });

  if (existing) {
    await prisma.like.delete({
      where: {
        id: existing.id,
      },
    });
  } else {
    await prisma.like.create({
      data: {
        user_id: req.user.id,
        denuncia_id: id,
      },
    });
  }

  const likesCount = await prisma.like.count({
    where: {
      denuncia_id: id,
    },
  });

  res.json({
    liked: !existing,
    likesCount,
  });
}

// POST /api/denuncias/:id/validate
async function moderateValidate(req, res) {
  const { id } = req.validated.params;

  const denuncia = await prisma.denuncia.update({
    where: { id },
    data: {
      validated: true,
    },
  });

  await notifyUnlessSelf(
    denuncia.user_id,
    req.user.id,
    `Sua denúncia "${denuncia.title}" foi validada pela moderação.`,
    id
  );

  res.json({ denuncia });
}

// POST /api/denuncias/:id/remove
async function moderateRemove(req, res) {
  const { id } = req.validated.params;

  const denuncia = await prisma.denuncia.update({
    where: { id },
    data: {
      removido: true,
    },
  });

  await notifyUnlessSelf(
    denuncia.user_id,
    req.user.id,
    `Sua denúncia "${denuncia.title}" foi removida pela moderação.`,
    id
  );

  res.json({ denuncia });
}

// PATCH /api/denuncias/:id/status
async function setStatus(req, res) {
  const { id } = req.validated.params;
  const { status } = req.validated.body;

  const denuncia = await prisma.denuncia.update({
    where: { id },
    data: {
      status,
    },
  });

  await notifyUnlessSelf(
    denuncia.user_id,
    req.user.id,
    `Sua denúncia "${denuncia.title}" mudou para o status "${STATUS_LABELS[status]}".`,
    id
  );

  res.json({ denuncia });
}

// POST /api/denuncias/:id/respond
async function respond(req, res) {
  const { id } = req.validated.params;
  const { text } = req.validated.body;

  const denuncia = await prisma.denuncia.findUnique({
    where: { id },
  });

  if (!denuncia) {
    throw ApiError.notFound('Denúncia não encontrada.');
  }

  const officialResponse = await prisma.officialResponse.upsert({
    where: {
      denuncia_id: id,
    },
    update: {
      text,
      author_id: req.user.id,
    },
    create: {
      text,
      author_id: req.user.id,
      denuncia_id: id,
    },
  });

  await notifyUnlessSelf(
    denuncia.user_id,
    req.user.id,
    `Você recebeu uma resposta oficial na denúncia "${denuncia.title}".`,
    id
  );

  res.json({ officialResponse });
}

// POST /api/denuncias/:id/confirm-resolved
async function confirmResolved(req, res) {
  const { id } = req.validated.params;

  const denuncia = await prisma.denuncia.findUnique({
    where: { id },
  });

  if (!denuncia) {
    throw ApiError.notFound('Denúncia não encontrada.');
  }

  if (denuncia.user_id !== req.user.id) {
    throw ApiError.forbidden(
      'Apenas o autor da denúncia pode confirmar a resolução.'
    );
  }

  if (denuncia.status !== 'RESOLVIDO') {
    throw ApiError.badRequest(
      'A denúncia ainda não foi marcada como resolvida pela administração.'
    );
  }

  const updated = await prisma.denuncia.update({
    where: { id },
    data: {
      confirmed_resolved: true,
    },
  });

  res.json({
    denuncia: updated,
  });
}

module.exports = {
  list,
  getById,
  create,
  toggleLike,
  moderateValidate,
  moderateRemove,
  setStatus,
  respond,
  confirmResolved,
};