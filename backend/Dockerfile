# Imagem de produção da API do AlertaCidade.
FROM node:20-alpine

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

# sincroniza o schema disponível e só então sobe o servidor
CMD ["sh", "-c", "npx prisma db push && node server.js"]
