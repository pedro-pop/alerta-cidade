// Centraliza a criação de notificações. Mantido separado dos controllers
// porque várias ações diferentes (mudar status, validar, responder,
// comentar...) disparam notificação, e a regra de "não notificar a si
// mesmo" precisa ser consistente em todas elas.

const prisma = require('../config/prisma');

async function notify(userId, message, denunciaId) {
  if (!userId) return;
  await prisma.notification.create({
    data: {
      user_id: userId,
      message,
      denuncia_id: denunciaId || null,
    },
  });
}

/** Notifica, exceto se o autor da ação for o próprio destinatário. */
async function notifyUnlessSelf(userId, actorId, message, denunciaId) {
  if (!userId || userId === actorId) return;
  await notify(userId, message, denunciaId);
}

module.exports = { notify, notifyUnlessSelf };
