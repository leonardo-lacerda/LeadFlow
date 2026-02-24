# SDR Autonomo por IA - Visao, Escopo e Plano de Desenvolvimento

Data: 2026-02-24
Status: Proposta executavel alinhada ao Lastreia atual

## 1) Resumo da ideia

O SDR Autonomo por IA e um agente operacional de outbound que atua acima dos modulos ja existentes do Lastreia (scraping, enrichment, campaigns, inbox, signals, billing).

Ele nao substitui o produto atual. Ele orquestra as capacidades existentes para entregar resultado final:

- gerar pipeline qualificado
- conduzir follow-up multicanal
- responder com contexto
- escalar para humano no momento certo

Posicionamento:

- antes: "eu te dou ferramentas para prospectar"
- depois: "eu prospecto para voce com governanca"

## 1.1 North Star Metric

Metrica-mae do produto:

- meetings qualificadas geradas por mes com minima intervencao humana

Decisoes de produto, engenharia, operacao e pricing devem otimizar essa metrica.

## 2) O problema que resolve

Hoje, mesmo com boas ferramentas, o usuario ainda precisa decidir manualmente:

- onde buscar leads
- quanto volume capturar
- qual canal usar
- quando pausar ou acelerar
- quem vale follow-up
- quando passar para um humano

O agente resolve a camada de decisao continua, mantendo controle por politicas.

## 3) O que esse produto vai ter

## 3.1 Agent Brain (camada de decisao)

- Goal Manager: metas por organizacao (ex.: reunioes, replies, leads qualificados)
- Policy Engine: limites de volume, seguranca, compliance, plano/quotas
- Planner: escolhe proxima acao com base em sinais e estado atual
- Evaluator: mede resultado por ciclo e ajusta estrategia

## 3.2 Agent Memory

- Memoria curta: contexto da execucao atual e conversa recente
- Memoria longa: historico por segmento, canal, horario, objecoes e outcomes
- Memoria de decisoes: trilha auditavel de "o que foi decidido e por que"

## 3.3 Agent Actions (ferramentas operacionais)

Ferramentas que o agente vai usar no Lastreia:

- descobrir leads: lead pool + scraping jobs
- enriquecer e priorizar: enrichment + scoring + signals recommendation
- executar campanha: create/launch/pause/resume
- operar inbox: ler thread, classificar intencao, responder
- gerir capacidade: billing usage + regras de limite
- observar saude: ops/workers/errors/alerts

## 3.4 Conversa e qualificacao

O agente deve:

- classificar intencao (curioso, fit, nao fit, quer demo, objecao)
- responder com contexto do historico do lead e da campanha
- propor proximo passo (call, demo, proposta)
- escalar para humano em casos de maior risco/comercial

## 3.5 Human Handoff (escalonamento)

Triggers minimos para handoff:

- interesse comercial explicito (pedido de demo/proposta)
- objecao complexa (preco, seguranca, juridico, procurement)
- negociacao fora da politica do agente
- baixa confianca de resposta em conversa sensivel

## 4) Fluxo operacional alvo

Fluxo macro:

1. Definir objetivo por ICP
2. Captar/claim de leads (lead pool + scraping)
3. Enriquecer e priorizar
4. Gerar e executar sequencias
5. Monitorar inbox e responder
6. Fazer follow-up inteligente
7. Escalar para humano quando necessario
8. Aprender com resultado e recalibrar

Loop continuo do agente:

- SENSE: ler dados (signals, inbox, campanha, quotas)
- THINK: decidir melhor proxima acao
- ACT: executar acoes permitidas
- CHECK: medir impacto e ajustar

## 5) Guardrails obrigatorios

## 5.1 Seguranca e governanca

- sem exposicao de segredos em payload de resposta
- RBAC estrito para acoes sensiveis
- auditoria de toda decisao automatica
- idempotencia para evitar duplicidade de acao

## 5.2 Limites operacionais

- respeitar quotas de plano e overage
- limitar taxa de envio por canal/reputacao
- pausar automaticamente ao detectar risco (bounce/fail acima do limite)

## 5.3 Qualidade de automacao

- fallback para modo supervisionado quando confianca baixa
- proibido autopublish sem aprovacao humana para acoes criticas
- criterios claros de handoff para evitar falso positivo/falso negativo

## 5.4 Matriz de risco (MVP)

Acoes de baixo risco (autonomas no MVP):

- follow-up em thread existente
- variacao de copy previamente aprovada
- ajuste de horario/canal dentro da politica
- pause automatica de campanha por risco operacional

Acoes de alto risco (sempre supervisionadas):

- primeira mensagem outbound para novo lead
- mudanca de ICP ativo
- aumento brusco de volume/cadencia
- respostas comerciais sensiveis (preco, juridico, seguranca, procurement)

## 5.5 Modos do agente

Modos operacionais padrao:

- Assistido: agente sugere, humano aprova
- Supervisionado: agente executa acoes de baixo risco e escala excecoes
- Autonomo: agente opera ponta a ponta dentro de politicas e limites

Aplicacoes praticas:

- toggle de operacao na UI
- diferenciacao de planos por nivel de autonomia
- narrativa comercial clara na landing e no pitch

## 5.6 Matriz de modos por plano (proposta comercial v1)

| Plano | Modo padrao | Modos disponiveis | Politica operacional |
|---|---|---|---|
| Starter | Assistido | Assistido | 100% com aprovacao humana |
| Growth | Supervisionado | Assistido, Supervisionado | Autoexecucao apenas de baixo risco |
| Scale | Autonomo | Assistido, Supervisionado, Autonomo | Operacao continua com guardrails |
| Enterprise | Autonomo (custom) | Todos + politicas customizadas | Governanca avancada e regras customizadas |

Regras de comercializacao:

- upgrade para `Growth` libera execucao automatica de baixo risco
- upgrade para `Scale` libera modo autonomo dentro de politicas
- `Enterprise` adiciona customizacao de policy engine e handoff

## 6) Plano de desenvolvimento

Horizonte recomendado: 8 a 10 semanas

## Fase 0 - Preparacao (1 semana)

Objetivo: base segura para autonomia.

Entregas:

- consolidar contratos de acoes do agente (API action map)
- padronizar codigos de erro e payload de limite
- garantir trilha de auditoria de acoes
- definir politicas iniciais (canal, volume, handoff)

## Fase 1 - Agent Supervisor (2 semanas)

Objetivo: recomendar e orquestrar com aprovacao humana.

Entregas:

- modulo `agent` no backend (planner/evaluator)
- endpoint de `run` manual e `dry-run` com explicacao
- UI simples com "acoes recomendadas" e aprovacao em lote
- score de confianca por decisao

Resultado esperado:

- agente sugere acoes com justificativa, humano aprova execucao

## Fase 2 - Autonomia supervisionada (2 a 3 semanas)

Objetivo: executar automatico dentro de politicas.

Entregas:

- execucao automatica para acoes de baixo risco
- handoff automatico para casos comerciais complexos
- politicas por organizacao (limites, janelas, canais)
- monitor de seguranca de campanha (pause auto por risco)

Resultado esperado:

- agente ja opera outbound diario com intervencao humana pontual

## Fase 3 - Conversa e qualificacao avancada (2 semanas)

Objetivo: melhorar qualidade da conversa e qualificacao.

Entregas:

- classificador de intencao + objecao com feedback loop
- respostas contextuais multicanal com memoria da thread
- playbooks por segmento (fit, nao fit, demo, objecao)
- score de prontidao para handoff comercial

Resultado esperado:

- maior taxa de reply qualificado e menor tempo ate reuniao

## Fase 4 - Otimizacao e escala (1 a 2 semanas)

Objetivo: performance e previsibilidade em escala.

Entregas:

- experimentacao controlada (A/B por segmento/canal)
- otimizacao automatica de horario/canal por cohort
- dashboard executivo do agente (resultado + risco + custo)
- runbook operacional e alarmes de degradacao

Resultado esperado:

- operacao autonoma repetivel, com governanca e ROI claro

## 7) O que fica fora do escopo inicial

- negociacao comercial completa sem humano
- alteracao automatica de plano/billing sem autorizacao
- qualquer envio massivo sem controles de reputacao
- autopublish social sem aprovacao explicita

## 8) KPIs de sucesso

Produto:

- % de acoes executadas automaticamente sem erro
- tempo medio de ciclo SENSE->ACT
- taxa de handoff correto (precision/recall operacional)

Comercial:

- reply rate qualificado
- reunioes agendadas por 1000 leads trabalhados
- tempo medio ate primeira resposta qualificada

Risco e operacao:

- taxa de pause automatico por risco
- incidentes de limite/quota
- taxa de retrabalho humano por decisao ruim do agente

## 9) Criterios de pronto (DoD)

Para considerar o SDR Autonomo em producao:

- modulo de agente executando com auditoria completa
- politicas de limite/handoff ativas por organizacao
- dashboard de monitoramento operacional disponivel
- E2E cobrindo: captura -> campanha -> inbox -> handoff
- rollback claro para modo supervisionado

## 10) Proximos passos imediatos

1. Aprovar este escopo funcional e fases.
2. Definir quais acoes entram no MVP automatico (baixo risco).
3. Criar backlog tecnico da Fase 0/Fase 1 com owners e prazos.
4. Iniciar implementacao do modulo `backend/src/modules/agent/`.

## 11) Status de implementacao (2026-02-24)

Status geral:

- fases 0, 1, 2, 3 e 4 implementadas no produto (escopo deste plano)

Base entregue no produto:

- modulo `agent` no backend com config, runs, decisions, handoffs e auditoria
- North Star Metric aplicada em configuracao, policy e summary
- matriz de risco explicita (baixo risco vs alto risco) e modos `Assistido/Supervisionado/Autonomo`
- autoexecucao de baixo risco por plano/modo
- handoff humano com fila, resolucao manual e fechamento automatico apos execucao/rejeicao
- worker de ciclo automatico (`agent`) rodando periodicamente com controle de quota diaria
- policy/summary APIs para operacao e monitoramento
- classificador de intencao + objecao com feedback loop operacional
- respostas contextuais multicanal com memoria da thread e playbook por segmento
- score de prontidao para handoff comercial por conversa
- experimentacao controlada A/B por segmento/canal em replies contextuais
- otimizacao por cohort (canal/janela) com recomendacao automatica
- dashboard executivo do agente (resultado, risco, custo)
- alarmes de degradacao operacionais (queda de reply rate, falhas, pausas de guardrail)
- tela frontend `/settings/agent` com:
  - configuracao de modo e meta North Star
  - guardrails de risco por organizacao
  - matriz de risco e modos operacionais
  - operacao manual (`dry-run`, `run`, `auto-cycle`)
  - aprovacao/rejeicao de decisoes com override de payload
  - fila de handoff e painel de performance/falhas
  - painel de conversa/qualificacao avancada com feedback loop
  - painel de experimentos A/B e otimizacao por cohort
  - dashboard executivo e alertas de degradacao

Endpoints principais entregues:

- `GET /api/agent/policy`
- `GET /api/agent/catalog`
- `GET /api/agent/config`
- `PUT /api/agent/config`
- `GET /api/agent/summary`
- `GET /api/agent/conversations`
- `POST /api/agent/conversations/:messageId/feedback`
- `GET /api/agent/optimization`
- `POST /api/agent/runs/dry-run`
- `POST /api/agent/runs`
- `POST /api/agent/runs/auto-cycle`
- `GET /api/agent/runs`
- `GET /api/agent/runs/:runId`
- `POST /api/agent/runs/:runId/execute-approved`
- `POST /api/agent/decisions/:decisionId/approve`
- `POST /api/agent/decisions/:decisionId/reject`
- `GET /api/agent/handoffs`
- `PATCH /api/agent/handoffs/:handoffId/resolve`
