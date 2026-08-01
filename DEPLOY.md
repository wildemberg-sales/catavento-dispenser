# Deploy e instaláveis

Guia operacional para colocar o Catavento em produção: subir o backend + banco
num servidor, e gerar os instaláveis que os usuários finais recebem (o app de
gerência no Windows dos administradores, o app do operador nos tablets Android
do chão de fábrica).

> A [Seção 12 do README](./README.md#rodando-em-produção) tem a versão curta.
> Este arquivo é o passo a passo completo, incluindo o que ainda **não** está
> configurado (build do tablet) e as decisões que ficam por sua conta (TLS,
> distribuição dos instaláveis, assinatura de código).
>
> A rota gerenciada (deploy no Railway, mencionada na Fase 9 de
> [`instrucoes.md`](./instrucoes.md)) ainda não foi implementada. "Produção",
> hoje, significa rodar o Docker Compose deste repositório num servidor
> próprio (VM, servidor físico, VPS) — é o que este guia cobre.

---

## Visão geral

| O que | Onde roda | Como se distribui |
|---|---|---|
| Backend (`apps/server`) + PostgreSQL | Um servidor com Docker (VM/VPS/servidor próprio) | N/A — serviço de longa duração |
| App de Gerência (`apps/desktop`) | Windows do(s) administrador(es) | Instalador `.exe` (NSIS), distribuído manualmente |
| App do Operador (`apps/tablet`) | Tablets Android do chão de fábrica | Arquivo `.apk`, instalado manualmente (sideload) |

Os três dependem do backend estar no ar primeiro — ele é a única coisa com
estado (Postgres) e a única peça que os outros dois apps consultam por HTTPS.

---

## 1. Backend + banco de dados

### 1.1 Pré-requisitos do servidor

- Docker + Docker Compose v2 (`docker compose version`)
- Uma forma de expor a porta do backend (`3000` por padrão) publicamente —
  idealmente atrás de um proxy reverso com TLS (ver [1.4](#14-https--proxy-reverso)),
  não a porta crua exposta direto na internet
- Git (ou qualquer forma de colocar o conteúdo do repositório no servidor)

### 1.2 Primeira subida

```bash
git clone <url-do-repositório> catavento
cd catavento

cp .env.production.example .env.production
# edite .env.production com segredos de verdade — NUNCA reaproveite os
# valores de dev (.env.example). No mínimo, troque:
#   POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
# e preencha STORAGE_PUBLIC_BASE_URL com o domínio público real (ver 1.4).

pnpm compose:prod:up
# equivalente a:
#   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Migrations não rodam sozinhas no boot do container — aplique manualmente
# na primeira subida e sempre que houver migrations novas:
docker compose -f docker-compose.prod.yml run --rm server \
  npx tsx ../../packages/db/src/migrate.ts
```

Confirme que subiu:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

Isso só funciona se você tiver rodado o seed (próxima seção) — senão espere
`401`/erro de credenciais, o que já confirma que o servidor está respondendo.

`pnpm compose:prod:up` builda a imagem a partir do alvo `prod` do
`apps/server/Dockerfile` (roda via `tsx`, sem passar por um passo de
`build`/`dist` — nenhum pacote do monorepo tem hoje um pipeline de build
TypeScript real; ver comentário no Dockerfile) e sobe Postgres + backend via
`docker-compose.prod.yml`, que é **autocontido**: não depende do
`docker-compose.yml` de desenvolvimento nem do `.env` de dev estarem por
perto — pensado para copiar só ele (ou clonar o repo inteiro) pro servidor.

Diferenças desse compose em relação ao de dev:

- `postgres` **não** publica a porta 5432 pro host — só o `server` acessa,
  pela rede interna do Compose (reduz superfície de ataque).
- `server` roda sem bind mounts — o código fica congelado na imagem. Pra
  atualizar uma versão já em produção, ver [1.5](#15-atualizando-uma-versão-já-em-produção).
- Uploads (fotos de produto) ficam num volume nomeado próprio
  (`catavento_uploads_prod`), montado em `/data/uploads` dentro do container.

### 1.3 Popular o primeiro usuário admin (seed)

O seed (`pnpm db:seed`) se recusa a rodar quando `NODE_ENV=production` — que é
o caso da imagem `prod` — a menos que `SEED_ALLOW_PRODUCTION=true` seja
passado explicitamente, porque as senhas padrão (`admin123`/`operador123`) são
públicas (estão neste repositório). Pra popular o primeiro usuário admin em
produção, gere senhas fortes e passe-as só no momento do comando — nunca as
deixe persistidas em `.env.production`:

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e SEED_ALLOW_PRODUCTION=true \
  -e SEED_ADMIN_PASSWORD='<senha-forte-gerada-na-hora>' \
  -e SEED_OPERATOR_PASSWORD='<outra-senha-forte>' \
  server npx tsx ../../packages/db/src/seed/run-seed.ts
```

Depois do primeiro admin existir, prefira criar os demais usuários
(administradores e operadores) pela própria tela de gestão de usuários no app
de gerência, em vez de rodar o seed de novo.

### 1.4 HTTPS / proxy reverso

O backend em si fala HTTP puro na porta `3000` — não há TLS embutido nele.
Autenticação é via JWT (access + refresh token) mandado no corpo/header de
cada requisição; expor isso direto na internet **sem TLS** significa que
qualquer um na rede consegue capturar essas credenciais. Coloque um proxy
reverso na frente com TLS antes de apontar o desktop/tablet pra um domínio
público. [Caddy](https://caddyserver.com/) é a opção mais simples (emite e
renova certificados Let's Encrypt sozinho, sem configuração extra):

```caddyfile
# /etc/caddy/Caddyfile
api.seudominio.com {
    reverse_proxy localhost:3000
}
```

Depois de configurar o proxy:

- `STORAGE_PUBLIC_BASE_URL` em `.env.production` deve ser a URL **por trás do
  proxy**, com HTTPS: `https://api.seudominio.com/uploads`.
- `VITE_API_URL` (build do desktop) e `EXPO_PUBLIC_API_URL` (build do tablet)
  devem apontar pra `https://api.seudominio.com`, não pra
  `http://<ip>:3000`.
- `CORS_ALLOWED_ORIGINS` pode continuar vazio — nem o desktop empacotado
  (`file://`) nem o tablet (fetch do React Native) mandam header `Origin`
  (confirmado testando os builds reais), então CORS só importa se algum dia
  um navegador comum precisar bater nessa API.

Isso não é coberto por nenhum arquivo deste repositório — é infraestrutura do
seu servidor, ajuste ao que já usa (Caddy, nginx, Traefik, um load balancer
gerenciado, etc.).

### 1.5 Atualizando uma versão já em produção

```bash
git pull
pnpm compose:prod:up     # reconstrói a imagem com o código novo e reinicia o container
# se a atualização incluiu migrations novas:
docker compose -f docker-compose.prod.yml run --rm server \
  npx tsx ../../packages/db/src/migrate.ts
```

Os dados (Postgres, uploads) vivem em volumes nomeados (`catavento_pg_data_prod`,
`catavento_uploads_prod`) — não são apagados por `up`/rebuild. `pnpm compose:prod:down`
derruba os containers mas **mantém** esses volumes.

### 1.6 Backup

O Postgres roda num container comum (sem um serviço gerenciado por trás) —
backup é sua responsabilidade:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U catavento catavento_prod > backup-$(date +%Y%m%d).sql
```

Automatize isso (cron + rotação de arquivos, ou envio pra object storage) —
nada neste repositório faz isso por você.

### 1.7 Variáveis de ambiente

A lista completa (com defaults e descrição de cada uma) está na
[tabela do README](./README.md#variáveis-de-ambiente) — não duplicada aqui
pra não divergir. O arquivo `.env.production.example` já traz todas com
comentários; copie-o pra `.env.production` e preencha.

---

## 2. Instalador do App de Gerência (Electron/Windows)

```bash
# aponte pro backend de produção ANTES de buildar — fica embutido no bundle
echo "VITE_API_URL=https://api.seudominio.com" > apps/desktop/.env

pnpm --filter @catavento/desktop build:win
```

Gera `apps/desktop/release/Catavento Gerência Setup <versão>.exe` (instalador
NSIS, ~100 MB — inclui o runtime do Electron completo). **Funciona buildando
direto no macOS/Linux** — testado e confirmado neste ambiente, sem precisar
instalar Wine (versões recentes do `electron-builder` empacotam o que
precisam para gerar o NSIS sem depender de um Windows real ou de Wine).

Só o alvo Windows (NSIS, x64) está configurado em
`apps/desktop/electron-builder.yml` — não há build de macOS/Linux.

**Distribuição:** manual — copie o `.exe` pro computador de cada
administrador (rede compartilhada, pendrive, etc.) e rode o instalador. Pontos
de atenção:

- **Sem assinatura de código** (nenhum certificado configurado no
  `electron-builder.yml`) — o Windows SmartScreen vai mostrar um aviso de
  "editor desconhecido" na primeira execução. O usuário precisa clicar em
  "Mais informações" → "Executar assim mesmo". Pra remover esse aviso seria
  necessário comprar um certificado de assinatura de código (Authenticode) e
  configurar `win.certificateFile`/`win.certificatePassword` (ou
  `CSC_LINK`/`CSC_KEY_PASSWORD`) no `electron-builder.yml` — não incluído por
  padrão porque é um custo recorrente que depende de você ter uma entidade
  jurídica pra emitir o certificado.
- **Sem auto-update configurado** — atualizar uma instalação existente
  significa gerar um novo instalador e reinstalar manualmente (o NSIS já
  desinstala a versão anterior automaticamente ao rodar por cima).
- `oneClick: false` no `electron-builder.yml` deixa o instalador perguntar o
  diretório de instalação (não é um instalador silencioso/automático).

---

## 3. Instalável do App do Operador (React Native/Tablet, Android)

**Ainda não há build de produção configurado** — não existe `eas.json` nem
`android.package` em `apps/tablet/app.json`. Hoje o app só roda via Expo Go ou
emulador, em modo desenvolvimento (ver README). Esta seção documenta a
configuração única necessária e o comando de build depois de feita.

### 3.1 Configuração única (uma vez por projeto)

```bash
npm install -g eas-cli   # ou: npx eas-cli <comando>, sem instalar global
eas login                # pede uma conta Expo (gratuita) — crie uma se não tiver
cd apps/tablet
eas build:configure      # cria eas.json e vincula este projeto a um projeto Expo
```

O `eas build:configure` pergunta a plataforma (escolha Android) e cria um
`eas.json` com profiles (`development`/`preview`/`production`). Depois disso,
adicione um identificador de pacote Android único em `apps/tablet/app.json`
(obrigatório para builds Android — não existe hoje):

```jsonc
{
  "expo": {
    // ...resto do arquivo sem mudança...
    "android": {
      "package": "com.catavento.tablet",
      // ...resto de "android" sem mudança...
    }
  }
}
```

### 3.2 Apontar para o backend de produção

O app lê `EXPO_PUBLIC_API_URL` em tempo de execução (não há arquivo `.env` —
ver README). Pra não depender de quem instala o APK setar essa variável, fixe
o valor de produção diretamente no profile de build em `eas.json`:

```jsonc
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.seudominio.com"
      }
      // ...resto do profile gerado pelo eas build:configure...
    }
  }
}
```

### 3.3 Build

```bash
eas build --platform android --profile production
```

Roda na nuvem da Expo (não localmente) — ao final, o comando imprime uma URL
pra baixar o `.apk` (ou `.aab`, dependendo de como o profile foi configurado;
para instalação direta nos tablets, prefira gerar `.apk`, já que `.aab` é o
formato exigido pela Play Store, que este app não usa).

**Distribuição:** este é um app interno de chão de fábrica, não publicado na
Play Store — instale o `.apk` diretamente em cada tablet (transferindo o
arquivo e abrindo-o, ou via `adb install caminho/do/arquivo.apk` com o tablet
conectado por USB). Cada tablet precisa ter "Instalar apps de fontes
desconhecidas" habilitado para essa origem (o próprio Android pede isso na
primeira tentativa de instalação).

---

## 4. Checklist antes de considerar "em produção"

- [ ] `.env.production` preenchido com segredos **diferentes** dos de
      desenvolvimento (`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
      `JWT_REFRESH_SECRET`)
- [ ] Proxy reverso com TLS na frente do backend, domínio público apontando
      pra ele
- [ ] `STORAGE_PUBLIC_BASE_URL` preenchido com a URL HTTPS pública correta
- [ ] Migrations aplicadas (`docker compose -f docker-compose.prod.yml run
      --rm server npx tsx ../../packages/db/src/migrate.ts`)
- [ ] Primeiro usuário admin criado com senha forte (não os defaults do seed)
- [ ] Rotina de backup do Postgres configurada
- [ ] App de gerência (`apps/desktop`) buildado com `VITE_API_URL` apontando
      pro domínio de produção, instalado nas máquinas dos administradores
- [ ] App do operador (`apps/tablet`) com EAS configurado
      (`eas build:configure` + `android.package` em `app.json`),
      `EXPO_PUBLIC_API_URL` de produção fixado no profile do `eas.json`,
      `.apk` gerado e instalado nos tablets
