# Leadflow - Plano de Desenvolvimento em Fases

> **Visao:** Leadflow = Prospeccao + Aprendizado + Distribuicao
>
> De "ferramenta de outbound" para "infra de aquisicao que se distribui sozinha."

---

## Contexto do Sistema Existente

### Stack Tecnico

| Componente | Tecnologia | Detalhes |
|-----------|-----------|---------|
| **Backend** | Node.js + Fastify | TypeScript, ESM modules (.js imports) |
| **ORM** | Prisma | PostgreSQL, migrations em `backend/prisma/` |
| **Filas** | BullMQ + Redis | Workers em `backend/src/jobs/` e `backend/src/modules/*/` |
| **Auth** | JWT via `@fastify/jwt` | Decorator `fastify.authenticate` |
| **Frontend** | Next.js 14 (App Router) | TypeScript, `"use client"` nos componentes interativos |
| **State** | Zustand (`store/auth-store.ts`) | Global auth state |
| **Data Fetching** | TanStack React Query | `useQuery` / `useMutation` em todas as paginas |
| **UI** | shadcn/ui + Radix + Tailwind | Componentes em `frontend/components/ui/` |
| **Icones** | `@tabler/icons-react` | Padrão do projeto |
| **HTTP Client** | Axios | Instancia em `frontend/lib/api.ts` com interceptor JWT |
| **Deploy** | Docker Compose | `docker-compose.yml` na raiz |

### Estrutura do Backend

```
backend/
├── prisma/
│   └── schema.prisma        # Schema completo (718 linhas, ~20 models)
├── src/
│   ├── index.ts              # Entrypoint: registra plugins, rotas, workers
│   ├── config/
│   │   └── env.ts            # Variaveis de ambiente tipadas
│   ├── lib/
│   │   ├── prisma.ts         # Instancia do Prisma Client
│   │   └── redis.ts          # Instancia do Redis/IORedis
│   ├── middlewares/
│   │   └── auth.ts           # Middleware JWT (extrai organizationId)
│   ├── jobs/
│   │   ├── scraping.worker.ts
│   │   ├── enrichment.worker.ts
│   │   ├── email.worker.ts
│   │   ├── whatsapp.worker.ts
│   │   ├── ai.worker.ts
│   │   ├── campaign.worker.ts
│   │   └── email.imap.ts       # Polling IMAP pra replies
│   └── modules/
│       ├── auth/                # Login, registro, JWT
│       ├── leads/               # CRUD de leads
│       ├── scraping/            # Criar/executar jobs de scraping
│       ├── enrichment/          # Enriquecimento de dados (CNPJ, email, etc)
│       ├── campaigns/           # CRUD + execucao de sequencias
│       ├── inbox/               # Conversas, envio de mensagens
│       ├── email/               # Configuracao SMTP/IMAP
│       ├── whatsapp/            # Integracao Evolution API
│       ├── analytics/           # Dashboard stats, metricas
│       ├── organization/        # Config da org, convites, planos
│       ├── notifications/       # Notificacoes in-app
│       ├── scoring/             # Score de leads + worker
│       ├── signals/             # Signal events + recomendacoes
│       └── ai/                  # Jobs de IA (scoring, geracao)
```

### Rotas da API (prefixo `/api`)

| Prefixo | Modulo | Principais endpoints |
|---------|--------|---------------------|
| `/api/auth` | auth | `POST /register`, `POST /login`, `POST /forgot-password` |
| `/api/leads` | leads | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `/api/scraping` | scraping | `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `POST /jobs/:id/rerun` |
| `/api/enrichment` | enrichment | `POST /bulk`, `POST /jobs`, `GET /jobs` |
| `/api/campaigns` | campaigns | `GET /`, `POST /`, `GET /:id`, `POST /:id/leads`, `PATCH /:id/status`, `POST /:id/launch` |
| `/api/inbox` | inbox | `GET /conversations`, `GET /thread/:leadId`, `POST /send/:leadId` |
| `/api/email` | email | Configuracao de mailboxes SMTP/IMAP |
| `/api/whatsapp` | whatsapp | Configuracao de instancias Evolution API |
| `/api/analytics` | analytics | `GET /dashboard`, `GET /recent`, `GET /campaigns` |
| `/api/organization` | organization | `GET /`, `PATCH /`, `POST /invites`, `PATCH /icp` |
| `/api/notifications` | notifications | `GET /`, `PATCH /:id/read` |
| `/api/scoring` | scoring | `POST /run`, `GET /status` |
| `/api/signals` | signals | `GET /events`, `GET /lead-recommendations`, `GET /heatmap` |

### Workers (BullMQ)

| Worker | Arquivo | O que faz |
|--------|---------|-----------|
| Scraping | `jobs/scraping.worker.ts` | Executa scraping Google Maps/CNPJ, cria leads |
| Enrichment | `jobs/enrichment.worker.ts` | Enriquece leads (website, CNPJ, email) |
| Email | `jobs/email.worker.ts` | Envia emails via SMTP |
| WhatsApp | `jobs/whatsapp.worker.ts` | Envia mensagens via Evolution API |
| AI | `jobs/ai.worker.ts` | Executa jobs de IA (scoring, geracao) |
| Campaign | `jobs/campaign.worker.ts` | Orquestra steps de campanha |
| IMAP | `jobs/email.imap.ts` | Polling de respostas por email |
| Scoring | `modules/scoring/scoring.worker.ts` | Recalcula scores periodicamente |
| Follow-up | `modules/inbox/followup.worker.ts` | Follow-ups automaticos |
| Analytics | `modules/analytics/analytics.worker.ts` | Agrega metricas periodicas |

> **Importante:** Workers so iniciam se `env.RUN_WORKERS === true`. IMAP so se `env.RUN_IMAP_POLLING === true`.

### Estrutura do Frontend

```
frontend/
├── app/
│   ├── layout.tsx             # Root layout com providers
│   ├── page.tsx               # Landing page (raiz)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── dashboard/page.tsx     # Dashboard principal
│   ├── leads/
│   │   ├── page.tsx           # Lista com bulk select + acoes
│   │   ├── [id]/page.tsx      # Detalhe do lead + timeline + notas + mensagens
│   │   └── import/page.tsx    # Importacao de CSV
│   ├── campaigns/
│   │   ├── page.tsx           # Lista de sequencias
│   │   ├── new/page.tsx       # Criar sequencia (aceita ?leadIds=)
│   │   └── [id]/page.tsx      # Detalhe da campanha
│   ├── scraping/
│   │   ├── page.tsx           # Lista de jobs
│   │   └── [id]/page.tsx      # Detalhe + wizard pos-captura
│   ├── inbox/page.tsx         # Conversas + envio
│   ├── analytics/page.tsx     # Dashboard de analytics
│   ├── settings/
│   │   └── layout.tsx         # Settings com sub-paginas
│   └── onboarding/page.tsx    # Setup inicial
├── components/
│   ├── layout/
│   │   └── app-layout.tsx     # Layout com sidebar
│   ├── ui/                    # shadcn/ui components
│   └── leads/
│       └── enrichment-card.tsx
├── lib/
│   ├── api.ts                 # Axios instance (baseURL: localhost:4000/api)
│   ├── leads-api.ts           # leadsApi.list(), .create(), .getById(), etc
│   ├── campaigns-api.ts       # campaignsApi.create(), .list(), .addLeads(), etc
│   ├── inbox-api.ts           # inboxApi.listConversations(), .sendMessage(), etc
│   ├── scraping-api.ts        # scrapingApi.createJob(), .getJob(), .listJobLeads()
│   ├── signals-api.ts         # signalsApi.getLeadRecommendations(), .getHeatmap()
│   ├── analytics-api.ts       # analyticsApi.getDashboard(), .getRecent()
│   ├── scoring-api.ts
│   ├── notes-api.ts
│   ├── organization-api.ts
│   ├── notifications-api.ts
│   ├── integrations-api.ts
│   ├── ai-api.ts
│   └── utils.ts               # formatDate(), downloadCsv()
├── store/
│   └── auth-store.ts          # Zustand store (token, user, org)
└── hooks/
    └── use-toast.ts           # Toast notifications
```

### Schema Prisma — Models Existentes

| Model | Linhas | Descricao |
|-------|--------|-----------|
| `Organization` | 15-61 | Multi-tenant, planos, limites, uso, ICP definition |
| `User` | 87-106 | Usuarios com roles (OWNER, ADMIN, MEMBER) |
| `Lead` | 116-200 | Lead completo: dados, empresa, localizacao, score, temperatura, tags, source |
| `LeadNote` | 202-214 | Notas de texto por lead |
| `Campaign` | 245-269 | Sequencias multi-canal (EMAIL, WHATSAPP, MULTI_CHANNEL) |
| `CampaignStep` | 284-306 | Steps da campanha (email/whatsapp/wait/condition) |
| `CampaignLead` | 315-344 | Relacao lead-campanha com status e step atual |
| `Message` | 348-387 | Mensagens enviadas/recebidas (email ou whatsapp) |
| `SignalEvent` | 433-455 | Eventos de sinal (envio, reply, bounce) com dedup |
| `Template` | 459-477 | Templates de mensagem com variaveis |
| `ScrapingJob` | 481-514 | Jobs de scraping com query, status, progresso |
| `EnrichmentJob` | 516-544 | Jobs de enriquecimento |
| `AiJob` | 580-608 | Jobs de IA (scoring, geracao, analise) |
| `Mailbox` | 626-661 | Caixas de email SMTP/IMAP com warmup |
| `WhatsappInstance` | 665-690 | Instancias Evolution API |
| `Activity` | 701-717 | Log de atividades por lead |
| `Notification` | 63-78 | Notificacoes in-app |
| `OrganizationInvite` | 546-564 | Convites para org |
| `PasswordResetToken` | 566-578 | Tokens de reset de senha |

### Enums existentes

```
Plan: STARTER, GROWTH, SCALE, ENTERPRISE
UserRole: OWNER, ADMIN, MEMBER
LeadStatus: NEW, ENRICHING, ENRICHED, CONTACTED, REPLIED, INTERESTED, MEETING_SCHEDULED, CONVERTED, NOT_INTERESTED, BOUNCED, UNSUBSCRIBED
LeadTemperature: HOT, WARM, COLD
MaturityLevel: EARLY_STAGE, GROWING, ESTABLISHED, ENTERPRISE
CampaignType: EMAIL, WHATSAPP, MULTI_CHANNEL
CampaignStatus: DRAFT, ACTIVE, PAUSED, COMPLETED
StepType: EMAIL, WHATSAPP, WAIT, CONDITION
CampaignLeadStatus: PENDING, IN_PROGRESS, COMPLETED, REPLIED, BOUNCED, UNSUBSCRIBED, PAUSED
MessageType: EMAIL, WHATSAPP
MessageDirection: OUTBOUND, INBOUND
MessageStatus: PENDING, QUEUED, SENT, DELIVERED, OPENED, CLICKED, REPLIED, BOUNCED, FAILED
SignalChannel: EMAIL, WHATSAPP, MANUAL
SignalEventType: MESSAGE_SENT, MESSAGE_REPLY_RECEIVED, MESSAGE_BOUNCED, MESSAGE_FAILED, MANUAL_TOUCHPOINT_CREATED
SignalEventOutcome: SENT, REPLIED, BOUNCED, FAILED, MANUAL
JobStatus: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
AiJobType: SCORING, GENERATION, ANALYSIS
WhatsappStatus: DISCONNECTED, CONNECTING, CONNECTED, BANNED
```

### Padroes do Projeto

| Padrão | Detalhe |
|--------|---------|
| **Autenticacao** | Todas as rotas protegidas usam `onRequest: [fastify.authenticate]`. O JWT contem `{ userId, organizationId, role }` |
| **Multi-tenant** | Toda query filtra por `organizationId` extraido do JWT |
| **Resposta API** | `{ success: true, data: T }` ou `{ success: false, error: string }` |
| **Paginacao** | Query params `page` + `limit`, resposta com `meta: { page, limit, total, totalPages }` |
| **Validacao** | Zod schemas no inicio de cada rota handler |
| **Frontend API** | Cada modulo tem `frontend/lib/[modulo]-api.ts` com axios tipado |
| **Imports Backend** | Usar `.js` extension nos imports (ESM). Ex: `import { prisma } from '../../lib/prisma.js'` |
| **Componentes UI** | shadcn/ui em `frontend/components/ui/`. Nao instalar novos - usar os existentes |
| **Paginas** | Sempre comecar com `"use client"` se tiver hooks. Envolver com `<AppLayout>` |

---

## Resumo das Fases

| Fase | Nome | Foco | Esforco | Dependencias |
|------|------|------|---------|--------------|
| **0** | Estabilizacao | Corrigir bugs, polish, testes | 3 dias | - |
| **1** | Lead Pool v2 | Scraping compartilhado + dedup | 5 dias | Fase 0 |
| **2** | Lead Intelligence | Score, temperatura, enriquecimento | 5 dias | Fase 0 |
| **3** | Signal Engine | Deteccao de padroes + insights | 5 dias | Fase 2 |
| **4** | Distribution Engine | Conteudo gerado a partir de sinais | 4 dias | Fase 3 |
| **5** | Network Layer | Pool compartilhado entre orgs | 5 dias | Fases 1+3 |
| **6** | Growth Loop | Integracao Twitter/LinkedIn + analytics de distribuicao | 3 dias | Fase 4 |

**Total estimado: ~30 dias uteis**

```
Fase 0 ━━━┓
           ┣━ Fase 1 (Lead Pool) ━━━━━━━━━━━━━━━━━━━━━┓
           ┗━ Fase 2 (Intelligence) ━┓                 ┃
                                     ┗━ Fase 3 (Signals) ━┓
                                                          ┣━ Fase 5 (Network)
                                     Fase 4 (Distribution) ━┫
                                                            ┗━ Fase 6 (Growth)
```

---

## Fase 0 — Estabilizacao (3 dias)

> Nao construir nada novo sobre base instavel.

### Contexto do sistema

O sistema ja funciona end-to-end: login → scraping → leads → campaigns → inbox. Porem existem edge cases nao tratados, possiveis erros de tipo no frontend, e falta seed de dados pra desenvolvimento.

O fluxo atual e:
1. Usuario faz login (JWT)
2. Cria um ScrapingJob (POST `/api/scraping/jobs`) 
3. Worker `scraping.worker.ts` executa via BullMQ e cria `Lead` records
4. Usuario ve leads em `/leads` com bulk select + acoes
5. Pode criar Campaign com leads selecionados
6. `campaign.worker.ts` orquestra envio de mensagens nos steps
7. Respostas chegam via IMAP polling ou webhook WhatsApp

### Tarefas
- [ ] Resolver todos os erros de TypeScript no frontend
- [ ] Garantir que todas as rotas do backend retornam dados consistentes
- [ ] Testar fluxo completo: login → scraping → leads → campaign → inbox
- [ ] Garantir que o bulk select + acoes pos-captura funcionam
- [ ] Criar seed de dados pra desenvolvimento (prisma seed)
- [ ] Validar que todos os workers iniciam corretamente

### Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `backend/prisma/seed.ts` | Criar/atualizar com dados realistas |
| `frontend/**/*.tsx` | Corrigir erros TypeScript pendentes |
| `backend/src/modules/**` | Verificar edge cases em todas as rotas |

### Criterio de conclusao
O sistema inteiro roda sem erros no console, com dados seed, e todos os fluxos funcionam end-to-end.

---

## Fase 1 — Lead Pool v2 (5 dias)

> Scraping inteligente com dedup por lead e cache compartilhado.

### Contexto do sistema

Atualmente, o scraping funciona assim:
1. Frontend cria job via `POST /api/scraping/jobs` com `{ name, source, query }` 
2. A rota esta em `backend/src/modules/scraping/scraping.routes.ts`
3. O servico `scraping.service.ts` salva no banco e enfileira no BullMQ
4. O worker `backend/src/jobs/scraping.worker.ts` executa o scraping real
5. Cada resultado vira um `Lead` com `scrapingJobId` vinculado
6. O model `ScrapingJob` tem: `source` (google_maps, cnpj, linkedin), `query` (JSON), `status`, `progress`, `leadsCreated`
7. Leads sao criados com `sourceFingerprint` (hash) + unique constraint `@@unique([organizationId, sourceFingerprint])`
8. A pagina de detalhes do scraping (`frontend/app/scraping/[id]/page.tsx`) mostra progresso real-time e ja tem wizard pos-captura

**Problema:** Cada org faz scraping isolado. Se Org A scrapa "dentistas Curitiba" e Org B scrapa "clinicas odontologicas Curitiba", o sistema nao sabe que sao os mesmos leads.

**Solucao:** Pool global de `SharedLead` com dedup por IDs estruturais + cache inteligente.

### O que mudar

O `scraping.worker.ts` precisa ser interceptado pra:
1. **Antes do scraping**: verificar se o pool tem dados frescos (Camada 1 - pre-busca)
2. **Durante o scraping**: cada resultado e verificado contra o pool (Camada 2 - dedup per-lead)

### Schema a adicionar

```prisma
model SharedLead {
  id              String   @id @default(cuid())
  googlePlaceId   String?  @unique
  companyCnpj     String?  @unique
  linkedinUrl     String?  @unique
  email           String?
  phone           String?
  fullName        String?
  companyName     String?
  website         String?
  city            String?
  state           String?
  category        String?
  source          String
  rawData         Json?
  quality         Int      @default(50)
  confirmations   Int      @default(1)
  lastScrapedAt   DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  claims          SharedLeadClaim[]

  @@index([city, state, category])
  @@index([source])
  @@index([lastScrapedAt])
}

model SharedLeadClaim {
  id              String   @id @default(cuid())
  sharedLeadId    String
  sharedLead      SharedLead @relation(fields: [sharedLeadId], references: [id])
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  leadId          String?  @unique
  lead            Lead?    @relation(fields: [leadId], references: [id])
  claimedAt       DateTime @default(now())

  @@unique([sharedLeadId, organizationId])
}
```

> **Lembrete:** Adicionar `SharedLeadClaim[]` como relation na `Organization` e `Lead` models.

### Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `prisma/schema.prisma` | MODIFY | Novos models SharedLead e SharedLeadClaim |
| `modules/lead-pool/lead-pool.service.ts` | NEW | Pre-busca, claim, merge |
| `modules/lead-pool/lead-pool.routes.ts` | NEW | `GET /search`, `POST /claim`, `GET /stats` |
| `modules/lead-pool/dedup.service.ts` | NEW | Engine de dedup per-lead |
| `modules/lead-pool/category-normalizer.ts` | NEW | Normalizacao de categorias |
| `jobs/scraping.worker.ts` | MODIFY | Interceptar com pre-busca antes de scraping |
| `src/index.ts` | MODIFY | Registrar `leadPoolRoutes` com prefixo `/api/lead-pool` |
| `frontend/lib/lead-pool-api.ts` | NEW | API client do lead pool |
| `frontend/app/scraping/[id]/page.tsx` | MODIFY | Indicador "do cache" vs "scraping novo" |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Schema + migration + seed com SharedLeads |
| 2 | Dedup service (por placeId, CNPJ, email) + testes |
| 3 | Category normalizer + pre-busca no worker |
| 4 | Claim service + integracao completa com scraping worker |
| 5 | Frontend indicators + metricas de economia |

---

## Fase 2 — Lead Intelligence (5 dias)

> Score dinamico, temperatura, enriquecimento avancado.

### Contexto do sistema

O Lead model ja tem campos de scoring:
- `score` (Int? 0-100) — existe mas e populado de forma basica
- `icpMatch` (Float? 0-1) — existe mas raramente preenchido
- `temperature` (LeadTemperature: HOT/WARM/COLD) — existe no schema, default COLD, mas nao e calculado dinamicamente
- `scoreBreakdown` (Json?) — existe mas nao e usado
- `lastInteraction` (DateTime?) — existe mas nao e atualizado automaticamente
- `lastScoreUpdate` (DateTime?) — existe mas nao e usado

O modulo `backend/src/modules/scoring/` ja existe com:
- `scoring.routes.ts` — rota `POST /run` pra disparar recalculo
- `scoring.worker.ts` — worker BullMQ que roda periodicamente

O modulo `backend/src/modules/enrichment/` ja existe com:
- `enrichment.routes.ts` — rotas `POST /bulk` e `POST /jobs`
- `enrichment.worker.ts` — enriquece leads (busca website, emails, CNPJ)
- Dados enriquecidos ficam em `Lead.enrichmentData` (Json)

A Organization tem `icpDefinition` (Json?) que pode armazenar o ICP da org.

### O que melhorar

1. O scoring precisa ser multi-dimensional (nao so um numero, mas 4 eixos)
2. A temperatura precisa transicionar automaticamente baseada em interacoes
3. O enriquecimento precisa usar mais providers e classificar inteligentemente
4. O ICP matcher precisa comparar leads contra `org.icpDefinition`

### Algoritmo de score

```
Score = (enrichment * 0.25) + (interaction * 0.30) + (timing * 0.20) + (icp * 0.25)

enrichment: 0-100 baseado em completude (tem email? CNPJ? LinkedIn? website?)
interaction: 0-100 baseado em replies/opens/meetings do historico de Message
timing: 0-100 baseado em recencia de lastInteraction (decai com o tempo)
icp: 0-100 baseado em fit com icpDefinition da org
```

### Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `modules/scoring/score.engine.ts` | NEW | Calculo 4 dimensoes |
| `modules/scoring/temperature.service.ts` | NEW | Transicoes HOT/WARM/COLD |
| `modules/scoring/scoring.worker.ts` | MODIFY | Usar novo engine |
| `modules/enrichment/enrichment.providers.ts` | MODIFY | Mais providers |
| `modules/enrichment/icp-matcher.ts` | NEW | Match contra icpDefinition |
| `frontend/components/leads/hot-leads-widget.tsx` | NEW | Widget no dashboard |
| `frontend/app/leads/page.tsx` | MODIFY | Badges de temperatura por cor |
| `frontend/app/leads/[id]/page.tsx` | MODIFY | Breakdown visual do score |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Score engine 4 dimensoes + testes |
| 2 | Temperatura automatica (transicoes baseadas em eventos) |
| 3 | Enriquecimento avancado (mais providers) |
| 4 | ICP matcher + scoringWorker integrado |
| 5 | Frontend: hot leads widget + badges coloridos + breakdown |

---

## Fase 3 — Signal Engine (5 dias)

> Detectar padroes nos dados comerciais e transformar em insights.

### Contexto do sistema

O sistema ja tem o model `SignalEvent` no schema (linhas 433-455):
- `eventType`: MESSAGE_SENT, MESSAGE_REPLY_RECEIVED, MESSAGE_BOUNCED, MESSAGE_FAILED, MANUAL_TOUCHPOINT_CREATED
- `channel`: EMAIL, WHATSAPP, MANUAL
- `outcome`: SENT, REPLIED, BOUNCED, FAILED, MANUAL
- `leadSegment`: campo livre pra categorizar
- Indices por `organizationId+eventAt`, `leadId+eventAt`, `campaignId+eventAt`

O modulo `backend/src/modules/signals/` ja existe com:
- `signals.routes.ts` — endpoints GET `/events`, `/lead-recommendations`, `/heatmap`
- Ja roda na rota `/api/signals`

A tabela `Message` ja tem: `sentAt`, `deliveredAt`, `openedAt`, `clickedAt`, `repliedAt`, `bouncedAt`, `responseTime`. Esses campos sao a materia-prima pra deteccao de padroes.

### O que construir

Criar um sistema de **Pattern Detection** que roda periodicamente (cron via BullMQ) e analisa os dados acumulados de `SignalEvent`, `Message`, `Lead`, e `CampaignLead` pra gerar `Signal` records.

### Schema a adicionar

```prisma
model Signal {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  type            SignalType
  confidence      Int          // 0-100
  insight         String       // "CTOs respondem 3.2x mais as tercas 10h"
  dataPoints      Int          // quantidade de dados que sustentam
  suggestedFormats String[]    // ["tweet", "thread", "chart"]
  rawData         Json         // dados brutos pra gerar visualizacao
  status          SignalStatus @default(NEW)
  createdAt       DateTime @default(now())
  distributionDrafts DistributionDraft[]

  @@index([organizationId, type])
  @@index([confidence])
}

enum SignalType { TIMING, CHANNEL, ICP, MESSAGE, OBJECTION, CONVERSION }
enum SignalStatus { NEW, SEEN, USED, DISMISSED }
```

### Os 6 detectores

Cada detector e uma funcao que recebe `organizationId` e retorna `Signal[]`:

| Detector | Query principal | Confianca baseada em |
|----------|----------------|---------------------|
| **Timing** | `Message` agrupado por `dayOfWeek(sentAt)` + `hour(sentAt)`, filtrado por `repliedAt IS NOT NULL` | Volume de messages (>50 = alta) |
| **Channel** | `Message` agrupado por `type` (EMAIL vs WHATSAPP), reply rate por segmento de lead | Volume por canal (>30 = alta) |
| **ICP** | `Lead` com `status IN (REPLIED, INTERESTED, CONVERTED)` vs total, agrupado por `industry`, `companySize` | Volume de conversoes (>20 = alta) |
| **Message** | `CampaignStep.content` comparado com `CampaignLead.status = REPLIED` | Volume de steps testados (>10 = alta) |
| **Objection** | `Message` com `direction = INBOUND` analisado por keywords de objecao | Volume de replies (>15 = alta) |
| **Conversion** | `Lead.status = CONVERTED`, calcular media de `CampaignLead` touchpoints e tempo | Volume de conversoes (>10 = alta) |

### Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `prisma/schema.prisma` | MODIFY | Model Signal + enums |
| `modules/signals/signal.service.ts` | NEW | Orquestrador de deteccao |
| `modules/signals/detectors/timing.detector.ts` | NEW | Analise por dia/hora |
| `modules/signals/detectors/channel.detector.ts` | NEW | Email vs WhatsApp |
| `modules/signals/detectors/icp.detector.ts` | NEW | Perfis que convertem |
| `modules/signals/detectors/message.detector.ts` | NEW | Templates que funcionam |
| `modules/signals/detectors/objection.detector.ts` | NEW | Padroes de objecao |
| `modules/signals/detectors/conversion.detector.ts` | NEW | Funil de conversao |
| `modules/signals/signal-detector.worker.ts` | NEW | BullMQ cron job |
| `modules/signals/signals.routes.ts` | MODIFY | Adicionar GET `/signals` pra listar Signal records |
| `src/index.ts` | MODIFY | Registrar novo worker |
| `frontend/app/signals/page.tsx` | NEW | Dashboard de insights |
| `frontend/lib/signals-api.ts` | MODIFY | Adicionar endpoints de Signal |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Schema + signal service + timing detector |
| 2 | Channel + ICP detectors |
| 3 | Message + objection + conversion detectors |
| 4 | Worker cron + sistema de confianca |
| 5 | Frontend dashboard de signals |

---

## Fase 4 — Distribution Engine (4 dias)

> Transformar signals em conteudo pronto pra postar.

### Contexto do sistema

Depende da Fase 3. Os `Signal` records sao o input. O engine precisa transformar cada signal em conteudo nos formatos: tweet (280 chars), thread (3-5 tweets), chart (imagem exportavel), micro-case (historia anonimizada).

Nao usar LLM pra gerar os textos inicialmente — usar **templates estruturados** com os dados reais do signal. Exemplo:
```
Template: "Analisei {dataPoints} outreaches pra {segment}. Resultado: {insight}."
Dados: { dataPoints: 200, segment: "CTOs de fintech", insight: "tercas 10h tem 3.2x mais respostas" }
Output: "Analisei 200 outreaches pra CTOs de fintech. Resultado: tercas 10h tem 3.2x mais respostas."
```

### Schema a adicionar

```prisma
model DistributionDraft {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  signalId        String?
  signal          Signal?  @relation(fields: [signalId], references: [id])
  format          DraftFormat
  content         String
  editedContent   String?
  status          DraftStatus @default(DRAFT)
  publishedAt     DateTime?
  platform        String?
  impressions     Int?
  engagement      Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum DraftFormat { TWEET, THREAD, CHART, MICRO_CASE, INSIGHT }
enum DraftStatus { DRAFT, APPROVED, PUBLISHED, ARCHIVED }
```

### Arquivos a criar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `prisma/schema.prisma` | MODIFY | Model DistributionDraft |
| `modules/distribution/distribution.service.ts` | NEW | CRUD + geracao |
| `modules/distribution/distribution.routes.ts` | NEW | REST endpoints |
| `modules/distribution/generators/tweet.generator.ts` | NEW | Templates de tweet |
| `modules/distribution/generators/thread.generator.ts` | NEW | Templates de thread |
| `modules/distribution/generators/chart.generator.ts` | NEW | Heatmap/bar chart como PNG |
| `modules/distribution/generators/case.generator.ts` | NEW | Micro-cases anonimizados |
| `src/index.ts` | MODIFY | Registrar distributionRoutes `/api/distribution` |
| `frontend/app/distribution/page.tsx` | NEW | Lista de drafts |
| `frontend/app/distribution/[id]/page.tsx` | NEW | Preview + edicao + aprovacao |
| `frontend/lib/distribution-api.ts` | NEW | API client |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Schema + service + tweet generator |
| 2 | Thread + chart generators |
| 3 | Case generator + frontend dashboard |
| 4 | Preview/edicao + export de imagem |

---

## Fase 5 — Network Layer (5 dias)

> Sinais agregados de todas as orgs (anonimizados).

### Contexto do sistema

A Organization model ja tem campos de configuracao (`apiKeys`, `webhooks`, `notificationSettings`). Precisa adicionar um campo `networkOptIn` (Boolean, default false) pra cada org decidir se compartilha dados anonimizados.

O Pool de Leads (Fase 1) ja cria `SharedLead` records acessiveis por todas as orgs. A Network Layer expande isso para **sinais agregados**: em vez de so leads, compartilhar padroes de mercado.

### O que nao compartilhar (NUNCA)
- Nomes e emails de leads
- Conteudo de mensagens
- Qual org gerou o sinal
- Dados de campanha especificos

### O que compartilhar (opt-in)
- Reply rates por segmento (agregado)
- Timing patterns (agregado)
- Channel performance (agregado)

### Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `prisma/schema.prisma` | MODIFY | `networkOptIn` na Organization |
| `modules/network/network.service.ts` | NEW | Agregacao de sinais cross-org |
| `modules/network/network.routes.ts` | NEW | GET `/network/signals`, GET `/network/stats` |
| `modules/network/anonymizer.ts` | NEW | Garante anonimizacao |
| `src/index.ts` | MODIFY | Registrar networkRoutes `/api/network` |
| `frontend/app/settings/network/page.tsx` | NEW | Toggle de opt-in |
| `frontend/components/signals/network-badge.tsx` | NEW | "Baseado em dados de X SaaS" |
| `frontend/lib/network-api.ts` | NEW | API client |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Schema + opt-in + anonymizer |
| 2 | Agregacao de sinais entre orgs |
| 3 | Network signals no dashboard de signals |
| 4 | Pool de leads compartilhado integrado |
| 5 | Metricas de rede + polish frontend |

---

## Fase 6 — Growth Loop (3 dias)

> Fechar o ciclo: conteudo → impressoes → novos usuarios.

### Contexto do sistema

O Distribution Engine (Fase 4) ja gera conteudo. Esta fase conecta esse conteudo as redes sociais e faz tracking de resultados.

O frontend ja tem `frontend/app/settings/` com layout de sub-paginas. A pagina de integracoes (`settings/integrations`) ja existe. Adicionar config de Twitter/LinkedIn la.

### Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `modules/integrations/twitter.service.ts` | NEW | Post via Twitter API v2 |
| `modules/integrations/linkedin.service.ts` | NEW | Post via LinkedIn API |
| `modules/distribution/tracking.service.ts` | NEW | Tracking engagement |
| `modules/distribution/distribution.service.ts` | MODIFY | Marcar como PUBLISHED |
| `src/index.ts` | MODIFY | Registrar integrationsRoutes se nao existir |
| `frontend/app/growth/page.tsx` | NEW | Dashboard de growth loop |
| `frontend/app/settings/integrations/page.tsx` | MODIFY | Config Twitter/LinkedIn keys |
| `frontend/lib/growth-api.ts` | NEW | API client |

### Entregas por dia

| Dia | Entrega |
|-----|---------|
| 1 | Twitter + LinkedIn integration backend |
| 2 | Tracking de resultados + atribuicao |
| 3 | Growth dashboard frontend |

---

## Prioridade de Execucao

```
AGORA (MVP critico):
  Fase 0 → Fase 2 → Fase 3

DEPOIS (diferencial):
  Fase 1 → Fase 4

QUANDO TIVER USUARIOS:
  Fase 5 → Fase 6
```

### Por que essa ordem?

| Fase | Justificativa |
|------|--------------|
| **0 primeiro** | Nao construir sobre base instavel |
| **2 antes de 1** | Score e temperatura ja melhoram UX com dados existentes |
| **3 logo apos 2** | Signal Engine e O diferencial. Com score + signals, produto unico |
| **1 pode esperar** | Lead Pool so faz sentido com multiplas orgs |
| **4 apos 3** | Distribution precisa de signals pra gerar conteudo |
| **5 e 6 por ultimo** | Network e Growth precisam de base de usuarios |

---

## Comandos Uteis

```bash
# Rodar backend (dev)
cd backend && npm run dev

# Rodar frontend (dev)
cd frontend && npm run dev

# Rodar com Docker
docker compose up -d

# Criar migration
cd backend && npx prisma migrate dev --name <nome>

# Gerar Prisma Client (apos alterar schema)
cd backend && npx prisma generate

# Seed de dados
cd backend && npx prisma db seed

# Resetar banco
cd backend && npx prisma migrate reset
```
