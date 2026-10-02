const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Informe o nome completo.').max(120),
    email: z.string().trim().email('E-mail inválido.').max(160),
    password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(72),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('E-mail inválido.'),
    password: z.string().min(1, 'Informe a senha.'),
  }),
});

module.exports = { registerSchema, loginSchema };
