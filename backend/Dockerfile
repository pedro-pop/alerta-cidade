# Imagem de produção da API do AlertaCidade.
FROM node:22-alpine

RUN apk add --no-cache openssl ffmpeg

WORKDIR /app

# instala dependências primeiro (aproveita o cache de camadas do Docker
# quando só o código muda, sem mexer em package.json)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads/avatars uploads/denuncias

EXPOSE 3333

CMD ["node", "server.js"]
