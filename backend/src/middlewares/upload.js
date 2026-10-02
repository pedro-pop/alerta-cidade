// Configuração do multer (upload de arquivos) para dois casos de uso:
//   - avatarUpload: foto de perfil (apenas imagem, arquivo pequeno)
//   - denunciaMediaUpload: mídia da denúncia (imagem OU vídeo, arquivo maior)
//
// Os arquivos vão para disco em /uploads/<pasta>, com nome aleatório (uuid)
// para não colidir e não vazar o nome original do arquivo do usuário. A API
// serve essa pasta estaticamente em /uploads (ver src/app.js).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subfolder) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  ensureDir(dir);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

function imageOnlyFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(ApiError.badRequest('Apenas arquivos de imagem são aceitos aqui.'));
  }
  cb(null, true);
}

function imageOrVideoFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
    return cb(ApiError.badRequest('Apenas arquivos de imagem ou vídeo são aceitos.'));
  }
  cb(null, true);
}

const avatarUpload = multer({
  storage: makeStorage('avatars'),
  fileFilter: imageOnlyFilter,
  limits: { fileSize: env.maxImageSizeMb * 1024 * 1024 },
});

const denunciaMediaUpload = multer({
  storage: makeStorage('denuncias'),
  fileFilter: imageOrVideoFilter,
  // o limite aqui é o maior dos dois (vídeo); a checagem fina por tipo
  // (imagem não pode usar o limite de vídeo) acontece no controller,
  // que já tem acesso ao mimetype e ao tamanho reais do arquivo salvo.
  limits: { fileSize: env.maxVideoSizeMb * 1024 * 1024 },
});

function publicUrlFor(file) {
  // caminho relativo à raiz de /uploads — ex.: /uploads/denuncias/<uuid>.webm
  const relative = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
  return `/uploads/${relative}`;
}

module.exports = { avatarUpload, denunciaMediaUpload, publicUrlFor, UPLOAD_ROOT };
