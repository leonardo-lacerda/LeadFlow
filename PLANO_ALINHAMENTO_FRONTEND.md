# PLANO_ALINHAMENTO_FRONTEND.md

> Documento de handoff tecnico para proximas execucoes de IA.
> Ultima atualizacao: 2026-02-22.
> Objetivo: reduzir ambiguidade e acelerar execucao com seguranca.

---

## 1) Como usar este documento

1. Leia as secoes `2`, `3` e `4` para entender o sistema atual.
2. Execute o pre-flight da secao `11` antes de codar.
3. Siga a ordem de fases da secao `8`.
4. Atualize este documento no final da execucao:
   - data
   - itens concluidos
   - riscos novos
   - comandos de validacao executados

Este arquivo deve ser tratado como fonte de verdade operacional para o alinhamento Frontend x Backend.

---

## 2) Contexto do sistema

## 2.1 Produto (resumo)
- Produto: Lastreia (aquisicao B2B orientada por sinais).
- Modelo: multi-tenant por `organizationId`.
- Fluxo principal de negocio:
  `auth -> scraping -> leads -> campaigns -> inbox -> signals -> distribution -> growth`.

## 2.2 Arquitetura do repositorio

```
SDR/
|- backend/      Fastify + Prisma + BullMQ + Redis
|- frontend/     Next.js App Router + React Query + Zustand + shadcn/ui
|- services/     Python (scraping, enrichment, ai)
`- docker-compose.yml
```

## 2.3 Runtime local (padrao)
- Backend API: `http://localhost:4000`
- Frontend: `http://localhost:3000`
- Scraping service: `http://localhost:5001`
- Enrichment service: `http://localhost:5002`
- AI service: `http://localhost:5003`
- Redis: `localhost:6379`
- Postgres: `localhost:5432`

---

## 3) Contratos e convencoes criticas

## 3.1 API contract
- Prefixo: `/api/*`
- Resposta de sucesso: `{ success: true, data: ... }`
- Erro: `{ success: false, error: string }`
- Paginacao: `meta: { page, limit, total, totalPages }` quando aplicavel

## 3.2 Auth e tenant
- JWT no header `Authorization: Bearer <token>`.
- Backend filtra dados por `organizationId` derivado do JWT.
- Quase todas as rotas de negocio usam `onRequest: [fastify.authenticate]`.

## 3.3 Workers e processamento assincrono
- Filas BullMQ:
  `scraping`, `enrichment`, `email`, `whatsapp`, `ai`, `campaign`, `scoring`, `analytics`, `inbox_followup`, `signal_detector`, `social_publish`.
- Workers iniciam quando `RUN_WORKERS=true`.
- IMAP polling inicia quando `RUN_IMAP_POLLING=true`.

## 3.4 Frontend data layer
- Client HTTP unico: `frontend/lib/api.ts` (axios + token interceptor).
- Estado auth: `frontend/store/auth-store.ts` (Zustand persistido).
- Fetching/cache: TanStack React Query.
- Regra desejada: toda chamada HTTP de negocio deve estar em `frontend/lib/*-api.ts`.

---

## 4) Mapa atual do sistema (para a proxima IA)

## 4.1 Backend modulos ativos

Registrados em `backend/src/index.ts`:
- `/api/auth`
- `/api/leads`
- `/api/scraping`
- `/api/enrichment`
- `/api/email`
- `/api/whatsapp`
- `/api/ai`
- `/api/campaigns`
- `/api/inbox`
- `/api/organization`
- `/api/notifications`
- `/api/analytics`
- `/api/scoring`
- `/api/signals`
- `/api/lead-pool`
- `/api/distribution`
- `/api/network`
- `/api/integrations`
- `/api/ops`

## 4.2 Entidades relevantes no schema Prisma

Arquivo: `backend/prisma/schema.prisma`

Core:
- `Organization` (com `networkOptIn`, `apiKeys`, limites e consumo)
- `User`, `Lead`, `Campaign`, `CampaignStep`, `CampaignLead`, `Message`
- `ScrapingJob`, `EnrichmentJob`, `AiJob`

Camadas novas:
- `SignalEvent`, `Signal`
- `SharedLead`, `SharedLeadClaim`
- `DistributionDraft`
- `SocialPublishJob`

Enums novos/relevantes:
- `SignalType`, `SignalStatus`
- `DraftFormat`, `DraftStatus`
- `SocialPlatform`, `SocialPublishStatus`

## 4.3 Cobertura frontend atual (resumo)

### Bem coberto
- Leads, Scraping, Inbox, Analytics, Signals, Distribution, Growth, Network settings.

### Parcial
- Campaigns (UI existe, mas fluxo operacional esta desalinhado: secao 7).
- Integracoes (CRUD basico ok, operacoes avancadas incompletas).

### Sem superficie de produto (apesar de backend/client existir)
- Lead Pool (`frontend/lib/lead-pool-api.ts` sem pagina dedicada)
- AI workspace (`frontend/lib/ai-api.ts` com uso minimo e sem area completa)

---

## 5) Estado de qualidade observado em 2026-02-22

## 5.1 Snapshot de cobertura API
- Endpoints backend mapeados: 139
- Chamadas frontend mapeadas: 86
- Endpoints backend sem consumo frontend: 55
- Endpoints frontend sem backend correspondente: 0

Observacao:
- Nem todo endpoint sem consumo e bug (ex.: webhooks internos, operacoes administrativas).
- O problema real e ausencia de superficie para features novas e drift em alguns fluxos criticos.

## 5.2 Status de verificacao
- `backend npm run build`: OK
- `backend npm run lint`: OK
- `frontend npm run lint`: OK
- `frontend npm run build`: OK
- Observacao:
  - Foram corrigidos erros de tipagem `transition.ease` em landings (`landing-v1` a `landing-v6`).

---

## 6) Mudancas recentes que explicam o desalinhamento

Hotspots recentes de alteracao:
- Backend: expansao forte em `signals`, `lead-pool`, `distribution`, `network`, `integrations`.
- Frontend: novas paginas (`/signals`, `/distribution`, `/growth`, `/settings/network`) e ajustes de layout/landing.

Resumo do efeito:
- Backend evoluiu para novas camadas (Signal/Distribution/Network/Growth).
- Frontend acompanhou parcialmente: algumas camadas estao boas, mas fluxos legados (campaign/enrichment) ficaram com drift.

---

## 7) Gaps principais (com impacto e evidencia)

## 7.1 P0 - Campanha ativa sem disparar fluxo correto

Evidencia:
- Backend tem rotas operacionais:
  - `POST /api/campaigns/:id/launch`
  - `POST /api/campaigns/:id/pause`
  - `POST /api/campaigns/:id/resume`
- Frontend usa majoritariamente:
  - `PATCH /api/campaigns/:id/status`
  - arquivos: `frontend/app/campaigns/page.tsx`, `frontend/app/campaigns/[id]/page.tsx`

Impacto:
- Status pode mudar sem orquestrar fila/processamento conforme fluxo esperado.

Status 2026-02-22:
- Resolvido no frontend (`launch/pause/resume` aplicado em listagem e detalhe).

## 7.2 P0 - Endpoints de enrichment obsoletos no frontend

Evidencia:
- Frontend chama endpoint inexistente:
  - `POST /enrichment/bulk` em `frontend/app/leads/page.tsx`
- Frontend chama endpoint local inexistente no Next:
  - `fetch('/api/enrichment/bulk-by-scraping/:id')` em `frontend/app/scraping/[id]/page.tsx`
- Backend expoe:
  - `POST /api/enrichment/jobs`
  - `GET /api/enrichment/jobs`
  - `GET /api/enrichment/jobs/:id`

Impacto:
- Acao de enriquecimento quebra/retorna erro em fluxo de usuario.

Status 2026-02-22:
- Resolvido no frontend com `frontend/lib/enrichment-api.ts` e migracao das telas de leads/scraping.

## 7.3 P0 - Build de producao quebrado

Evidencia:
- `next build` falha em `frontend/app/landing-v1/page.tsx:168`.

Impacto:
- Sem deploy confiavel.

Status 2026-02-22:
- Resolvido (`frontend npm run build` verde).

## 7.4 P1 - Contrato inconsistente no campaignsApi.addLeads

Evidencia:
- `frontend/lib/campaigns-api.ts` tipa retorno de `addLeads` como `{ added, skipped }`.
- Backend retorna `{ created }` (service/routes atuais).

Impacto:
- Risco de bug silencioso em telas que dependam do retorno.

Status 2026-02-22:
- Resolvido (`addLeads` alinhado para `{ created }`).

## 7.5 P1 - Features novas sem UI completa

Evidencia:
- `frontend/lib/lead-pool-api.ts` sem pagina dedicada.
- `frontend/lib/ai-api.ts` sem workspace funcional completo.

Impacto:
- Valor de backend nao chega no produto final.

Status 2026-02-22:
- Resolvido (MVP de produto entregue):
  - `Lead Pool` com busca/claim/stats e atalhos para leads/scraping/campaign.
  - `AI workspace` com geracao, analise (intent/sentiment) e prompts.
  - Integracoes avancadas (email/whatsapp) com operacoes de teste, warmup, status e ativacao.

## 7.6 P2 - Inconsistencia de padrao frontend

Evidencia:
- Uso de `fetch` direto e leitura de DOM (`document.getElementById`) em algumas telas.

Impacto:
- Menor previsibilidade, pior testabilidade, maior chance de regressao.

Status 2026-02-22:
- Resolvido nas telas alteradas do escopo do plano:
  - remocao de manipulacao imperativa de DOM em formularios
  - adocao de `react-hook-form` + Zod em telas novas/prioritarias
  - padrao consistente de estados loading/empty/error/success nas superficies alteradas

---

## 8) Plano de execucao detalhado (ordem recomendada)

## Fase 0 - Bloqueadores (1 dia)

Objetivo:
- Restaurar deploy e fluxos criticos quebrados.

Tarefas:
1. Corrigir erro de tipagem em `frontend/app/landing-v1/page.tsx`.
2. Implementar metodos `launch/pause/resume` em `frontend/lib/campaigns-api.ts`.
3. Trocar UI de campanhas para usar os endpoints operacionais (nao apenas `updateStatus`).
4. Criar `frontend/lib/enrichment-api.ts` e migrar chamadas obsoletas de enrichment.
5. Remover `fetch('/api/enrichment/bulk-by-scraping/...')` da tela de scraping.

Arquivos alvo:
- `frontend/app/landing-v1/page.tsx`
- `frontend/lib/campaigns-api.ts`
- `frontend/app/campaigns/page.tsx`
- `frontend/app/campaigns/[id]/page.tsx`
- `frontend/lib/enrichment-api.ts` (novo)
- `frontend/app/leads/page.tsx`
- `frontend/app/scraping/[id]/page.tsx`

Criterio de aceite:
- `npm run lint` e `npm run build` (frontend) verdes.
- Ativar campanha pela UI aciona `launch`.
- Pausar campanha pela UI aciona `pause`.
- Enriquecimento via leads e scraping nao retorna 404.

## Fase 1 - Alinhamento de contratos e API layer (1-2 dias)

Objetivo:
- Unificar contratos e eliminar drift de payload/resposta.

Tarefas:
1. Alinhar tipo de retorno `campaignsApi.addLeads` com backend.
2. Revisar tipagens de `Campaign` e `CampaignStep` com schema real.
3. Garantir que chamadas de negocio saiam de `frontend/lib/*-api.ts` (sem fetch direto em pages).
4. Padronizar tratamento de erro para toasts.

Criterio de aceite:
- Nenhuma chamada de negocio fora da camada de clients.
- Tipos de resposta refletem payload backend.

## Fase 2 - Cobertura funcional das camadas novas (3-4 dias)

Objetivo:
- Expor no frontend o valor das features novas ja implementadas no backend.

Tarefas:
1. Criar tela `Lead Pool`:
   - busca (`/lead-pool/search`)
   - claim (`/lead-pool/claim`)
   - stats (`/lead-pool/stats`)
2. Integrar atalhos de Lead Pool com leads/scraping/campaigns.
3. Criar `AI workspace` inicial:
   - gerar mensagem
   - analise (intent/sentiment)
   - prompts basicos
4. Completar operacoes avancadas de integracoes (email/whatsapp) na UI.

Arquivos previstos:
- `frontend/app/lead-pool/page.tsx` (novo)
- `frontend/components/lead-pool/*` (novos)
- `frontend/app/ai/page.tsx` (novo)
- `frontend/lib/ai-api.ts` (expandir)
- `frontend/lib/integrations-api.ts` (expandir)
- componentes de settings/integrations

Criterio de aceite:
- Features novas acessiveis via navegacao principal e funcionais ponta a ponta.

## Fase 3 - Hardening de UX e escalabilidade (2 dias)

Objetivo:
- Melhorar manutencao e reduzir regressao.

Tarefas:
1. Substituir manipulacao de DOM imperativa por `react-hook-form` + schema.
2. Revisar query keys e invalidacoes no React Query.
3. Padronizar estados `loading/empty/error/success`.
4. Revisar responsividade e consistencia visual das telas novas.

Criterio de aceite:
- Sem `document.getElementById` para fluxo de formulario.
- Estados de UX cobertos em todas as telas alteradas.

## Fase 4 - Validacao final e handoff (1-2 dias)

Objetivo:
- Fechar ciclo com confianca operacional.

Tarefas:
1. Rodar smoke funcional dos fluxos criticos.
2. Registrar checklist de regressao.
3. Atualizar este documento com resultados.

Checklist minimo:
- auth
- scraping
- enrichment
- leads
- campaign launch/pause/resume
- inbox
- signals
- distribution/growth publish

---

## 9) Backlog priorizado

### P0
- Build frontend verde.
- Fluxo operacional de campaign corrigido.
- Endpoints de enrichment alinhados.

### P1
- Lead Pool UI.
- AI workspace minimo.
- Contratos de resposta alinhados em `campaigns-api`.

### P2
- Testes de contrato FE x BE.
- Hardening de UX e padrao de forms.

---

## 10) Riscos e mitigacoes

Risco:
- Ajuste de campanha quebrar comportamento existente em telas legadas.
Mitigacao:
- Migracao incremental por tela + smoke apos cada merge.

Risco:
- Escopo AI crescer sem fim.
Mitigacao:
- Limitar MVP a 3 casos de uso antes de expandir.

Risco:
- Regressao silenciosa em contratos de API.
Mitigacao:
- Criar teste de contrato para endpoints P0/P1.

---

## 11) Runbook de execucao para a proxima IA

## 11.1 Pre-flight (obrigatorio)

```bash
# Raiz
git status --short

# Backend
cd backend && npm run build && npm run lint

# Frontend
cd ../frontend && npm run lint
cd ../frontend && npm run build
```

Se `frontend build` falhar, resolver antes de iniciar features novas.

## 11.2 Comandos uteis de validacao

```bash
# Subir stack completa
docker compose up -d

# Health backend
curl http://localhost:4000/health

# Seeds
cd backend && npx prisma db seed

# Validar workers (manual: filas BullMQ)
# verificar queues: scraping, enrichment, email, whatsapp, ai, campaign, scoring, analytics, inbox_followup, signal_detector
```

## 11.3 Checklist de encerramento
- `frontend lint` verde
- `frontend build` verde
- fluxos P0 validados
- documento atualizado com:
  - o que foi feito
  - comandos executados
  - limitacoes pendentes

---

## 12) Registro de decisoes (atualizar a cada ciclo)

| Data | Decisao | Motivo | Impacto |
|---|---|---|---|
| 2026-02-22 | Priorizar Fase 0 antes de novas features | Build e fluxos criticos com drift | Evita acumulo de divida e regressao |
| 2026-02-22 | Campanhas UI migrada para `launch/pause/resume` | Evitar mudanca de status sem orquestracao de filas | Fluxo operacional alinhado ao backend |
| 2026-02-22 | Criar `enrichment-api` dedicado com helper por scraping job | Remover endpoints obsoletos e centralizar acesso | Enriquecimento de leads/scraping sem 404 |
| 2026-02-22 | Expor `Lead Pool` e `AI Workspace` como paginas de produto | Reduzir gap de features backend sem superficie FE | Cobertura funcional ampliada e navegavel |
| 2026-02-22 | Hardening inicial em telas alteradas (erro/loading e fim de DOM imperativo) | Reduzir regressao e facilitar manutencao | Melhor previsibilidade operacional |
| 2026-02-22 | Padronizar formularios com RHF+Zod e invalidacao de query por chave | Melhorar manutencao e reduzir estados inconsistentes | Fase 3 concluida com build/lint verde |

---

## 13) Definicao global de pronto (DoD)

Uma fase so e considerada concluida quando:
1. Entregas de codigo implementadas.
2. Contratos FE x BE alinhados.
3. Validacoes de lint/build executadas.
4. Fluxo funcional correspondente testado.
5. Este documento atualizado.

---

## 14) Registro da execucao atual (2026-02-22)

### 14.1 Itens concluidos
- Fase 0 concluida:
  - build blocker de Framer Motion corrigido
  - `campaigns-api` com `launch/pause/resume`
  - telas de campanhas migradas para fluxo operacional
  - `enrichment-api` criado e integrado em leads/scraping
- Fase 1 concluida:
  - contrato `addLeads` alinhado (`{ created }`)
  - tipagens de campanha revisadas (status/type/step/lead)
  - chamadas de negocio removidas de `fetch` direto nas telas alteradas
  - helper de erro padronizado (`frontend/lib/error-utils.ts`)
- Fase 2 concluida (MVP):
  - `frontend/app/lead-pool/page.tsx` + `frontend/components/lead-pool/*`
  - `frontend/app/ai/page.tsx`
  - `frontend/lib/ai-api.ts` expandido (generate + analyze + prompts)
  - `frontend/lib/integrations-api.ts` expandido e UI de integracoes com operacoes avancadas
  - navegacao principal atualizada com Lead Pool e AI Workspace
- Fase 3 concluida:
  - formularios migrados para `react-hook-form` + Zod em `distribution/[id]`, `ai` e filtros de `lead-pool`
  - invalidacoes do React Query ajustadas para chave (`campaigns`) nas mutacoes de status
  - estados `loading/empty/error/success` padronizados nas telas alteradas
  - revisao de responsividade nas novas superficies (header/acoes de `lead-pool`)
- Fase 4 concluida:
  - smoke funcional executado cobrindo fluxos criticos
  - script de execucao adicionado em `scripts/smoke_phase4.ps1`
  - resultado salvo em `scripts/smoke_phase4_result_20260221235717.json`
- P2 (contrato FE x BE) concluido para escopo P0/P1:
  - criado `backend/src/contracts/p0-p1-contract.test.ts`
  - testes estaticos garantindo contratos criticos de campaigns/enrichment entre frontend e backend
- Extensao operacional pos-plano concluida:
  - OAuth real de Twitter/LinkedIn com callback, refresh token e persistencia criptografada das credenciais
  - publicacao social assicrona com BullMQ (`social_publish`), retries exponenciais e historico por job
  - observabilidade operacional (`/api/ops/*`) com metricas de filas/workers, erros recentes e alertas
  - tela de observabilidade em `settings/observability` consumindo summary/alerts/errors
  - suite e2e com Playwright e pipeline CI em `.github/workflows/ci.yml`
  - ajuste de compatibilidade React 19 no editor de templates (`react-quill-new`) para `npm ci` verde sem flags

### 14.2 Comandos de validacao executados
```bash
cd backend && npm run build
cd backend && npm run lint
cd backend && npm run test
cd frontend && npm run lint
cd frontend && npm run build
powershell -ExecutionPolicy Bypass -File scripts/smoke_phase4.ps1
```

### 14.3 Riscos novos
- `AI workspace` usa payloads heterogeneos do backend/servico AI; manter monitoramento de shape de resposta.
- Operacoes avancadas de integracoes exigem validacao funcional com provedores reais (SMTP/WhatsApp).

### 14.4 Limitacoes pendentes
- Nenhuma limitacao tecnica bloqueante no escopo deste plano.

### 14.5 Checklist de smoke (Fase 4)
- auth: PASS
- scraping: PASS
- enrichment: PASS
- leads: PASS
- campaign launch/pause/resume: PASS
- inbox: PASS
- signals: PASS
- distribution publish: PASS
- growth publish: PASS (cenario sem token validado com erro esperado `400`; publish live depende de credenciais reais)

### 14.6 Observacoes de ambiente desta execucao
- Para viabilizar smoke local, Redis foi ajustado para versao compativel com BullMQ (`Memurai`, redis_version `7.2.5`).
- Backend foi iniciado localmente com `RUN_WORKERS=false` e `RUN_IMAP_POLLING=false` para smoke de API.
- Novo resultado de smoke registrado em `scripts/smoke_phase4_result_20260221235717.json`.
