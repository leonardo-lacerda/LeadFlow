# Leadflow

Leadflow is an acquisition infrastructure for B2B SaaS.

Core idea:
- do not optimize outreach in isolation
- share anonymized market signals across similar SaaS
- execute with better timing, channel and prioritization

## Positioning

From:
- outbound tool focused on "getting leads"

To:
- `Acquisition as Infrastructure`
- `Signals, not leads`

Leadflow combines:
- Prospects (operational base)
- Signal Layer (shared intelligence)

## Product surface

Current frontend language:
- `Leads` -> `Prospects + Signals`
- `Campaigns` -> `Sequences`
- `Analytics` -> `Intelligence`
- `Scraping` -> `Lead Discovery`

## Repository layout

```
SDR/
|- backend/        Node.js + Fastify + Prisma
|- frontend/       Next.js + Tailwind + shadcn/ui
|- services/       Python services (scraping, enrichment, AI)
`- docker-compose.yml
```

## Clear branch map

Use these branches:
- `main`: latest state with new positioning
- `baseline/pre-positioning-fullstack`: fullstack baseline before repositioning
- `baseline/pre-positioning-frontend-only`: frontend-only baseline before repositioning
- `feature/new-positioning-v1`: same content as `main`, kept as feature branch reference

Deprecated snapshot branches were removed from remote.

## Local development

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
npm install
npm run dev
```

### Docker (full stack)

```bash
docker-compose up -d
```

## Validation

Frontend checks used in this repo:

```bash
cd frontend
npm run lint
npm run build
```
