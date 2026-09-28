// Middleware genérico de validação com Zod. Cada rota que precisa validar
// entrada passa um schema (ver src/validators/*.js) descrevendo body/params/
// query esperados; se não bater, a requisição nem chega no controller.

const fs = require('fs');
const ApiError = require('../utils/ApiError');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
      throw ApiError.badRequest('Dados inválidos.', result.error.flatten());
    }
    // dados já convertidos/coeridos pelo Zod (ex.: strings de query viram number)
    req.validated = result.data;
    next();
  };
}

module.exports = validate;
