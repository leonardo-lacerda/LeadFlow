# 🚀 Leadflow

> **B2B Prospecting SaaS Platform**  
> Scraping + Enriquecimento + IA + Outbound Automation (Email + WhatsApp)

## 📋 Sobre o Projeto

Leadflow é uma plataforma SaaS completa para prospecção B2B que automatiza todo o ciclo de vendas outbound:

```
Descoberta → Enriquecimento → Qualificação (IA) → Outreach Automatizado → Métricas
```

### Principais Funcionalidades

- 🕷️ **Scraping Massivo** - 100+ fontes de dados (Google Maps, CNPJ, LinkedIn, etc.)
- 📧 **Email Outbound** - Sequências automatizadas com tracking
- 💬 **WhatsApp Outbound** - Integração com Evolution API
- 🤖 **IA Integrada** - Lead scoring, geração de mensagens, análise de respostas
- 📊 **Dashboard Completo** - Métricas, funil, inbox unificado
- 👥 **Multi-tenant** - Suporte para múltiplas organizações

## 🏗️ Arquitetura

```
Leadflow/
├── backend/          # Node.js + Fastify + Prisma
├── frontend/         # Next.js 14 + TailwindCSS (em breve)
├── services/         # Python Microservices (em breve)
│   ├── scraping/     # Scraping engine
│   ├── enrichment/   # Data enrichment
│   └── ai/           # AI engine
└── docker-compose.yml
```

## 🚀 Quick Start

### Pré-requisitos

- Docker e Docker Compose
- Node.js 20+ (para desenvolvimento local)

### Iniciar com Docker

```bash
# Clone o repositório
git clone <repo-url>
cd SDR

# Inicie todos os serviços
docker-compose up -d

# Acesse
# Backend API: http://localhost:4000
# Enrichment Service: http://localhost:5002
# Evolution API: http://localhost:8080
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Desenvolvimento Local

```bash
# Backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 📚 Documentação

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Plano completo de desenvolvimento
- [Lead Sources](./LEAD_SOURCES.md) - 100+ fontes de scraping
- [Backend README](./backend/README.md) - Documentação da API

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Auth**: JWT

### Frontend (Em desenvolvimento)
- **Framework**: Next.js 14
- **Styling**: TailwindCSS + shadcn/ui
- **State**: Zustand
- **Data Fetching**: React Query

### Microservices Python
- **Framework**: FastAPI
- **Scraping**: Playwright + Crawlee
- **AI**: OpenAI/Claude APIs

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Production**: Vercel (frontend) + Railway (backend)
- **WhatsApp**: Evolution API

## 📝 Status do Desenvolvimento

### ✅ Completo (Semana 1-3)
- [x] Setup do projeto backend
- [x] Docker Compose environment
- [x] Prisma schema completo
- [x] Autenticação (Register + Login + JWT)
- [x] Multi-tenant com organizations
- [x] Módulo de Leads (CRUD completo)
- [x] Filtros, paginação, busca

### 🚧 Em Andamento
- [ ] Scraping services (Python)
- [ ] Enrichment pipeline
- [ ] Email outbound engine
- [ ] WhatsApp outbound
- [ ] AI engine
- [ ] Frontend (Next.js)

### 📅 Próximos Passos
- Semana 4-5: Scraping + Enrichment
- Semana 6-8: Email + WhatsApp Outbound
- Semana 8-10: AI Engine
- Semana 10-12: Frontend

## 🔑 API Endpoints

### Auth
```
POST   /api/auth/register    # Criar conta
POST   /api/auth/login       # Login
GET    /api/auth/me          # Usuário atual
```

### Leads
```
POST   /api/leads            # Criar lead
GET    /api/leads            # Listar leads
GET    /api/leads/:id        # Detalhes do lead
PATCH  /api/leads/:id        # Atualizar lead
DELETE /api/leads/:id        # Deletar lead
```

### Email
```
POST   /api/email/mailboxes        # Adicionar mailbox
GET    /api/email/mailboxes        # Listar mailboxes
POST   /api/email/mailboxes/:id/test   # Testar conexões SMTP/IMAP
POST   /api/email/send             # Enviar emails
GET    /api/email/track/open       # Tracking pixel
GET    /api/email/track/click      # Click tracking
GET    /api/email/unsubscribe      # Unsubscribe link
POST   /api/email/webhook/bounce   # Bounce handler
POST   /api/email/webhook/complaint # Spam complaint handler
```

### Enrichment
```
POST   /api/enrichment/jobs        # Criar job de enrichment
GET    /api/enrichment/jobs        # Listar jobs
GET    /api/enrichment/jobs/:id    # Detalhes do job
POST   /api/enrichment/webhook     # Callback do serviço de enrichment
```

## 🧪 Testes

```bash
# Health check
curl http://localhost:4000/health

# Register (criar primeira conta)
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@leadflow.com",
    "name": "Admin",
    "password": "password123",
    "organizationName": "Leadflow Inc"
  }'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@leadflow.com",
    "password": "password123"
  }'
```

## 📊 Roadmap

- **v0.1** (Atual): Backend Core + Auth + Leads
- **v0.2**: Scraping Engine + Enrichment
- **v0.3**: Email Outbound
- **v0.4**: WhatsApp Outbound
- **v0.5**: AI Engine
- **v1.0**: Frontend MVP + Dashboard

## 🤝 Contribuindo

Este é um projeto em desenvolvimento ativo. Contribuições serão bem-vindas em breve.

## 📄 Licença

ISC

---

Desenvolvido com ❤️ usando IA
