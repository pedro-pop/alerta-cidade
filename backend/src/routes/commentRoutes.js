const { Router } = require('express');
const commentController = require('../controllers/commentController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { createCommentSchema, commentIdParamSchema } = require('../validators/commentValidators');

// mergeParams: true porque este router é montado em /api/denuncias/:id/comments
// e precisa enxergar o :id capturado pelo router pai
const router = Router({ mergeParams: true });

router.post('/', authenticate, validate(createCommentSchema), commentController.create);
router.delete('/:commentId', authenticate, authorize('moderador', 'superadmin'), validate(commentIdParamSchema), commentController.remove);

module.exports = router;
