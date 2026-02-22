# Auditoria Tecnica Completa - Lastreia

Data da auditoria: 2026-02-11

## Escopo

- Backend (`backend/src`, `backend/prisma`)
- Frontend (`frontend/app`, `frontend/components`, `frontend/lib`, `frontend/store`)
- Servicos Python (`services/scraping`, `services/enrichment`, `services/ai`)
- Infra local (`docker-compose.yml`)

## Metodologia

- Varredura estatica com `rg` para:
  - TODO/FIXME, `as any`, gaps de autorizacao
  - exposicao de segredos
  - inconsistencias de fluxo
- Validacoes automatizadas:
  - `backend`: `npm run lint`, `npm run build`
  - `frontend`: `npm run lint`, `npm run build`
  - `services/*`: `python -m py_compile` em todos os `.py`
- Revisao manual de arquivos criticos:
  - autenticacao/autorizacao
  - rotas de webhook
  - armazenamento e retorno de credenciais
  - onboarding e fluxo de sessao
  - qualidade de dados e idempotencia em jobs

## Resultado executivo

- Critico: 4
- Alto: 8
- Medio: 10
- Baixo: 3
- Total: 25 pontos

## Status dos checks

- Backend lint: passou com 14 warnings (todos `no-explicit-any`)
- Backend build: passou
- Frontend lint: falhou com 4 erros e 6 warnings
- Frontend build: passou
- Python compile (`scraping`, `enrichment`, `ai`): passou

## Achados detalhados

### C-01 - Credenciais SMTP/IMAP expostas via API
- Severidade: Critica
- Status: Funciona, mas com risco alto de vazamento
- Evidencia:
  - `backend/src/modules/email/email.service.ts:100`
  - `backend/src/modules/email/email.service.ts:104`
  - `backend/src/modules/email/email.routes.ts:80`
  - `backend/src/modules/email/email.routes.ts:110`
- Impacto:
  - `smtpPass` e `imapPass` podem sair no payload de resposta da API.
  - Compromete contas de envio e reputacao de dominio.
- Recomendacao:
  - Nunca retornar campos sensiveis em `create/list/get`.
  - Criar DTO de saida sem segredos.
  - Criptografar segredos em repouso e mascarar no frontend.

### C-02 - Token interno do WhatsApp exposto via API
- Severidade: Critica
- Status: Funciona, mas com risco alto de sequestro de instancia
- Evidencia:
  - `backend/src/modules/whatsapp/whatsapp.service.ts:159`
  - `backend/src/modules/whatsapp/whatsapp.service.ts:170`
  - `backend/src/modules/whatsapp/whatsapp.service.ts:182`
  - `backend/src/modules/whatsapp/whatsapp.routes.ts:67`
  - `backend/src/modules/whatsapp/whatsapp.routes.ts:97`
- Impacto:
  - `instanceToken` pode ser retornado para cliente.
  - Permite abuso de envio e controle indevido da instancia.
- Recomendacao:
  - Remover `instanceToken` de qualquer resposta publica.
  - Usar `select` estrito no Prisma para rotas externas.

### C-03 - RBAC incompleto em organizacao (convite/remocao)
- Severidade: Critica
- Status: Quebrado em seguranca de autorizacao
- Evidencia:
  - `backend/src/modules/organization/organization.routes.ts:79`
  - `backend/src/modules/organization/organization.routes.ts:104`
- Impacto:
  - Qualquer usuario autenticado da org pode convidar/remover membros.
  - Escalada horizontal de privilegio.
- Recomendacao:
  - Exigir `OWNER`/`ADMIN` no backend (nao apenas no frontend).
  - Bloquear remocao de owner por membros nao autorizados.

### C-04 - Convite cria senha padrao fixa e resposta pode incluir hash
- Severidade: Critica
- Status: Quebrado em seguranca de identidade
- Evidencia:
  - `backend/src/modules/organization/organization.service.ts:69`
  - `backend/src/modules/organization/organization.service.ts:72`
  - `backend/src/modules/organization/organization.routes.ts:83`
- Impacto:
  - Conta criada com senha previsivel (`ChangeMe123!`).
  - Risco de acesso indevido antes da troca de senha.
  - Possivel vazamento de `passwordHash` no retorno de `user.create`.
- Recomendacao:
  - Implementar fluxo de convite com token temporario.
  - Forcar definicao de senha no primeiro acesso.
  - Nunca retornar `passwordHash`.

### H-01 - Dados sensiveis da organizacao retornados para qualquer usuario autenticado
- Severidade: Alta
- Status: Funciona, mas com exposicao desnecessaria
- Evidencia:
  - `backend/src/modules/organization/organization.service.ts:20`
  - `backend/src/modules/organization/organization.service.ts:23`
  - `backend/prisma/schema.prisma:37`
  - `backend/prisma/schema.prisma:38`
- Impacto:
  - `apiKeys`, `webhooks`, settings e metadados podem vazar para usuarios sem necessidade.
- Recomendacao:
  - Definir DTO por perfil (OWNER/ADMIN/MEMBER).
  - Retornar somente campos minimos por endpoint.

### H-02 - Login inclui objeto `organization` completo
- Severidade: Alta
- Status: Funciona, mas amplia superficie de exposicao
- Evidencia:
  - `backend/src/modules/auth/auth.service.ts:69`
  - `backend/src/modules/auth/auth.service.ts:70`
  - `backend/src/modules/auth/auth.service.ts:88`
- Impacto:
  - Qualquer login recebe dados amplos de org, incluindo potenciais segredos.
- Recomendacao:
  - Usar `select` minimo no login.
  - Buscar dados adicionais em endpoint dedicado com RBAC.

### H-03 - Segredos armazenados em texto plano (inconsistente com schema)
- Severidade: Alta
- Status: Funciona, mas falha requisito de seguranca
- Evidencia:
  - `backend/prisma/schema.prisma:546`
  - `backend/prisma/schema.prisma:552`
  - `backend/src/modules/email/email.service.ts:100`
  - `backend/src/modules/email/email.service.ts:104`
- Impacto:
  - Credenciais vazam em dump de banco/log/acesso interno.
- Recomendacao:
  - Criptografar segredos em repouso (KMS/chave de app).
  - Rotacionar credenciais existentes apos migracao.

### H-04 - Webhooks de email (bounce/complaint) sem autenticacao
- Severidade: Alta
- Status: Quebrado em confianca de eventos
- Evidencia:
  - `backend/src/modules/email/email.routes.ts:260`
  - `backend/src/modules/email/email.routes.ts:273`
  - Comparativo: `backend/src/modules/whatsapp/whatsapp.routes.ts:209`, `backend/src/modules/scraping/scraping.routes.ts:219`, `backend/src/modules/enrichment/enrichment.routes.ts:114`, `backend/src/modules/ai/ai.routes.ts:258`
- Impacto:
  - Evento forjado pode marcar mensagens/lead como bounce/unsubscribed.
- Recomendacao:
  - Exigir assinatura/HMAC ou segredo por provedor.
  - Validar origem e replay protection.

### H-05 - Open redirect em tracking de click
- Severidade: Alta
- Status: Funciona, mas vulneravel a abuso
- Evidencia:
  - `backend/src/modules/email/email.routes.ts:227`
  - `backend/src/modules/email/email.routes.ts:231`
  - `backend/src/modules/email/email.routes.ts:238`
- Impacto:
  - Pode ser usado para phishing e reputacao negativa de dominio.
- Recomendacao:
  - Validar allowlist de dominios/URL.
  - Assinar parametro `url` com token.

### H-06 - Falta de idempotencia em webhook de scraping (duplicacao de leads)
- Severidade: Alta
- Status: Funciona, mas degrada dados rapidamente
- Evidencia:
  - `backend/src/modules/scraping/scraping.service.ts:300`
  - `backend/src/modules/scraping/scraping.service.ts:301`
  - `backend/src/modules/scraping/scraping.service.ts:310`
- Impacto:
  - Reenvio de webhook gera duplicatas e metricas infladas.
- Recomendacao:
  - Adicionar chave de dedupe (ex.: `organizationId+source+sourceUrl+email`).
  - Registrar idempotency key do webhook.

### H-07 - Idempotencia fraca no enrichment (contador de uso pode inflar)
- Severidade: Alta
- Status: Funciona, mas pode cobrar/contar em duplicidade
- Evidencia:
  - `backend/src/modules/enrichment/enrichment.service.ts:271`
  - `backend/src/modules/enrichment/enrichment.service.ts:499`
  - `backend/src/modules/enrichment/enrichment.service.ts:502`
- Impacto:
  - `enrichmentsUsed` pode ser incrementado em reprocessamentos.
- Recomendacao:
  - Tornar processamento por lead+job idempotente.
  - Persistir estado de itens ja aplicados.

### H-08 - `leadsLimit` existe no dominio, mas nao e aplicado na criacao de leads
- Severidade: Alta
- Status: Gap funcional de regras de plano
- Evidencia:
  - `backend/prisma/schema.prisma` (campos `leadsLimit`, `leadsUsed`)
  - `backend/src/modules/leads/leads.service.ts:50`
  - `backend/src/modules/leads/leads.service.ts:73`
  - `backend/src/modules/email/email.service.ts:216` (exemplo de limite aplicado em outro modulo)
- Impacto:
  - Cliente pode ultrapassar limites de plano sem bloqueio.
- Recomendacao:
  - Validar quota antes de `create` e `bulkCreate`.
  - Incrementar `leadsUsed` de forma transacional.

### M-01 - Frontend lint quebrado (4 erros)
- Severidade: Media
- Status: Quebrado em qualidade de codigo
- Evidencia (saida do lint):
  - `frontend/app/inbox/page.tsx:52`
  - `frontend/components/layout/protected-route.tsx:13`
  - `frontend/components/settings/integrations/mailbox-list.tsx:66`
  - `frontend/components/settings/integrations/whatsapp-list.tsx:60`
- Impacto:
  - Regressao potencial em renderizacao e manutencao.
- Recomendacao:
  - Corrigir erros e manter CI bloqueando merge com lint vermelho.

### M-02 - Estado de sessao parcial no frontend (token persiste, usuario nao)
- Severidade: Media
- Status: Funciona, mas com comportamento inconsistente
- Evidencia:
  - `frontend/store/auth-store.ts:26`
  - `frontend/store/auth-store.ts:27`
  - `frontend/lib/api.ts:9`
- Impacto:
  - Apos refresh, tela pode ficar sem contexto de usuario/org.
  - Fluxos dependentes de `user` podem falhar silenciosamente.
- Recomendacao:
  - Hidratar usuario via `/auth/me` no bootstrap.
  - Persistir dados minimos de sessao com estrategia segura.

### M-03 - Fluxo de onboarding dependente de store local (facil ficar divergente)
- Severidade: Media
- Status: Funciona, mas fragil
- Evidencia:
  - `frontend/components/layout/app-layout.tsx:32`
  - `frontend/components/layout/app-layout.tsx:34`
  - `frontend/app/onboarding/page.tsx:73`
- Impacto:
  - Redirecionamento pode divergir apos refresh/estado incompleto.
- Recomendacao:
  - Basear gating em estado do backend (`/auth/me` ou `/organization`), nao so store local.

### M-04 - Regra de senha inconsistente entre frontend e backend
- Severidade: Media
- Status: Quebrado em UX/validacao
- Evidencia:
  - `backend/src/modules/auth/auth.routes.ts:8` (min 8)
  - `frontend/app/register/page.tsx:27` (min 6)
  - `frontend/app/login/page.tsx:25` (min 6)
- Impacto:
  - Usuario passa no frontend e falha no backend.
- Recomendacao:
  - Compartilhar schema de validacao ou alinhar regras.

### M-05 - Tela de "esqueci senha" chama endpoint inexistente
- Severidade: Media
- Status: Gap funcional
- Evidencia:
  - `frontend/app/forgot-password/page.tsx:40`
  - Rotas de auth existentes: `backend/src/modules/auth/auth.routes.ts:19`, `backend/src/modules/auth/auth.routes.ts:47`, `backend/src/modules/auth/auth.routes.ts:75`
- Impacto:
  - Fluxo aparenta funcionar, mas nao existe backend para reset real.
- Recomendacao:
  - Implementar `/auth/forgot-password` e `/auth/reset-password` com token e expiracao.

### M-06 - Textos com codificacao quebrada (mojibake) no frontend
- Severidade: Media
- Status: Problema visual/UX
- Evidencia:
  - `frontend/app/onboarding/page.tsx:81`
  - `frontend/app/onboarding/page.tsx:101`
  - `frontend/components/settings/integrations/whatsapp-list.tsx:71`
  - `frontend/app/register/page.tsx:83`
  - `frontend/app/login/page.tsx:24`
- Impacto:
  - UI com portugues corrompido (ex.: `InstÃ¢ncia`, `ConfiguraÃ§Ã£o`).
- Recomendacao:
  - Padronizar UTF-8 sem BOM em todos os arquivos.
  - Revisar pipeline/editor que gerou recodificacao.

### M-07 - Warnings de dependencias de hook nao resolvidos
- Severidade: Media
- Status: Funciona, mas com risco de stale state
- Evidencia (saida do lint):
  - `frontend/app/settings/organization/page.tsx:22`
  - `frontend/app/settings/team/page.tsx:53`
- Impacto:
  - Possiveis estados stale e bugs intermitentes.
- Recomendacao:
  - Corrigir dependencias de `useEffect` (useCallback ou mover funcoes).

### M-08 - Acoes importantes da tela de Leads ainda sao placeholders
- Severidade: Media
- Status: Parcialmente implementado
- Evidencia:
  - `frontend/app/leads/page.tsx:63`
  - `frontend/app/leads/page.tsx:67`
  - `frontend/app/leads/page.tsx:139`
  - `frontend/app/leads/page.tsx:140`
  - `frontend/app/leads/page.tsx:143`
- Impacto:
  - Usuario clica em acoes chave sem efeito real.
- Recomendacao:
  - Ligar botoes a rotas/modais reais (exportar, criar, editar, excluir, detalhe).

### M-09 - Falta timeout explicito nas chamadas internas entre servicos
- Severidade: Media
- Status: Funciona, mas com risco operacional
- Evidencia:
  - `backend/src/jobs/scraping.worker.ts:94`
  - `backend/src/jobs/enrichment.worker.ts:116`
  - `backend/src/jobs/ai.worker.ts:118`
  - `backend/src/modules/ai/ai.routes.ts:105`
  - `backend/src/modules/whatsapp/whatsapp.service.ts:64`
  - Busca sem resultados para timeout/abort: `AbortController|timeout`
- Impacto:
  - Requisicoes penduradas podem travar worker e degradar fila.
- Recomendacao:
  - Adicionar timeout com `AbortController` e politica de retry/circuit breaker.

### M-10 - Ausencia de suite de testes automatizados do produto
- Severidade: Media
- Status: Gap de confiabilidade
- Evidencia:
  - Sem script `test` em `backend/package.json` e `frontend/package.json`
  - Sem arquivos de teste no codigo fonte (`backend/src`, `frontend`, `services`)
- Impacto:
  - Regressao passa despercebida em features criticas.
- Recomendacao:
  - Priorizar testes de contrato para rotas criticas e testes de fluxo frontend.

### L-01 - Endpoint `/health` nao muda status HTTP em falha
- Severidade: Baixa
- Status: Funciona, mas monitoramento fica cego
- Evidencia:
  - `backend/src/index.ts:63`
  - `backend/src/index.ts:75`
- Impacto:
  - Orquestrador pode considerar servico saudavel mesmo em erro interno.
- Recomendacao:
  - Retornar `503` em erro de DB/Redis.

### L-02 - Workers iniciam junto com API (risco ao escalar horizontalmente)
- Severidade: Baixa
- Status: Funciona em ambiente simples, fragil em escala
- Evidencia:
  - `backend/src/index.ts:97`
  - `backend/src/index.ts:106`
- Impacto:
  - Multiplicar replicas da API pode duplicar processamento de jobs.
- Recomendacao:
  - Separar processo de worker do processo HTTP.

### L-03 - Segredos padrao e placeholders em `docker-compose`
- Severidade: Baixa
- Status: Aceitavel para dev, perigoso se reaproveitado em prod
- Evidencia:
  - `docker-compose.yml:11`
  - `docker-compose.yml:75`
  - `docker-compose.yml:76`
  - `docker-compose.yml:83`
  - `docker-compose.yml:90`
  - `docker-compose.yml:91`
- Impacto:
  - Erro operacional comum: subir ambiente com segredo fraco/default.
- Recomendacao:
  - Externalizar para `.env` obrigatorio e validar no startup.

## Recomendacao de priorizacao (ordem sugerida)

1. Bloquear vazamento de credenciais/tokens (`C-01`, `C-02`, `C-04`, `H-01`, `H-02`, `H-03`).
2. Fechar gaps de autorizacao (`C-03`) e autenticar webhooks de email (`H-04`).
3. Corrigir idempotencia e quotas (`H-06`, `H-07`, `H-08`).
4. Corrigir lint errors frontend e fluxos de autenticacao/onboarding (`M-01`, `M-02`, `M-03`, `M-04`, `M-05`).
5. Limpar UX textual/codificacao e completar acoes pendentes (`M-06`, `M-08`).
6. Melhorar operacao e engenharia de confiabilidade (`M-09`, `M-10`, `L-01`, `L-02`).
