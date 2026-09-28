# AlertaCidade — Backend (API)

API REST para o sistema de denúncias urbanas colaborativas. Node.js +
Express, banco **PostgreSQL** via **Prisma ORM**, autenticação por **JWT**,
upload de mídia (foto/vídeo) com **multer**.

> Este backend é o começo da API "de verdade" para o projeto. O front-end
> (pasta `../frontend`) hoje ainda funciona sozinho, com LocalStorage
> simulando o backend — a integração entre os dois é o próximo passo (ver
> "Estado atual" no README da raiz do projeto).

## Por que não SQLite

O projeto pede explicitamente para não usar SQLite. Optamos por **PostgreSQL**
por ser o banco relacional mais usado em produção para esse tipo de
aplicação (multiusuário, com escrita concorrente, tipos de dado ricos como
enums nativos, e bom suporte a `JSON`/full-text caso o projeto cresça nessa
direção). O Prisma torna trivial trocar de banco depois, se necessário —
bastaria mudar `provider` em `prisma/schema.prisma`.

## Estrutura de pastas

```
backend/
├── prisma/
│   ├── schema.prisma      # modelo de dados (fonte da verdade do banco)
│   └── seed.js             # popula o banco com contas e denúncias de teste
├── src/
│   ├── config/             # variáveis de ambiente e client do Prisma
│   ├── controllers/         # lógica de cada rota (uma função por endpoint)
│   ├── middlewares/          # auth (JWT), validação (zod), upload (multer), erros
│   ├── routes/                # define os endpoints e liga rota → middleware → controller
│   ├── services/                # regras reaproveitadas por vários controllers (ex.: notificações)
│   ├── utils/                    # ApiError, sanitizeUser, checagem de duração de vídeo
│   └── app.js                     # monta o Express app (sem dar listen)
├── uploads/                        # arquivos de mídia enviados (fotos, vídeos, avatares)
├── server.js                       # ponto de entrada (dá listen e trata shutdown)
├── Dockerfile
├── .env.example
└── package.json
```

## Como rodar localmente

### 1. Com Docker (recomendado — sobe Postgres junto)

Na raiz do projeto (um nível acima desta pasta):

```bash
docker compose up --build
```

Isso sobe o Postgres, sincroniza o schema Prisma sem aceitar perda de dados
automaticamente e inicia a API em `http://localhost:3333`. Para popular com dados de teste:

```bash
docker compose exec backend npm run seed
```

### 2. Sem Docker (Postgres já instalado na máquina)

```bash
cd backend
cp .env.example .env        # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run prisma:generate      # gera o client do Prisma a partir do schema
npm run prisma:migrate        # cria as tabelas no banco (pede um nome para a migração)
npm run seed                   # opcional: popula com contas de teste
npm run dev                     # sobe com nodemon (reinicia sozinho a cada mudança)
```

A API sobe em `http://localhost:3333` (ou na porta definida em `PORT`).

## Autenticação

Login e cadastro devolvem um `token` JWT. Rotas protegidas esperam:

```
Authorization: Bearer <token>
```

O token carrega o `id` e o `role` do usuário; o middleware `authenticate`
recarrega o usuário do banco a cada request (garante que uma conta
desativada/alterada não continue "logada" indefinidamente).

## Referência da API

Base: `/api`

| Método | Rota | Quem pode | Descrição |
|---|---|---|---|
| POST | `/auth/register` | público | Cria conta — **sempre** como CIDADAO |
| POST | `/auth/login` | público | Login, devolve `{ token, user }` |
| GET  | `/auth/me` | autenticado | Perfil do usuário logado |
| GET  | `/users` | SUPERADMIN | Lista usuários — `?role=` e `?search=` |
| POST | `/users` | SUPERADMIN | Cria ADMIN, MODERADOR ou SUPERADMIN |
| PATCH | `/users/:id/password` | SUPERADMIN | Redefine a senha de um usuário |
| PATCH | `/users/me/photo` | autenticado | Troca a própria foto (multipart, campo `photo`) |
| GET  | `/denuncias` | público* | Lista — `?category=&status=&search=&sort=&page=&pageSize=` |
| GET  | `/denuncias/:id` | público* | Detalhe + comentários |
| POST | `/denuncias` | CIDADAO, SUPERADMIN | Cria (multipart, campo de arquivo opcional `media`) |
| POST | `/denuncias/:id/like` | autenticado | Alterna curtir/descurtir |
| POST | `/denuncias/:id/confirm-resolved` | autor da denúncia | Confirma resolução (status precisa já ser RESOLVIDO) |
| POST | `/denuncias/:id/validate` | MODERADOR, SUPERADMIN | Marca como validada |
| POST | `/denuncias/:id/remove` | MODERADOR, SUPERADMIN | Remove (soft delete) |
| PATCH | `/denuncias/:id/status` | ADMIN, SUPERADMIN | Atualiza o status |
| POST | `/denuncias/:id/respond` | ADMIN, SUPERADMIN | Cria/atualiza a resposta oficial |
| POST | `/denuncias/:id/comments` | autenticado | Comenta; `parentId` no body torna uma resposta |
| DELETE | `/denuncias/:id/comments/:commentId` | MODERADOR, SUPERADMIN | Remove (cascata nas respostas) |
| GET | `/notifications` | autenticado | Notificações do usuário logado |
| PATCH | `/notifications/read-all` | autenticado | Marca todas como lidas |
| PATCH | `/notifications/:id/read` | autenticado | Marca uma como lida |

\* rotas de denúncias são públicas, mas se um token válido for enviado, a
resposta inclui `likedByMe` calculado para aquele usuário.

Erros seguem o formato `{ "error": "mensagem", "details"?: ... }` com o
status HTTP correspondente (400, 401, 403, 404, 409...).

## Upload de mídia (foto e vídeo, limite de 3 minutos)

`POST /denuncias` aceita `multipart/form-data` com os campos de texto
(`title`, `description`, `category`, `location`) mais um arquivo opcional no
campo `media` — imagem OU vídeo, nunca os dois na mesma denúncia (mesma
regra do front-end).

Validações aplicadas, nessa ordem:
1. `fileFilter` do multer filtra tipos declarados como imagem ou vídeo; o backend também verifica a assinatura real do arquivo.
2. Limite de tamanho: `MAX_IMAGE_SIZE_MB` para foto, `MAX_VIDEO_SIZE_MB` para vídeo (variáveis de ambiente).
3. Para vídeo, a **duração** é checada com `ffprobe` (ver limitação abaixo) contra `MAX_VIDEO_DURATION_SECONDS` (180s = 3 minutos).

Se qualquer validação falhar, o arquivo já salvo em disco é apagado antes de
responder o erro — não fica lixo em `uploads/`.

## Limitações conhecidas / próximos passos

- **Validação de duração usa `ffprobe`**, incluído na imagem Docker via
  `ffmpeg`. Se a duração não puder ser verificada, a API rejeita o vídeo em
  vez de confiar apenas na validação do navegador.
- **Armazenamento de mídia é local (disco)**. Funciona bem para um único
  servidor; para múltiplas instâncias/escala horizontal, o próximo passo
  natural é trocar `src/middlewares/upload.js` por um adapter para um object
  storage (S3, R2, GCS etc.) — a função `publicUrlFor` é o único lugar que
  precisaria mudar.
- **Rate limiting e refresh token** ainda não implementados — o token JWT
  atual expira (`JWT_EXPIRES_IN`) e exige novo login; não há um endpoint de
  refresh nem proteção explícita contra força bruta no login. Recomendado
  antes de ir para produção.
- **Testes automatizados**: a estrutura (`app.js` sem `.listen()`) já foi
  pensada para permitir testes de integração com `supertest` futuramente,
  mas nenhum teste foi escrito ainda.
- **Migrações para produção**: o container sincroniza o schema sem aceitar
  perda de dados automaticamente. Para deploys com histórico e revisão de
  mudanças, crie migrações Prisma e use `prisma migrate deploy`.
