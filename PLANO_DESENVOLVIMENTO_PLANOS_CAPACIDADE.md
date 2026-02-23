# Plano De Desenvolvimento - Sistema De Planos Por Capacidade

Data: 2026-02-23  
Status: Proposta executavel (backend + frontend + seguranca)

## 1) Contexto do sistema atual

O Lastreia hoje opera com arquitetura multi-servico:

- `backend/` em Node.js + Fastify + Prisma.
- `frontend/` em Next.js (App Router) + Tailwind + shadcn/ui.
- `services/` Python para `scraping`, `enrichment` e `ai`.
- Fila BullMQ + Redis para jobs assincronos.
- Postgres como fonte principal.

Estado atual relevante para planos:

- Existe `Plan` no Prisma (`STARTER`, `GROWTH`, `SCALE`, `ENTERPRISE`).
- A organizacao ja possui limites e consumo (`leadsLimit`, `emailsLimit`, `whatsappLimit`, `enrichmentsLimit` e `*Used`).
- O backend valida limites em pontos criticos (leads/email/whatsapp/enrichment/scraping).
- Billing no frontend ja exibe consumo de sinais e tier sugerido.

Lacunas para o novo modelo de negocio:

- Regras de limite estao espalhadas em modulos, sem um motor unico de policy/quota.
- Dimensoes novas de negocio (`volume`, `escala`, `automacao`, `sofisticacao`) ainda nao estao modeladas como contrato unico.
- Nao ha fluxo de overage por pacote formalizado.
- Nao ha trilha completa de auditoria de consumo por dimensao para decisao comercial.

## 2) Objetivo de negocio

Implementar planos sem feature gating, cobrando por capacidade de prospeccao:

- `volume`
- `escala`
- `automacao`
- `sofisticacao`

Premissas de produto:

- Inbox, campanhas, scraping, enrichment, AI e signals seguem disponiveis em todos os planos.
- Diferenca entre planos e feita por capacidade e profundidade operacional.
- UX deve deixar claro limite, consumo, previsao de estouro e caminho de upgrade.

## 3) Catalogo de planos (v1)

Valores comerciais definidos:

- Starter: `R$ 149`
- Growth: `R$ 399`
- Scale: `R$ 1.200`
- Enterprise: `a partir de R$ 3.000`

Capacidades propostas para implementacao v1:

| Plano | Volume | Escala | Automacao | Sofisticacao |
|---|---|---|---|---|
| Starter | 2k sinais/mes, 500 leads novos/mes | 1 job concorrente, 2 campanhas ativas, 3 assentos | 10 runs/dia, 10 regras | recomendacao base, refresh diario |
| Growth | 10k sinais/mes, 2.5k leads novos/mes | 3 jobs concorrentes, 8 campanhas ativas, 10 assentos | 80 runs/dia, 40 regras | segmentacao por canal, refresh 4h |
| Scale | 40k sinais/mes, 10k leads novos/mes | 8 jobs concorrentes, 25 campanhas ativas, 30 assentos | 400 runs/dia, 150 regras | ranking avancado, refresh 1h |
| Enterprise | custom | custom | custom | custom |

Modelo de excedente (overage):

- Pacote `+5k sinais` com validade no ciclo corrente.
- Sem bloqueio de features; bloqueio ocorre apenas em capacidade operacional quando nao houver pacote/upgrade.

## 4) Escopo tecnico

### Backend

- Motor unico de quotas e policies.
- Contrato de planos versionado.
- Enforcement centralizado por operacao.
- Auditoria e observabilidade de consumo.
- APIs de billing/usage para frontend.

### Frontend

- Nova experiencia de Billing com foco em capacidade.
- Indicadores por dimensao (volume/escala/automacao/sofisticacao).
- Alertas de consumo progressivos.
- Fluxo de upgrade e compra de overage (mesmo que inicial seja manual).

### Seguranca

- RBAC estrito para mudancas de plano e limites.
- Integridade de consumo (anti-manipulacao e anti-race condition).
- Auditoria de todas as alteracoes administrativas.
- Validacao de inputs e limites no backend (frontend nunca como fonte da verdade).

## 5) Arquitetura proposta

## 5.1 Modulo central de billing/quota (backend)

Criar modulo `backend/src/modules/billing/` com:

- `plan-catalog.ts`: catalogo versionado de planos e capacidades.
- `quota.service.ts`: API interna para `check`, `consume`, `refund`, `snapshot`.
- `quota.types.ts`: metricas e entidades de consumo.
- `billing.routes.ts`: endpoints para frontend e admin.

Metricas normalizadas (v1):

- `signals_monthly`
- `leads_monthly`
- `concurrent_jobs`
- `active_campaigns`
- `seats_total`
- `automation_runs_daily`
- `automation_rules_total`
- `sophistication_level` (enum de policy, nao contador)

## 5.2 Modelagem de dados (Prisma)

Adicionar entidades para governanca de consumo:

- `OrganizationPlanConfig`
  - plano atual, preco de referencia, `planVersion`, status de billing, ciclo atual.
- `OrganizationUsageCounter`
  - contador por org + metrica + periodo (`MONTHLY` ou `DAILY`), com `used`.
- `UsageLedger`
  - eventos imutaveis de consumo/estorno para auditoria.
- `PlanOveragePurchase`
  - pacotes extras comprados e saldo.
- `PlanChangeAudit`
  - historico de troca de plano e alteracoes administrativas.

Observacao:

- Manter campos atuais (`leadsUsed`, `emailsUsed`, `whatsappUsed`, `enrichmentsUsed`) em fase de transicao.
- Migrar gradualmente para leitura principal via `OrganizationUsageCounter`.

## 5.3 Enforcement transacional

Regra tecnica obrigatoria:

- Todo consumo deve ser validado e reservado em transacao unica.

Implementacao:

- `quota.service.consumeOrThrow(...)` usando transacao Prisma.
- Controle de corrida para concorrencia:
  - `SELECT ... FOR UPDATE` em linha de contador ou estrategia equivalente com `updateMany` condicional.
- Idempotencia:
  - `operationKey` unico no `UsageLedger` para evitar dupla cobranca por retry/webhook duplicado.

## 6) Pontos de integracao por modulo

### Leads

- `leads.create` e `leads.bulkCreate`: consumir `leads_monthly`.

### Scraping

- Ao iniciar job: validar `concurrent_jobs`.
- Ao persistir leads capturados: consumir `leads_monthly`.

### Campaigns

- Ao criar/ativar: validar `active_campaigns`.
- Ao agendar execucoes automaticas: consumir `automation_runs_daily`.

### Email e WhatsApp

- Ao enfileirar/enviar: consumir `signals_monthly` (eventos outbound).

### Enrichment

- Ao processar leads: consumir `signals_monthly` e manter metrica de enriquecimento para custo interno.

### AI

- Sem bloquear feature por plano.
- Aplicar `sophistication_level` para estrategia:
  - Starter: prompt/regras base.
  - Growth: prompts com segmentacao intermediaria.
  - Scale: politicas mais profundas + recalculo mais frequente.

## 7) Endpoints novos/ajustados

Adicionar no backend:

- `GET /api/billing/catalog`
  - retorna planos, capacidades e precos exibiveis.
- `GET /api/billing/usage`
  - snapshot por dimensao e alertas de threshold.
- `GET /api/billing/overage`
  - saldo de pacotes extras.
- `POST /api/billing/overage/purchase` (inicialmente manual/admin-safe)
  - registra compra de pacote.
- `POST /api/billing/change-plan` (OWNER/ADMIN, opcionalmente OWNER apenas)
  - troca de plano com auditoria.

Contratos de erro padrao:

- `409 LIMIT_EXCEEDED` com payload:
  - `dimension`
  - `metric`
  - `used`
  - `limit`
  - `recommendedPlan`
  - `upgradeCta`

## 8) Frontend - plano de implementacao

## 8.1 Pagina Billing (`/settings/billing`)

Entregas:

- Cards dos planos com preco e resumo de capacidade.
- Painel de uso por dimensao:
  - Volume
  - Escala
  - Automacao
  - Sofisticacao (policy ativa)
- Barras com thresholds (70%, 85%, 100%).
- Bloco de overage (saldo + CTA).
- Historico de alteracoes de plano.

## 8.2 UX contextual nas operacoes

Ao atingir limite em qualquer fluxo:

- Modal nao tecnico e direto com:
  - o que foi bloqueado
  - capacidade atual
  - opcao de overage
  - opcao de upgrade

Fluxos alvo:

- criar campanhas
- iniciar scraping
- enviar mensagens
- criar automacoes/regras

## 8.3 Estado e tipagem

Atualizar `frontend/lib/organization-api.ts` e criar `frontend/lib/billing-api.ts`:

- tipos de quota por dimensao
- tipos de alertas
- tipos de overage
- mapeamento de erros de limite

## 9) Seguranca (desde o inicio)

Controles obrigatorios:

- RBAC:
  - alteracao de plano e overage apenas `OWNER/ADMIN`.
  - ajuste manual de limite apenas rota admin interna.
- Validacao server-side:
  - zod em todos os payloads de billing.
- Integridade:
  - ledger imutavel para consumo e estorno.
  - `operationKey` unico para idempotencia.
- Protecao de abuso:
  - rate limit em endpoints de billing sensiveis.
- Auditoria:
  - trilha completa de quem mudou plano, quando e de onde.
- SQL injection:
  - manter Prisma query builder/parametrizacao.
  - proibido `queryRawUnsafe`/`executeRawUnsafe`.
- Segredos:
  - nunca trafegar chaves de provider para frontend.

## 10) Migração de dados e compatibilidade

Estrategia sem downtime:

1. Deploy de schema novo sem mudar comportamento antigo.
2. Backfill inicial de `OrganizationUsageCounter` com base nos contadores atuais e `SignalEvent` do mes.
3. Ativar leitura dual:
   - comparar contador novo vs antigo em logs.
4. Ativar enforcement central por feature flag.
5. Remover caminhos legados apos estabilizacao.

Feature flags sugeridas:

- `BILLING_V2_ENABLED`
- `BILLING_V2_ENFORCEMENT`
- `BILLING_V2_UI`

## 11) Testes e qualidade

### Backend

- Unitarios:
  - calculo de limite por plano
  - limiares de alerta
  - recomendacao de upgrade
- Integracao:
  - consumo transacional concorrente
  - idempotencia por `operationKey`
  - overage aplicado corretamente
- Seguranca:
  - RBAC negativo
  - tentativa de manipular payload de limite
  - tentativa de estouro por requisicoes paralelas

### Frontend

- Unitarios:
  - render de estado por plano
  - calculo de progresso e alertas
- E2E:
  - usuario sem limite -> fluxo normal
  - usuario no limite -> modal de bloqueio + CTA
  - upgrade refletindo no dashboard

## 12) Observabilidade operacional

Adicionar metricas:

- `quota_check_total{metric,result}`
- `quota_consume_total{metric}`
- `quota_block_total{metric,plan}`
- `overage_purchase_total`
- `plan_change_total{from,to}`

Dashboards:

- consumo por org/plano
- bloqueios por dimensao
- top orgs perto do limite
- impacto em conversao de upgrade

Alertas:

- erro de quota service > limiar
- divergencia entre contador legado e novo > 2%
- pico anormal de bloqueios apos deploy

## 13) Roadmap de execucao (3 sprints)

Sprint 1 (Backend core, 5 dias):

- schema Prisma + migrations
- modulo `billing/quota`
- endpoints `catalog` e `usage`
- ledger + auditoria
- feature flags base

Sprint 2 (Enforcement + Frontend, 5 dias):

- integrar enforcement em leads/scraping/campaign/email/whatsapp/enrichment
- nova UI de billing por dimensao
- tratamento de erro `LIMIT_EXCEEDED` no frontend
- overage basico manual

Sprint 3 (Hardening + Rollout, 4 dias):

- testes de concorrencia e seguranca
- backfill + leitura dual
- rollout progressivo por org
- monitoracao e ajustes finais

## 14) Criterios de aceite (Definition of Done)

- Planos por capacidade ativos e visiveis no frontend.
- Nenhum bloqueio por feature; bloqueio apenas por capacidade.
- Limites aplicados de forma consistente em todos os modulos alvo.
- Sem bypass por concorrencia/paralelismo.
- Auditoria completa de mudancas de plano e consumo.
- Alertas de consumo funcionais (70/85/100).
- E2E aprovado para fluxo normal, limite e upgrade.
- Deploy em producao com rollback validado.

## 15) Riscos e mitigacoes

Risco: regressao de fluxo por enforcement novo.  
Mitigacao: feature flag + rollout gradual + monitoracao de bloqueios.

Risco: divergencia entre contadores novos e antigos.  
Mitigacao: leitura dual por periodo e reconciliacao automatica.

Risco: custo subir rapidamente ao liberar escala.  
Mitigacao: metricas de shadow cost por org e alertas de margem.

Risco: corrida em alta concorrencia gerar consumo incorreto.  
Mitigacao: transacao com lock + idempotencia por operacao.

## 16) Decisoes em aberto (para fechar antes de codar)

- Politica exata de overage:
  - bloquear ao atingir 100% sem pacote?
  - permitir burst controlado?
- Quem pode trocar plano:
  - OWNER somente, ou ADMIN tambem?
- Ciclo de renovacao:
  - calendario (todo dia 1) ou aniversario da assinatura?
- Strategy inicial de cobranca:
  - manual com registro interno, ou Stripe ja no v1?

