const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { notifyUnlessSelf } = require('../services/notificationService');

// POST /api/denuncias/:id/comments — cria um comentário, ou uma resposta se body.parentId vier preenchido
async function create(req, res) {
  const { id: denunciaId } = req.validated.params;
  const { text, parentId } = req.validated.body;

  const denuncia = await prisma.denuncia.findUnique({ where: { id: denunciaId } });
  if (!denuncia || denuncia.removed) throw ApiError.notFound('Denúncia não encontrada.');

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.denunciaId !== denunciaId) {
      throw ApiError.badRequest('Comentário-pai inválido para esta denúncia.');
    }
  }

  const comment = await prisma.comment.create({
  data: {
    content: text,
    denuncia_id: denunciaId,
    user_id: req.user.id,
    parent_id: parentId || null,
  },
});

  // notifica o autor da denúncia sobre o comentário...
  await notifyUnlessSelf(denuncia.authorId, req.user.id, `${req.user.name} comentou na sua denúncia "${denuncia.title}".`, denunciaId);

  // ...e, se for uma resposta, notifica também o autor do comentário-pai (evitando duplicar se for a mesma pessoa)
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (parent && parent.authorId !== denuncia.authorId) {
      await notifyUnlessSelf(parent.authorId, req.user.id, `${req.user.name} respondeu ao seu comentário em "${denuncia.title}".`, denunciaId);
    }
  }

  res.status(201).json({ comment });
}

// DELETE /api/denuncias/:id/comments/:commentId — MODERADOR ou SUPERADMIN.
// Remove em cascata (o schema já define onDelete: Cascade em Comment.parent).
async function remove(req, res) {
  const { id: denunciaId, commentId } = req.validated.params;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.denunciaId !== denunciaId) throw ApiError.notFound('Comentário não encontrado.');

  await prisma.comment.delete({ where: { id: commentId } });
  res.json({ ok: true });
}

module.exports = { create, remove };
