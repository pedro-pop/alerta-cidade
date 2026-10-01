const { Router } = require('express');
const userController = require('../controllers/userController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { avatarUpload } = require('../middlewares/upload');
const { createUserSchema, resetPasswordSchema, updateUserRoleSchema, listUsersQuerySchema } = require('../validators/userValidators');

const router = Router();

// qualquer usuário autenticado pode trocar a própria foto
router.patch('/me/photo', authenticate, avatarUpload.single('photo'), userController.updateMyPhoto);

// o restante do painel de usuários é exclusivo do SUPERADMIN
router.get('/', authenticate, authorize('superadmin'), validate(listUsersQuerySchema), userController.listUsers);
router.post('/', authenticate, authorize('superadmin'), validate(createUserSchema), userController.createUser);
router.patch('/:id/role', authenticate, authorize('superadmin'), validate(updateUserRoleSchema), userController.updateUserRole);
router.patch('/:id/password', authenticate, authorize('superadmin'), validate(resetPasswordSchema), userController.resetPassword);

module.exports = router;
