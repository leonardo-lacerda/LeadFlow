# Security Hardening Checklist (Lastreia)

Ultima atualizacao: 2026-02-22

Este arquivo e a lista unica de pendencias de seguranca para producao.

## Estado real (2026-02-22)

- Codigo de hardening de P1/P2/P3 foi deployado em producao e validado com testes E2E em `2026-02-22`.
- Firewall cloud do DigitalOcean esta ativo; `8080` fechado publicamente.
- API publica agora roda em HTTPS dedicado via `https://api.lastreia.app` (Caddy + TLS).
- Porta `4000` foi fechada para acesso externo (bind local + regra removida no firewall cloud).

## Prioridade P0 (0-48h)

- [x] Colocar a API em HTTPS (`https://api.lastreia.app`) e remover trafego HTTP publico da API.
  - Status real: `api.lastreia.app` resolve para `161.35.99.112` e TLS valido emitido em 2026-02-22.
  - Validacao funcional: `https://api.lastreia.app/health` retorna `200`.
  - Observacao operacional: alias `api.lastreia.app` foi removido da Vercel para evitar loop de rewrite.
  - Status de codigo: Caddy em producao com dominio configuravel por `API_PROXY_DOMAIN`.
- [x] Fechar exposicao publica da porta `4000`.
  - Status real: fechada em 2026-02-22 (`http://161.35.99.112:4000/health` nao responde externamente).
  - Status de codigo: compose com bind parametrizado por ambiente (`BACKEND_BIND_IP`).
  - Status de producao atual: `BACKEND_BIND_IP=127.0.0.1`.
  - Validacao 2026-02-22: `lastreia.app/api/*` funcional via rewrite HTTPS para `api.lastreia.app`.
- [x] Fechar exposicao publica da porta `8080` (Evolution API/Manager).
  - Status real: fechada em 2026-02-22 com firewall cloud DigitalOcean.
  - Firewall ID: `689b5909-f7bf-48c4-a5de-545ecf347230`.
- [x] Criar e aplicar firewall no DigitalOcean (inbound minimo).
  - Status real: aplicado e ativo.
  - Regras atuais inbound: `22`, `80`, `443` (portas `4000` e `8080` fora do inbound).

## Prioridade P1 (0-7 dias)

- [x] Migrar autenticacao no frontend de `localStorage` para cookie `HttpOnly + Secure + SameSite`.
  - Arquivos relacionados:
    - `frontend/store/auth-store.ts`
    - `frontend/lib/api.ts`
  - Validacao de producao (2026-02-22): `Set-Cookie` presente com `HttpOnly; Secure; SameSite=Lax` em login/register.
- [x] Mitigar XSS no editor/preview de templates.
  - Aplicar sanitizacao de HTML antes de renderizar (`DOMPurify` ou equivalente).
  - Arquivo relacionado: `frontend/components/campaigns/template-editor.tsx`
- [x] Adicionar rate limit e anti-brute-force nos endpoints de auth.
  - Endpoints alvo:
    - `/api/auth/login`
    - `/api/auth/register`
    - `/api/auth/forgot-password`
    - `/api/auth/reset-password`
  - Arquivo relacionado: `backend/src/modules/auth/auth.routes.ts`
  - Validacao de producao (2026-02-22): lockout ativo apos excesso de tentativas (`Too many login attempts...`).
- [x] Adicionar hardening HTTP headers no backend (Helmet equivalente para Fastify).
  - Arquivo relacionado: `backend/src/index.ts`
- [x] Restringir endpoints operacionais para `ADMIN/OWNER`.
  - Alvo:
    - `/api/ops/*`
    - `/api/inbox/followups/recalculate`
  - Arquivos relacionados:
    - `backend/src/modules/ops/ops.routes.ts`
    - `backend/src/modules/inbox/inbox.routes.ts`
  - Validacao de producao (2026-02-22): perfil `MEMBER` recebe `403` em `/api/ops/summary` e `/api/inbox/followups/recalculate`.

## Prioridade P2 (7-14 dias)

- [x] Corrigir politica de `webhookUrl` controlada por usuario (risco SSRF e exfiltracao de segredo).
  - Exigir allowlist de dominios para webhook customizado.
  - Bloquear destinos internos/metadata e RFC1918.
  - Nao enviar segredo para URL nao confiavel.
  - Arquivos relacionados:
    - `backend/src/modules/scraping/scraping.routes.ts`
    - `backend/src/modules/enrichment/enrichment.routes.ts`
    - `backend/src/modules/ai/ai.routes.ts`
    - `backend/src/jobs/scraping.worker.ts`
    - `backend/src/jobs/enrichment.worker.ts`
    - `backend/src/jobs/ai.worker.ts`
    - `services/scraping/main.py`
    - `services/enrichment/main.py`
    - `services/ai/main.py`
  - Validacao de producao (2026-02-22): webhook customizado externo bloqueado (`webhookUrl is not allowed...`).
- [x] Atualizar dependencias com CVEs em producao (backend e frontend).
  - Backend:
    - `fastify`
    - `@fastify/jwt` / `fast-jwt`
    - `nodemailer`
  - Frontend:
    - `xlsx` (substituido por `read-excel-file`)
    - `exceljs` removido (nao utilizado no codigo)
    - `react-quill-new` / `quill`
  - Arquivos relacionados:
    - `backend/package.json`
    - `frontend/package.json`
  - Resultado da auditoria (`npm audit --omit=dev`) em 2026-02-22:
    - backend: `0 High / 0 Critical` (restam `4 Moderate` sem fix disponivel no ecossistema atual do `@fastify/jwt`)
    - frontend: `0 High / 0 Critical` (restam `2 Low` no `quill` via `react-quill-new`)

## Prioridade P3 (14-30 dias)

- [x] Implementar revogacao de sessao/token (nao depender apenas de expiracao JWT).
  - Opcoes:
    - token version por usuario
    - denylist/blacklist de token
    - sessao server-side com refresh token rotativo
  - Arquivos relacionados:
    - `backend/src/middlewares/auth.ts`
    - `backend/src/modules/auth/auth.routes.ts`
    - `backend/src/modules/auth/auth.service.ts`
  - Validacao de producao (2026-02-22): token invalido apos `POST /api/auth/logout` (mesmo token retorna `401` em `/api/auth/me`).
- [x] Fortalecer endpoints de tracking/open/unsubscribe com assinatura.
  - Hoje so click tracking esta assinado.
  - Arquivos relacionados:
    - `backend/src/modules/email/email.routes.ts`
    - `backend/src/modules/email/email.utils.ts`
- [x] Tornar `SECRETS_ENCRYPTION_KEY` estritamente obrigatoria em producao e falhar fechado em decrypt invalido.
  - Arquivo relacionado: `backend/src/lib/secrets.ts`

## Validacao tecnica apos mudancas

- [x] `https://lastreia.app` abre normalmente.
- [x] `https://lastreia.app/api/...` funciona via proxy HTTPS para API.
- [x] `https://api.lastreia.app/health` responde `200`.
- [x] `https://api.161.35.99.112.nip.io/health` responde `200`.
- [x] `http://161.35.99.112:4000` nao acessa publicamente.
- [x] `http://161.35.99.112:8080` nao acessa publicamente.
- [x] Login funciona com novo modelo de sessao.
- [x] Rate limit e anti-brute-force bloqueiam tentativas abusivas de auth.
- [x] Endpoints `/api/ops/*` negam acesso para perfis nao admin.
- [x] Endpoint `/api/inbox/followups/recalculate` nega acesso para perfil nao admin.
- [x] Webhooks customizados aceitam apenas dominios permitidos.
- [x] Teste de SQL injection em busca de leads nao causou bypass/erro (`search=%27%20OR%201%3D1%20--` retornou resposta normal).
- [x] Revisao de codigo sem uso de `queryRawUnsafe`/`executeRawUnsafe`.
- [x] `npm audit --omit=dev` sem vulnerabilidades High/Critical em producao (ou com excecoes documentadas).

## Registro de execucao

Preencher conforme avancar:

- [x] P0 concluido em producao (validado em 2026-02-22)
- [x] P1 concluido em producao (validado em 2026-02-22)
- [x] P2 concluido em producao (validado em 2026-02-22)
- [x] P3 concluido em producao (validacao funcional executada em 2026-02-22)
