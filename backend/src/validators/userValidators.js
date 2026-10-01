const { z } = require('zod');

const ADMIN_CREATABLE_ROLES = ['ADMIN', 'MODERADOR', 'SUPERADMIN'];
const USER_ROLES = ['CIDADAO', 'MODERADOR', 'ADMIN', 'SUPERADMIN'];
const ROLE_VALUES = [...USER_ROLES, ...USER_ROLES.map(role => role.toLowerCase())];
const userRoleSchema = z.enum(ROLE_VALUES).transform(role => role.toLowerCase());

const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    password: z.string().min(4).max(72),
    role: z.enum(ADMIN_CREATABLE_ROLES, {
      errorMap: () => ({ message: `Função deve ser uma de: ${ADMIN_CREATABLE_ROLES.join(', ')}.` }),
    }).transform(role => role.toLowerCase()),
  }),
});

const updateUserRoleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ role: userRoleSchema }),
});

const resetPasswordSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ password: z.string().min(4).max(72) }),
});

const listUsersQuerySchema = z.object({
  query: z.object({
    role: userRoleSchema.optional(),
    search: z.string().trim().max(160).optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

module.exports = { createUserSchema, resetPasswordSchema, updateUserRoleSchema, listUsersQuerySchema, idParamSchema, ADMIN_CREATABLE_ROLES };
