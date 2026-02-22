# Lastreia

Lastreia e uma infraestrutura de aquisicao para SaaS B2B.

Ideia central:
- nao otimizar outreach de forma isolada
- compartilhar sinais de mercado anonimizados entre SaaS similares
- executar com melhor momento, canal e priorizacao

## Posicionamento

De:
- ferramenta de outbound focada em "gerar leads"

Para:
- `Aquisicao como Infraestrutura`
- `Sinais, nao leads`

Lastreia combina:
- Leads (base operacional)
- Camada de Sinais (inteligencia compartilhada)

## Superficie do produto

Nomenclatura atual do frontend:
- `Leads` -> `Leads + Sinais`
- `Campaigns` -> `Sequencias`
- `Analytics` -> `Inteligencia`
- `Scraping` -> `Descoberta de Leads`

## Estrutura do repositorio

```
SDR/
|- backend/        Node.js + Fastify + Prisma
|- frontend/       Next.js + Tailwind + shadcn/ui
|- services/       Python services (scraping, enrichment, AI)
`- docker-compose.yml
```

## Mapa de branchs

Use estas branchs:
- `main`: estado mais recente com o novo posicionamento
- `baseline/pre-positioning-fullstack`: baseline fullstack antes do reposicionamento
- `baseline/pre-positioning-frontend-only`: baseline apenas frontend antes do reposicionamento
- `feature/new-positioning-v1`: mesmo conteudo da `main`, mantida como referencia de feature branch

As branchs snapshot antigas foram removidas do remoto.

## Desenvolvimento local

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

### Docker (stack completa)

```bash
docker-compose up -d
```

## Deploy tudo de uma vez (DigitalOcean Droplet)

Este repositorio inclui uma stack de producao unica com:
- `backend`
- `services/scraping`
- `services/enrichment`
- `services/ai`
- `postgres`
- `redis`
- `evolution`

Arquivos usados:
- `docker-compose.prod.yml`
- `backend/Dockerfile.prod`
- `scripts/deploy_droplet.sh`

Passo a passo no Droplet (Ubuntu):

```bash
# 1) instalar docker + compose plugin + git (uma vez)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git

# 2) rodar deploy (clona/atualiza e sobe tudo)
curl -fsSL https://raw.githubusercontent.com/leonardo-lacerda/LeadFlow/main/scripts/deploy_droplet.sh -o deploy_droplet.sh
chmod +x deploy_droplet.sh
APP_DIR=/opt/lastreia BRANCH=main ./deploy_droplet.sh
```

No primeiro deploy, o script cria `/opt/lastreia/.env` automaticamente e encerra.
Depois disso:
1. edite o arquivo `.env` com segredos reais
2. rode o mesmo comando novamente para subir a stack

Variaveis criticas para producao:
- `FRONTEND_URL` (sua URL da Vercel)
- `API_BASE_URL` (URL publica da API, ex: `https://api.seudominio.com`)
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SECRETS_ENCRYPTION_KEY`
- `EVOLUTION_API_KEY`
- `SCRAPING_WEBHOOK_SECRET`
- `ENRICHMENT_WEBHOOK_SECRET`
- `AI_WEBHOOK_SECRET`
- `WHATSAPP_WEBHOOK_SECRET`
- `EMAIL_WEBHOOK_SECRET`
- `EMAIL_TRACKING_SIGNING_SECRET`

## Validacao

Checks de frontend usados neste repositorio:

```bash
cd frontend
npm run lint
npm run build
npm run test:e2e
```

## OAuth social (Growth Loop)

Para publicar com OAuth real em `/growth`, configure no backend:

```bash
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URI=http://localhost:4000/api/integrations/twitter/oauth/callback
TWITTER_OAUTH_SCOPES=tweet.read tweet.write users.read offline.access

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:4000/api/integrations/linkedin/oauth/callback
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social
```

Tambem sao usados:
- `OAUTH_STATE_TTL_SECONDS`
- `OAUTH_STATE_PREFIX`

## Observabilidade operacional

- API: `GET /api/ops/summary`, `GET /api/ops/workers`, `GET /api/ops/errors`, `GET /api/ops/alerts`
- UI: `frontend/app/settings/observability/page.tsx`


