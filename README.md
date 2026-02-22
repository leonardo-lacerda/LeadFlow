# Leadflow

Leadflow e uma infraestrutura de aquisicao para SaaS B2B.

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

Leadflow combina:
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


