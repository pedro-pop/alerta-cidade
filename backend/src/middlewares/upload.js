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
const { getSupabaseAdmin } = require('../config/supabaseAdmin');

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
);
const STORAGE_BUCKET = 'media';

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

async function uploadFileToStorage(file, folder, extension, contentType) {
  const safeExtension = String(extension || '')
    .replace(/^\./, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  if (!safeExtension || !contentType) {
    throw ApiError.badRequest('Não foi possível identificar o formato do arquivo.');
  }

  const objectPath = `${folder}/${crypto.randomUUID()}.${safeExtension}`;
  const storage = getSupabaseAdmin().storage.from(STORAGE_BUCKET);
  const buffer = await fs.promises.readFile(file.path);

  let uploadResult;
  try {
    uploadResult = await storage.upload(objectPath, buffer, {
      contentType,
      upsert: false,
    });
  } catch {
    await storage.remove([objectPath]).catch(() => {});
    throw new ApiError(502, 'Não foi possível enviar o arquivo ao Supabase Storage.');
  }

  if (uploadResult.error) {
    await storage.remove([objectPath]).catch(() => {});
    throw new ApiError(502, 'Não foi possível enviar o arquivo ao Supabase Storage.');
  }

  let publicUrl;
  try {
    publicUrl = storage.getPublicUrl(objectPath).data?.publicUrl;
  } catch {
    await storage.remove([objectPath]).catch(() => {});
    throw new ApiError(502, 'Não foi possível gerar a URL pública do arquivo.');
  }
  if (!publicUrl) {
    await storage.remove([objectPath]).catch(() => {});
    throw new ApiError(502, 'Não foi possível gerar a URL pública do arquivo.');
  }

  return { objectPath, publicUrl };
}

async function removeStorageObject(objectPath) {
  if (!objectPath) return;
  const { error } = await getSupabaseAdmin()
    .storage
    .from(STORAGE_BUCKET)
    .remove([objectPath]);
  if (error) throw new ApiError(502, 'Não foi possível remover o arquivo do Supabase Storage.');
}

module.exports = {
  avatarUpload,
  denunciaMediaUpload,
  publicUrlFor,
  uploadFileToStorage,
  removeStorageObject,
  UPLOAD_ROOT,
};
