const prisma = require('../config/prisma');

// GET /api/notifications
async function listMine(req, res) {
  const notifications = await prisma.notification.findMany({
    where: {
      user_id: req.user.id,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      user_id: req.user.id,
      read: false,
    },
  });

  res.json({
    notifications,
    unreadCount,
  });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  await prisma.notification.updateMany({
    where: {
      user_id: req.user.id,
      read: false,
    },
    data: {
      read: true,
    },
  });

  res.json({ ok: true });
}

// PATCH /api/notifications/:id/read
async function markOneRead(req, res) {
  const { id } = req.params;

  await prisma.notification.updateMany({
    where: {
      id,
      user_id: req.user.id,
    },
    data: {
      read: true,
    },
  });

  res.json({ ok: true });
}

module.exports = {
  listMine,
  markAllRead,
  markOneRead,
};