# Catavento

Sistema de gestão de fila de produção para a Catavento: administradores importam lotes de pedidos (CSV/XLSX), que viram itens de uma fila de produção; operadores no chão de fábrica puxam o próximo item de cada vez (sem ver a fila inteira), montam o produto e marcam início/fim. Tudo fica registrado para acompanhamento ao vivo e relatórios.

A especificação completa do domínio está em [`instrucoes.md`](./instrucoes.md).

## Visão geral das aplicações

| Aplicação | Pasta | Tecnologia | Usuário | Papel |
|---|---|---|---|---|
| **Backend** | `apps/server` | Fastify + TypeScript + PostgreSQL | — | Autenticação, motor de fila, importação, analytics, SSE |
| **App de Gerência** | `apps/desktop` | Electron + React + Vite | Administrador | Importa planilhas, gerencia fila e catálogo, monitora ao vivo, relatórios, usuários |
| **App do Operador** | `apps/tablet` | React Native + Expo (Android) | Operador | Login, puxa o próximo item, conclui/reporta problema |
| **Contratos** | `packages/contracts` | Zod | — | Schemas/tipos compartilhados entre backend e os dois apps |
| **Banco de dados** | `packages/db` | Drizzle ORM + PostgreSQL | — | Schema, migrations, seed |

Monorepo gerenciado com **pnpm workspaces** + **Turborepo**.

---

## Pré-requisitos

- **Node.js ≥ 20** (o repositório usa `packageManager: pnpm@9.15.0` — instale com `corepack enable` ou `npm i -g pnpm@9.15.0`)
- **Docker** (sobe Postgres e, opcionalmente, o backend via `docker-compose.yml`)
- Para o app de gerência (`apps/desktop`): nada além do Node — o Electron baixa o binário no `pnpm install`
- Para o app do operador (`apps/tablet`): [Expo Go](https://expo.dev/go) num Android físico, **ou** Android Studio com um emulador configurado

---

## Configuração inicial (uma vez)

```bash
pnpm install

# Variáveis de ambiente do backend (raiz do repo)
cp .env.example .env
# edite .env e troque os JWT_*_SECRET por valores próprios, especialmente fora do seu ambiente local

# Sobe Postgres + backend em Docker (veja a seção "Rodando em desenvolvimento" abaixo)
pnpm compose:up

# Aplica as migrations e popula usuários de teste
pnpm db:migrate
pnpm db:seed
```

O seed cria dois usuários para testar login imediatamente:

| Usuário | Senha | Papel |
|---|---|---|
| `admin` | `admin123` | admin (usa o app de gerência) |
| `operador1` | `operador123` | operator (usa o app do tablet) |

---

## Rodando em desenvolvimento

Cada app roda de forma independente. Rode o backend primeiro — os outros dois dependem dele.

### Backend (`apps/server`)

**Via Docker (recomendado)** — sobe Postgres e o backend juntos, com hot-reload:

```bash
pnpm compose:up          # builda a imagem (1ª vez) e sobe postgres + server
docker compose logs -f server   # acompanhar os logs / confirmar o restart automático
pnpm compose:down         # derruba tudo (mantém os volumes: dados do banco e uploads)
```

Sobe em `http://localhost:3000`. O container roda `tsx watch` e monta a pasta `src` de `apps/server`, `packages/db` e `packages/contracts` como bind mount — editar qualquer arquivo dessas pastas no host reinicia o processo dentro do container automaticamente, igual ao `pnpm dev` local. As variáveis vêm do `.env` da raiz, com `DATABASE_URL` sobrescrita internamente para apontar pro serviço `postgres` do Compose (não `localhost`).

**Sem Docker (alternativa)**:

```bash
pnpm --filter @catavento/server dev
```

Sobe em `http://localhost:3000` com hot-reload (`tsx watch`), rodando direto no host — precisa do Postgres acessível em `localhost:5432` (ex.: `docker compose up -d postgres`, sem o serviço `server`). O `.env` da raiz (veja a [tabela de variáveis](#variáveis-de-ambiente) abaixo) é carregado automaticamente pelo próprio processo — não precisa exportar nada na mão. Se alguma variável obrigatória estiver faltando, o processo falha na subida com um erro claro listando o que falta.

### App de Gerência (`apps/desktop`)

```bash
cp apps/desktop/.env.example apps/desktop/.env   # já aponta pro backend local por padrão
pnpm --filter @catavento/desktop dev
```

Abre a janela do Electron apontando pro backend local. Login com `admin` / `admin123`.

### App do Operador (`apps/tablet`)

```bash
pnpm --filter @catavento/tablet android   # abre no emulador Android
# ou
pnpm --filter @catavento/tablet start     # abre o Metro/Expo Go, escaneie o QR code
```

O app aponta por padrão para `http://10.0.2.2:3000` (endereço especial do emulador Android para `localhost` da máquina host). Se for usar um **celular físico** na mesma rede, defina `EXPO_PUBLIC_API_URL` com o IP da sua máquina antes de iniciar:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 pnpm --filter @catavento/tablet start
```

Login com `operador1` / `operador123`.

---

## Rodando em produção

### Backend (`apps/server`)

Via Docker, com `docker-compose.prod.yml` — um compose **autocontido** (não depende do `docker-compose.yml` de dev nem do `.env` de dev), pensado pra copiar pro servidor e rodar lá:

```bash
cp .env.production.example .env.production
# edite .env.production com segredos de verdade — NUNCA reaproveite os valores de dev

pnpm compose:prod:up     # builda a imagem (alvo "prod" do Dockerfile) e sobe postgres + server

# Primeira vez (ou após migrations novas): aplicar migrations manualmente
docker compose -f docker-compose.prod.yml run --rm server npx tsx ../../packages/db/src/migrate.ts

pnpm compose:prod:down   # derruba tudo (mantém os volumes: dados do banco e uploads)
```

O alvo `prod` do `Dockerfile` roda `tsx` diretamente (sem passar por `pnpm build`/`dist` — nenhum dos pacotes do monorepo tem hoje um pipeline de build TypeScript real, então rodar via `tsx` é o comportamento tanto em dev quanto em prod). Diferenças em relação ao dev:

- `postgres` não publica a porta 5432 pro host (só o `server` acessa, pela rede interna do Compose).
- `server` não usa bind mounts — o código fica congelado na imagem; pra atualizar, rode `pnpm compose:prod:up` de novo (reconstrói a imagem).
- Uploads ficam num volume nomeado próprio (`catavento_uploads_prod`), montado em `/data/uploads` dentro do container.
- Segredos (`.env.production`) vêm de um arquivo separado do `.env` de desenvolvimento.

Pontos de atenção ao preencher `.env.production`:

- `STORAGE_PUBLIC_BASE_URL` precisa ser a URL **externamente acessível** que serve `/uploads/*` (o próprio backend serve esse caminho automaticamente).
- Troque `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`POSTGRES_PASSWORD` por segredos fortes e diferentes dos de desenvolvimento.

> A rota gerenciada (deploy no Railway, Fase 9) ainda não foi implementada — hoje "produção" significa rodar esse compose você mesmo (servidor próprio, VM, etc.).

### App de Gerência (`apps/desktop`)

```bash
pnpm --filter @catavento/desktop build:win
```

Gera um instalador Windows (NSIS) em `apps/desktop/release/`. Aponte `VITE_API_URL` (em `apps/desktop/.env`, antes do build) para a URL do backend em produção. **Só o instalador Windows está configurado** — não há build de macOS/Linux.

### App do Operador (`apps/tablet`)

Ainda não há um build de produção configurado (sem `eas.json`/EAS Build) — hoje o app roda só em modo desenvolvimento via Expo, contra um backend acessível na mesma rede. Gerar um APK/instalável assinado é trabalho pendente.

---

## Testes e outros comandos

Comandos na raiz rodam a task em **todos** os apps/packages via Turborepo; use `pnpm --filter <nome>` para rodar num só (ex.: `pnpm --filter @catavento/server test`).

```bash
pnpm test              # suíte completa (unit + integration) de tudo
pnpm test:unit
pnpm test:integration  # apps/server usa Testcontainers — precisa do Docker rodando
pnpm test:coverage
pnpm typecheck
pnpm lint

pnpm db:generate        # gera uma nova migration a partir do schema do Drizzle
pnpm db:migrate
pnpm db:seed

pnpm compose:up          # sobe Postgres + backend (dev, hot-reload)
pnpm compose:down        # derruba (mantém os volumes)
pnpm compose:prod:up     # builda e sobe Postgres + backend (docker-compose.prod.yml)
pnpm compose:prod:down   # derruba (mantém os volumes)
```

Nomes dos pacotes pra usar com `--filter`: `@catavento/server`, `@catavento/desktop`, `@catavento/tablet`, `@catavento/contracts`, `@catavento/db`.

---

## Variáveis de ambiente

### Backend (`.env` na raiz do repo — veja `.env.example`)

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | — (obrigatória) | Connection string do Postgres |
| `PGPOOL_MAX` | `10` | Tamanho máximo do pool de conexões |
| `JWT_ACCESS_SECRET` | — (obrigatória) | Segredo do access token |
| `JWT_REFRESH_SECRET` | — (obrigatória) | Segredo do refresh token |
| `ACCESS_TOKEN_TTL` | `15m` | Validade do access token |
| `REFRESH_TOKEN_TTL` | `7d` | Validade do refresh token |
| `ABANDONMENT_CHECK_INTERVAL_MS` | `60000` | Intervalo do job que devolve itens abandonados à fila |
| `ABANDONMENT_TIMEOUT_MINUTES` | `15` | Tempo sem atividade até considerar um item abandonado |
| `PORT` | `3000` | Porta HTTP do backend |
| `LOG_LEVEL` | `info` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |
| `STORAGE_DRIVER` | `local` | `local` (disco) ou `memory` (só em testes) |
| `STORAGE_LOCAL_DIR` | `./.data/uploads` | Onde as imagens de produto são gravadas quando `STORAGE_DRIVER=local` |
| `STORAGE_PUBLIC_BASE_URL` | `http://localhost:3000/uploads` | Base da URL pública das imagens |
| `MAX_IMAGE_SIZE_BYTES` | `5242880` (5MB) | Tamanho máximo por imagem de produto |
| `MAX_IMAGES_PER_PRODUCT` | `8` | Limite de fotos por produto |
| `ANALYTICS_MAX_RANGE_DAYS` | `90` | Período máximo permitido nas consultas de relatório |

### App de Gerência (`apps/desktop/.env` — veja `apps/desktop/.env.example`)

| Variável | Default | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | URL do backend consumida pelo app |

### App do Operador (env var na hora de rodar, não tem arquivo `.env`)

| Variável | Default | Descrição |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:3000` | URL do backend; troque pelo IP da máquina host ao usar um aparelho físico |

---

## Status do projeto

Implementação seguindo TDD fase a fase (veja `instrucoes.md` para o roteiro completo):

- ✅ Fases 1–6 — backend completo (auth, motor de fila, importação, catálogo, analytics/SSE)
- ✅ Fase 7 — app do operador (`apps/tablet`)
- ✅ Fase 8 — app de gerência (`apps/desktop`), em três blocos: importação/fila, catálogo/reconciliação, monitor ao vivo/relatórios/usuários
- ⏳ Fase 9 — deploy gerenciado (Railway) — pendente
