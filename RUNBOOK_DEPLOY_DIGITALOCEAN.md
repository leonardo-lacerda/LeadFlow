# Runbook: Deploy no DigitalOcean (Droplet)

Este documento registra o fluxo usado no deploy e como atualizar o projeto sem perder dados.

## Acesso a VPS (producao atual)

- Droplet Name: `lastreia-prod`
- IP operacional atual: `161.35.99.112`
- IP informado anteriormente: `64.227.8.88` (sem resposta em `22/tcp` na validacao de 2026-02-22)
- Usuario: `root`
- Senha atual de root: `7d6c011ffac69fd6a29c635a81`

Observacao operacional (2026-02-22): os deploys e testes desta execucao foram realizados no host `161.35.99.112` (SSH acessivel neste momento).

### Como acessar por SSH (recomendado: chave)

No Windows PowerShell:

```powershell
ssh -i C:\Users\Administrator\.ssh\lastreia_do root@161.35.99.112
```

No Linux/macOS:

```bash
ssh -i ~/.ssh/lastreia_do root@161.35.99.112
```

### Acesso por senha (fallback)

```bash
ssh root@161.35.99.112
```

Quando pedir autenticacao, inserir a senha de root acima.

## API HTTPS (estado atual)

- Proxy TLS ativo no container `lastreia-api-proxy` (Caddy).
- Endpoint HTTPS oficial da API: `https://api.lastreia.app`.
- Endpoint tecnico de contingencia: `https://api.161.35.99.112.nip.io`.
- Frontend Vercel (`lastreia.app`) reescreve `/api/*` para `https://api.lastreia.app/api/:path*`.
- Porta `4000` fechada externamente:
  - bind local: `BACKEND_BIND_IP=127.0.0.1`
  - firewall DigitalOcean sem regra inbound para `4000/tcp`

### DNS oficial aplicado (2026-02-22)

A zona DNS de `lastreia.app` esta em `name.com` (NS autoritativo). Registro aplicado:

- Registro desejado no DNS autoritativo: `A api.lastreia.app 161.35.99.112`
- Alias `api.lastreia.app` foi removido da Vercel para evitar loop de rewrite.
- `API_PROXY_DOMAIN=api.lastreia.app` no `.env` da VPS
- rewrite do frontend publicado para `https://api.lastreia.app/api/:path*`

## ALERTA CRITICO: protecao da DB (leia antes de qualquer deploy)

Se rodar comandos destrutivos, voce pode perder o banco de dados definitivamente.

### Nunca executar em producao

- `docker compose down -v`
- `docker volume rm ...`
- `docker system prune --volumes`
- apagar manualmente pastas em `/var/lib/docker/volumes/`

### Regras obrigatorias antes de atualizar

1. Fazer backup SQL.
2. Preservar `/opt/lastreia/.env` (nao sobrescrever).
3. Subir com `docker compose -f docker-compose.prod.yml up -d --build`.
4. Validar `GET /health` apos deploy.

## Resumo do que foi feito

Sim, no ultimo deploy foi usado o metodo de **bundle ZIP**:

1. Gerar um pacote do codigo local.
2. Enviar para o Droplet via `scp`.
3. Extrair em `/opt/lastreia`.
4. Subir/reconstruir containers com `docker compose -f docker-compose.prod.yml up -d --build`.

Motivo: o servidor nao tinha credenciais para clonar o repositorio privado no GitHub.

## Stack em producao

- Arquivo de stack: `docker-compose.prod.yml`
- Containers:
  - `lastreia-api-proxy`
  - `lastreia-backend`
  - `lastreia-scraping`
  - `lastreia-enrichment`
  - `lastreia-ai`
  - `lastreia-postgres`
  - `lastreia-redis`
  - `lastreia-evolution`
- Volumes persistentes:
  - `lastreia_caddy_data`
  - `lastreia_caddy_config`
  - `lastreia_postgres_data`
  - `lastreia_redis_data`
  - `lastreia_evolution_data`

## Pergunta critica: vou perder a DB ao subir mudancas?

**Nao, se voce atualizar corretamente.**

Atualizar imagem/container com `docker compose up -d --build` **nao apaga** o volume do Postgres.

Voce perde dados se fizer qualquer uma destas acoes:

- `docker compose down -v`
- `docker volume rm ...`
- apagar manualmente `/var/lib/docker/volumes/...`
- destruir e recriar o Droplet sem restaurar backup

## Regra de ouro para atualizacoes

- **Nunca** sobrescrever `/opt/lastreia/.env` em atualizacao.
- **Nunca** rodar `down -v` em producao.
- Fazer backup da DB antes de deploy com migracoes.

## Deploy inicial (uma vez)

No Droplet:

```bash
apt-get update
apt-get install -y docker.io git unzip rsync
systemctl enable --now docker
```

Copiar codigo e subir:

```bash
mkdir -p /opt/lastreia
# copiar arquivos (metodo zip abaixo)
cd /opt/lastreia
cp .env.example .env
# preencher segredos reais no .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -f http://127.0.0.1:4000/health
```

## Atualizacao por ZIP (metodo usado)

### 1) Na maquina local

Gerar pacote da branch atual:

```bash
git archive --format=zip -o deploy_bundle.zip HEAD
```

Enviar para o servidor:

```bash
scp -i ~/.ssh/lastreia_do deploy_bundle.zip root@SEU_IP:/root/deploy_bundle.zip
```

### 2) No Droplet

Extrair em pasta temporaria e sincronizar sem mexer no `.env`:

```bash
mkdir -p /opt/lastreia_new
rm -rf /opt/lastreia_new/*
unzip -o /root/deploy_bundle.zip -d /opt/lastreia_new
rsync -a --delete --exclude=".env" /opt/lastreia_new/ /opt/lastreia/
```

Rebuild/restart:

```bash
cd /opt/lastreia
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -f http://127.0.0.1:4000/health
```

## Backup e restore da DB

### Backup

```bash
mkdir -p /root/backups
docker exec -t lastreia-postgres pg_dump -U postgres -d lastreia | gzip > /root/backups/lastreia_$(date +%F_%H%M).sql.gz
```

### Restaurar

```bash
gunzip -c /root/backups/ARQUIVO.sql.gz | docker exec -i lastreia-postgres psql -U postgres -d lastreia
```

## Checklist de deploy seguro

1. Backup da DB gerado.
2. `.env` preservado (sem reset de segredos).
3. `docker compose up -d --build` executado.
4. `docker compose ps` sem containers em `exited`.
5. `GET /health` respondendo `status=ok`.

## Observacoes importantes

- Mudar `POSTGRES_PASSWORD` no `.env` depois da base criada pode quebrar conexao do backend.
- Migracoes Prisma podem alterar estrutura e, dependendo da migracao, impactar dados.
- Antes de migracoes grandes, fazer snapshot do Droplet + backup SQL.
