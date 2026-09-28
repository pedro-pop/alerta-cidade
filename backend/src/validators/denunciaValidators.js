const { z } = require('zod');

const CATEGORIES = ['BURACO', 'ILUMINACAO', 'SEMAFORO', 'LIXO', 'SEGURANCA'];
const STATUSES = ['ABERTO', 'EM_ANALISE', 'EM_ANDAMENTO', 'RESOLVIDO', 'REJEITADO'];
const coordinate = (min, max) => z.preprocess(
  value => value === '' || value === undefined ? undefined : Number(value),
  z.number().finite().min(min).max(max).optional()
);

const createDenunciaSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(90),
    description: z.string().trim().min(3).max(600),
    location: z.string().trim().min(3).max(140),
    category: z.enum(CATEGORIES, {
      errorMap: () => ({ message: `Categoria deve ser uma de: ${CATEGORIES.join(', ')}.` }),
    }),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
  }).refine(
    body => (body.latitude === undefined) === (body.longitude === undefined),
    { message: 'Latitude e longitude devem ser informadas juntas.', path: ['latitude'] }
  ),
});

const listDenunciasQuerySchema = z.object({
  query: z.object({
    category: z.enum(CATEGORIES).optional(),
    status: z.enum(STATUSES).optional(),
    search: z.string().trim().max(160).optional(),
    sort: z.enum(['recent', 'old', 'likes']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(STATUSES, { errorMap: () => ({ message: `Status deve ser um de: ${STATUSES.join(', ')}.` }) }),
  }),
});

const respondSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ text: z.string().trim().min(1).max(1000) }),
});

const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

module.exports = {
  createDenunciaSchema,
  listDenunciasQuerySchema,
  updateStatusSchema,
  respondSchema,
  idParamSchema,
  CATEGORIES,
  STATUSES,
};
