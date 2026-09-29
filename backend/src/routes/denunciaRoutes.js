const { Router } = require('express');
const denunciaController = require('../controllers/denunciaController');
const commentRoutes = require('./commentRoutes');
const validate = require('../middlewares/validate');
const { authenticate, authorize, optionalAuthenticate } = require('../middlewares/auth');
const { denunciaMediaUpload } = require('../middlewares/upload');
const {
  createDenunciaSchema,
  listDenunciasQuerySchema,
  updateStatusSchema,
  respondSchema,
  idParamSchema,
} = require('../validators/denunciaValidators');

const router = Router();

// rotas públicas (mas "cientes" de quem está logado, para marcar likedByMe)
router.get('/', optionalAuthenticate, validate(listDenunciasQuerySchema), denunciaController.list);
router.get('/:id', optionalAuthenticate, validate(idParamSchema), denunciaController.getById);

// CIDADAO e SUPERADMIN podem criar denúncias — mesma regra do front-end
router.post(
  '/',
  authenticate,
  authorize('cidadao', 'SUPERADMIN'),
  denunciaMediaUpload.single('media'),
  validate(createDenunciaSchema),
  denunciaController.create
);

router.post('/:id/like', authenticate, validate(idParamSchema), denunciaController.toggleLike);
router.post('/:id/confirm-resolved', authenticate, validate(idParamSchema), denunciaController.confirmResolved);

router.post('/:id/validate', authenticate, authorize('MODERADOR', 'SUPERADMIN'), validate(idParamSchema), denunciaController.moderateValidate);
router.post('/:id/remove', authenticate, authorize('MODERADOR', 'SUPERADMIN'), validate(idParamSchema), denunciaController.moderateRemove);

router.patch('/:id/status', authenticate, authorize('ADMIN', 'SUPERADMIN'), validate(updateStatusSchema), denunciaController.setStatus);
router.post('/:id/respond', authenticate, authorize('ADMIN', 'SUPERADMIN'), validate(respondSchema), denunciaController.respond);

router.use('/:id/comments', commentRoutes);

module.exports = router;
