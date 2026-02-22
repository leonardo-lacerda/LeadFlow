# 🚀 Lastreia - Plano de Desenvolvimento

> **B2B Prospecting SaaS Platform**
> Scraping + Enriquecimento + IA + Outbound (Email + WhatsApp)

---

## 📋 Decisões Técnicas Finalizadas

| Decisão | Escolha |
|---------|---------|
| **Nome** | Lastreia |
| **Backend API** | Node.js + Fastify |
| **Scraping Services** | Python (microservices) |
| **Frontend** | Next.js 14 + TailwindCSS |
| **Database** | PostgreSQL + Redis |
| **WhatsApp** | Evolution API |
| **Dev Environment** | Docker Compose |
| **Production** | Vercel (front) + Railway (back) |

---

## 🏗️ Arquitetura Híbrida

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER COMPOSE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                         FRONTEND                                   │     │
│   │                    Next.js 14 (Port 3000)                         │     │
│   │                    TailwindCSS + shadcn/ui                        │     │
│   └───────────────────────────────┬───────────────────────────────────┘     │
│                                   │                                          │
│   ┌───────────────────────────────▼───────────────────────────────────┐     │
│   │                     NODE.JS API GATEWAY                           │     │
│   │                    Fastify (Port 4000)                            │     │
│   │                                                                   │     │
│   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │     │
│   │   │  Auth   │ │  Leads  │ │Campaign │ │  Email  │ │WhatsApp │   │     │
│   │   │  API    │ │   API   │ │   API   │ │   API   │ │   API   │   │     │
│   │   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │     │
│   └───────────────────────────────┬───────────────────────────────────┘     │
│                                   │                                          │
│   ┌───────────────────────────────┴───────────────────────────────────┐     │
│   │                    PYTHON MICROSERVICES                           │     │
│   │                                                                   │     │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │     │
│   │   │  Scraping   │  │ Enrichment  │  │  AI Engine  │              │     │
│   │   │  Service    │  │  Service    │  │   Service   │              │     │
│   │   │  Port 5001  │  │  Port 5002  │  │  Port 5003  │              │     │
│   │   └─────────────┘  └─────────────┘  └─────────────┘              │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                   │                                          │
│   ┌───────────────────────────────┴───────────────────────────────────┐     │
│   │                       INFRASTRUCTURE                              │     │
│   │                                                                   │     │
│   │   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │     │
│   │   │ PostgreSQL│  │   Redis   │  │  MinIO    │  │ Evolution │    │     │
│   │   │   :5432   │  │   :6379   │  │   :9000   │  │    :8080  │    │     │
│   │   └───────────┘  └───────────┘  └───────────┘  └───────────┘    │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Estrutura de Pastas

```
lastreia/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
│
├── frontend/                      # Next.js 14
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── app/                   # App Router
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx       # Dashboard home
│   │   │   │   ├── leads/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── inbox/
│   │   │   │   ├── scraping/
│   │   │   │   ├── templates/
│   │   │   │   └── settings/
│   │   │   └── api/               # API routes (proxy)
│   │   ├── components/
│   │   │   ├── ui/                # shadcn components
│   │   │   ├── layout/
│   │   │   ├── leads/
│   │   │   ├── campaigns/
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── api.ts             # API client
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── stores/                # Zustand stores
│   │   └── types/
│   └── public/
│
├── backend/                       # Node.js API
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── env.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── auth.schema.ts
│   │   │   ├── leads/
│   │   │   ├── campaigns/
│   │   │   ├── email/
│   │   │   ├── whatsapp/
│   │   │   ├── scraping/
│   │   │   ├── enrichment/
│   │   │   └── ai/
│   │   ├── jobs/                  # BullMQ workers
│   │   │   ├── email.worker.ts
│   │   │   ├── whatsapp.worker.ts
│   │   │   └── scraping.worker.ts
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   └── queue.ts
│   │   ├── middlewares/
│   │   └── utils/
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
├── services/                      # Python Microservices
│   ├── scraping/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py                # FastAPI app
│   │   ├── scrapers/
│   │   │   ├── google_maps.py
│   │   │   ├── cnpj.py
│   │   │   ├── linkedin.py
│   │   │   ├── reclame_aqui.py
│   │   │   ├── indeed.py
│   │   │   └── mercado_livre.py
│   │   ├── core/
│   │   │   ├── browser.py         # Playwright manager
│   │   │   ├── proxy.py
│   │   │   └── rate_limiter.py
│   │   └── models/
│   │
│   ├── enrichment/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── providers/
│   │   │   ├── hunter.py
│   │   │   ├── snov.py
│   │   │   ├── clearbit.py
│   │   │   └── builtwith.py
│   │   └── core/
│   │
│   └── ai/
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── main.py
│       ├── agents/
│       │   ├── lead_scorer.py
│       │   ├── message_writer.py
│       │   └── response_analyzer.py
│       └── prompts/
│
└── infra/
    ├── nginx/
    │   └── nginx.conf
    └── scripts/
        ├── setup.sh
        └── seed.sql
```

---

## 🗄️ Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== MULTI-TENANT ====================

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(STARTER)
  
  // Limits
  leadsLimit      Int @default(1000)
  emailsLimit     Int @default(5000)
  whatsappLimit   Int @default(1000)
  
  // Usage this month
  leadsUsed       Int @default(0)
  emailsUsed      Int @default(0)
  whatsappUsed    Int @default(0)
  
  // Billing
  stripeCustomerId    String?
  stripeSubscriptionId String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  users       User[]
  leads       Lead[]
  campaigns   Campaign[]
  templates   Template[]
  scrapingJobs ScrapingJob[]
  mailboxes   Mailbox[]
  whatsappInstances WhatsappInstance[]
}

enum Plan {
  STARTER
  GROWTH
  SCALE
  ENTERPRISE
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String
  role          UserRole @default(MEMBER)
  
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  activities    Activity[]
}

enum UserRole {
  OWNER
  ADMIN
  MEMBER
}

// ==================== LEADS ====================

model Lead {
  id              String   @id @default(cuid())
  
  // Basic Info
  firstName       String?
  lastName        String?
  fullName        String?
  email           String?
  emailVerified   Boolean  @default(false)
  phone           String?
  whatsapp        String?
  linkedinUrl     String?
  
  // Company Info
  companyName     String?
  companyDomain   String?
  companyCnpj     String?
  companySize     String?
  industry        String?
  
  // Position
  jobTitle        String?
  seniority       String?
  department      String?
  
  // Location
  city            String?
  state           String?
  country         String?  @default("BR")
  
  // Enrichment
  enrichedAt      DateTime?
  enrichmentData  Json?
  
  // AI
  score           Int?     // 0-100
  icpMatch        Float?   // 0-1
  tags            String[]
  
  // Source
  source          String?
  sourceUrl       String?
  
  // Status
  status          LeadStatus @default(NEW)
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  campaignLeads   CampaignLead[]
  messages        Message[]
  activities      Activity[]
  
  @@index([organizationId])
  @@index([email])
  @@index([companyCnpj])
  @@index([status])
}

enum LeadStatus {
  NEW
  ENRICHING
  ENRICHED
  CONTACTED
  REPLIED
  INTERESTED
  MEETING_SCHEDULED
  CONVERTED
  NOT_INTERESTED
  BOUNCED
  UNSUBSCRIBED
}

// ==================== CAMPAIGNS ====================

model Campaign {
  id              String   @id @default(cuid())
  name            String
  type            CampaignType
  status          CampaignStatus @default(DRAFT)
  
  // Settings
  settings        Json?
  schedule        Json?    // Sending schedule
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  steps           CampaignStep[]
  leads           CampaignLead[]
  
  @@index([organizationId])
}

enum CampaignType {
  EMAIL
  WHATSAPP
  MULTI_CHANNEL
}

enum CampaignStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
}

model CampaignStep {
  id          String   @id @default(cuid())
  order       Int
  type        StepType
  
  // Content
  subject     String?  // For email
  content     String
  templateId  String?
  
  // Timing
  delayDays   Int      @default(0)
  delayHours  Int      @default(0)
  
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime @default(now())
  
  @@index([campaignId])
}

enum StepType {
  EMAIL
  WHATSAPP
  WAIT
  CONDITION
}

model CampaignLead {
  id              String   @id @default(cuid())
  
  currentStep     Int      @default(0)
  status          CampaignLeadStatus @default(PENDING)
  nextActionAt    DateTime?
  
  campaignId      String
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  leadId          String
  lead            Lead     @relation(fields: [leadId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([campaignId, leadId])
  @@index([status])
  @@index([nextActionAt])
}

enum CampaignLeadStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  REPLIED
  BOUNCED
  UNSUBSCRIBED
  PAUSED
}

// ==================== MESSAGES ====================

model Message {
  id              String   @id @default(cuid())
  type            MessageType
  direction       MessageDirection
  
  // Content
  subject         String?
  content         String
  
  // Status
  status          MessageStatus @default(PENDING)
  sentAt          DateTime?
  deliveredAt     DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  repliedAt       DateTime?
  bouncedAt       DateTime?
  
  // Metadata
  externalId      String?  // ID from email provider or WhatsApp
  metadata        Json?
  
  leadId          String
  lead            Lead     @relation(fields: [leadId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@index([leadId])
  @@index([status])
  @@index([type])
}

enum MessageType {
  EMAIL
  WHATSAPP
}

enum MessageDirection {
  OUTBOUND
  INBOUND
}

enum MessageStatus {
  PENDING
  QUEUED
  SENT
  DELIVERED
  OPENED
  CLICKED
  REPLIED
  BOUNCED
  FAILED
}

// ==================== TEMPLATES ====================

model Template {
  id              String   @id @default(cuid())
  name            String
  type            MessageType
  
  subject         String?
  content         String
  
  // Variables: {{firstName}}, {{companyName}}, etc.
  variables       String[]
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([organizationId])
}

// ==================== SCRAPING ====================

model ScrapingJob {
  id              String   @id @default(cuid())
  name            String
  source          String   // google_maps, cnpj, linkedin, etc.
  
  // Query
  query           Json     // Source-specific parameters
  
  // Status
  status          JobStatus @default(PENDING)
  progress        Int      @default(0)
  totalItems      Int      @default(0)
  processedItems  Int      @default(0)
  
  // Results
  leadsCreated    Int      @default(0)
  errors          Json?
  
  // Scheduling
  schedule        String?  // Cron expression
  lastRunAt       DateTime?
  nextRunAt       DateTime?
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([organizationId])
  @@index([status])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// ==================== EMAIL ====================

model Mailbox {
  id              String   @id @default(cuid())
  email           String
  name            String
  
  // SMTP Settings
  smtpHost        String
  smtpPort        Int
  smtpUser        String
  smtpPass        String   // Encrypted
  
  // IMAP Settings (for replies)
  imapHost        String?
  imapPort        Int?
  imapUser        String?
  imapPass        String?  // Encrypted
  
  // Warmup
  isWarming       Boolean  @default(false)
  warmupDay       Int      @default(0)
  dailyLimit      Int      @default(50)
  
  // Status
  isActive        Boolean  @default(true)
  lastUsedAt      DateTime?
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@index([organizationId])
}

// ==================== WHATSAPP ====================

model WhatsappInstance {
  id              String   @id @default(cuid())
  name            String
  phone           String?
  
  // Evolution API
  instanceName    String   @unique
  instanceToken   String
  
  // Status
  status          WhatsappStatus @default(DISCONNECTED)
  qrCode          String?
  lastConnectedAt DateTime?
  
  // Limits
  dailyLimit      Int      @default(100)
  sentToday       Int      @default(0)
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@index([organizationId])
}

enum WhatsappStatus {
  DISCONNECTED
  CONNECTING
  CONNECTED
  BANNED
}

// ==================== ACTIVITY LOG ====================

model Activity {
  id          String   @id @default(cuid())
  type        String   // lead.created, email.sent, etc.
  description String
  metadata    Json?
  
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  
  leadId      String?
  lead        Lead?    @relation(fields: [leadId], references: [id])
  
  createdAt   DateTime @default(now())
  
  @@index([leadId])
  @@index([userId])
}
```

---

# 📅 CRONOGRAMA DE DESENVOLVIMENTO

## Visão Geral - 12 Semanas

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         LASTREIA - 12 WEEK ROADMAP                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEMANA   1    2    3    4    5    6    7    8    9   10   11   12          │
│                                                                              │
│  BACKEND  ████████████████████████████████████████████████████████          │
│  CORE     ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░          │
│           Setup + Auth + Leads CRUD                                          │
│                                                                              │
│  BACKEND  ░░░░░░░░████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░          │
│  SCRAPING         Scrapers + Enrichment                                      │
│                                                                              │
│  BACKEND  ░░░░░░░░░░░░░░░░████████████████████████░░░░░░░░░░░░░░░░          │
│  OUTBOUND                 Email + WhatsApp                                   │
│                                                                              │
│  BACKEND  ░░░░░░░░░░░░░░░░░░░░░░░░████████████████████████░░░░░░░░          │
│  AI                               AI Engine + Scoring                        │
│                                                                              │
│  FRONTEND ░░░░░░░░████████████████████████████████████████████████          │
│           ░░░░░░░░ Dashboard → Leads → Campaigns → Inbox → Settings         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 🔧 BACKEND - Plano Detalhado

## 📦 Backend Core (Semana 1-3)

### Semana 1: Setup & Infrastructure

#### Sprint 1.1: Project Setup
- [ ] Inicializar projeto Node.js + TypeScript
- [ ] Configurar ESLint + Prettier
- [ ] Configurar Fastify + plugins
- [ ] Setup Prisma + PostgreSQL
- [ ] Configurar Docker Compose
- [ ] Configurar variáveis de ambiente
- [ ] Setup Redis + BullMQ

#### Sprint 1.2: Docker Environment
- [ ] Dockerfile para backend
- [ ] Dockerfile para frontend
- [ ] docker-compose.yml completo
- [ ] Scripts de setup (seed, migrations)
- [ ] Hot reload para desenvolvimento
- [ ] Health checks

```yaml
# docker-compose.yml (exemplo)
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
    depends_on:
      - backend
      
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lastreia
      - REDIS_URL=redis://redis:6379
      
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=lastreia
      - POSTGRES_PASSWORD=postgres
      
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
      
  evolution:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    volumes:
      - evolution_data:/evolution/instances
    environment:
      - AUTHENTICATION_API_KEY=your-api-key

volumes:
  postgres_data:
  redis_data:
  evolution_data:
```

### Semana 2: Authentication & Multi-tenant

#### Sprint 2.1: Auth Module
- [ ] Register endpoint (email + password)
- [ ] Login endpoint (JWT)
- [ ] Refresh token flow
- [ ] Password reset (email)
- [ ] Email verification
- [ ] Session management (Redis)

#### Sprint 2.2: Multi-tenant
- [ ] Organization CRUD
- [ ] User invitation flow
- [ ] Role-based access (Owner, Admin, Member)
- [ ] Organization middleware
- [ ] Tenant isolation (all queries)

```typescript
// Exemplo: Auth middleware
import { FastifyRequest } from 'fastify';

export async function authMiddleware(request: FastifyRequest) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Unauthorized');
  }
  
  const payload = verifyJWT(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { organization: true }
  });
  
  request.user = user;
  request.organizationId = user.organizationId;
}
```

### Semana 3: Leads Module

#### Sprint 3.1: Leads CRUD
- [ ] Create lead (single + bulk)
- [ ] List leads (pagination, filters, search)
- [ ] Get lead details
- [ ] Update lead
- [ ] Delete leads (single + bulk)
- [ ] Import CSV/Excel
- [ ] Export CSV/Excel

#### Sprint 3.2: Leads Features
- [ ] Tags management
- [ ] Custom fields
- [ ] Duplicate detection
- [ ] Lead merge
- [ ] Activity log per lead
- [ ] Full-text search (PostgreSQL)

---

## 🕷️ Backend Services - Scraping (Semana 4-5)

### Semana 4: Python Scraping Service

#### Sprint 4.1: Scraping Infrastructure
- [ ] Setup FastAPI project
- [ ] Playwright browser manager
- [ ] Proxy rotation system
- [ ] Rate limiting
- [ ] Error handling + retries
- [ ] API communication with Node.js

```python
# services/scraping/main.py
from fastapi import FastAPI, BackgroundTasks
from scrapers import google_maps, cnpj, reclame_aqui

app = FastAPI(title="Lastreia Scraping Service")

@app.post("/scrape/google-maps")
async def scrape_google_maps(
    query: str,
    location: str,
    limit: int = 100,
    background_tasks: BackgroundTasks
):
    job_id = create_job_id()
    background_tasks.add_task(
        google_maps.scrape,
        query=query,
        location=location,
        limit=limit,
        job_id=job_id
    )
    return {"job_id": job_id, "status": "started"}
```

#### Sprint 4.2: Core Scrapers
- [ ] Google Maps scraper
- [ ] CNPJ.ws / ReceitaWS scraper
- [ ] Reclame Aqui scraper
- [ ] Indeed/Catho job listings

### Semana 5: More Scrapers + Integration

#### Sprint 5.1: E-commerce Scrapers
- [ ] Mercado Livre sellers
- [ ] Technology detection (Wappalyzer)
- [ ] LinkedIn Google dorking
- [ ] ComprasNet (licitações)

#### Sprint 5.2: Node.js Integration
- [ ] Scraping jobs queue (BullMQ)
- [ ] Job status tracking
- [ ] Webhook callbacks
- [ ] Leads auto-creation
- [ ] Error handling + notifications

---

## 📧 Backend Services - Enrichment (Semana 5-6)

### Semana 5-6: Enrichment Service

#### Sprint 5.3: Enrichment Providers
- [ ] Hunter.io integration
- [ ] Snov.io integration
- [ ] Email validation (ZeroBounce)
- [ ] CNPJ enrichment
- [ ] LinkedIn URL finder

#### Sprint 6.1: Enrichment Pipeline
- [ ] Waterfall strategy (cheapest first)
- [ ] Caching layer
- [ ] Confidence scoring
- [ ] Auto-enrichment on lead create
- [ ] Bulk enrichment jobs
- [ ] Usage tracking per org

```python
# services/enrichment/main.py
class EnrichmentPipeline:
    providers = [
        CNPJProvider(),      # Free
        GoogleProvider(),    # Free
        HunterProvider(),    # $0.01
        SnovProvider(),      # $0.02
        ClearbitProvider(),  # $0.05
    ]
    
    async def enrich(self, lead: dict) -> dict:
        enriched = lead.copy()
        
        for provider in self.providers:
            if enriched.get('email') and enriched.get('emailVerified'):
                break  # Already have verified email
                
            try:
                result = await provider.enrich(enriched)
                enriched = {**enriched, **result}
            except Exception as e:
                logger.warning(f"Provider {provider.name} failed: {e}")
                
        return enriched
```

---

## ✉️ Backend Services - Outbound (Semana 6-8)

### Semana 6-7: Email Engine

#### Sprint 6.2: Mailbox Management
- [ ] Add mailbox (SMTP/IMAP)
- [ ] Test connection
- [ ] Mailbox rotation
- [ ] Daily limits per mailbox
- [ ] Warmup system

#### Sprint 7.1: Email Sending
- [ ] Email queue (BullMQ)
- [ ] Template rendering (Handlebars)
- [ ] Variable substitution
- [ ] Tracking pixel injection
- [ ] Link tracking (click tracking)
- [ ] Unsubscribe link
- [ ] DKIM/SPF validation

#### Sprint 7.2: Email Tracking
- [ ] Open tracking webhook
- [ ] Click tracking webhook
- [ ] Bounce handling (webhook)
- [ ] Reply detection (IMAP polling)
- [ ] Spam complaint handling

### Semana 8: WhatsApp Engine

#### Sprint 8.1: Evolution API Integration
- [x] Instance creation
- [x] QR Code authentication
- [x] Connection status webhook
- [x] Send text message
- [x] Send media (image, PDF)
- [x] Receive messages webhook

#### Sprint 8.2: WhatsApp Automation
- [x] Message queue
- [x] Rate limiting (avoid ban)
- [x] Template variables
- [x] Conversation threading
- [ ] Auto-stop on reply
- [ ] Inbox integration

```typescript
// backend/src/modules/whatsapp/whatsapp.service.ts
import { evolutionApi } from '@/lib/evolution';

export class WhatsAppService {
  async sendMessage(instanceId: string, to: string, message: string) {
    const instance = await this.getActiveInstance(instanceId);
    
    // Rate limiting
    if (instance.sentToday >= instance.dailyLimit) {
      throw new Error('Daily limit reached');
    }
    
    // Format phone number
    const formattedPhone = this.formatPhone(to);
    
    // Send via Evolution API
    const result = await evolutionApi.sendText(
      instance.instanceName,
      formattedPhone,
      message
    );
    
    // Update counters
    await this.incrementSentCounter(instanceId);
    
    return result;
  }
}
```

---

## 🤖 Backend Services - AI Engine (Semana 8-10)

### Semana 8-9: AI Service

#### Sprint 8.3: AI Infrastructure
- [x] FastAPI AI service
- [x] OpenAI/Claude integration
- [x] Prompt management system
- [x] Response caching
- [x] Token usage tracking
- [x] Fallback between providers

#### Sprint 9.1: Lead Scoring
- [x] ICP definition (org settings)
- [x] Lead scoring prompt
- [x] Batch scoring job
- [x] Score explanation
- [x] Manual override

#### Sprint 9.2: Message Generation
- [x] Email generation prompt
- [x] WhatsApp generation prompt
- [x] Personalization variables
- [x] Tone selection
- [x] A/B variant generation
- [x] Translation support

### Semana 10: Advanced AI

#### Sprint 10.1: Response Analysis
- [x] Intent classification
- [x] Sentiment analysis
- [x] Auto-categorization
- [x] Suggested responses
- [x] Meeting detection

#### Sprint 10.2: Smart Features
- [x] Best time to send prediction
- [x] Subject line optimization
- [x] Message length optimization
- [x] Engagement prediction

---

## 🔗 Backend - Campaigns (Semana 10-11)

### Semana 10-11: Campaign Engine

#### Sprint 10.3: Campaign Builder
- [x] Create campaign (email/whatsapp/multi)
- [x] Add steps (email, whatsapp, wait, condition)
- [x] Import leads to campaign
- [x] Launch campaign
- [x] Pause/resume campaign

#### Sprint 11.1: Campaign Execution
- [x] Campaign worker (BullMQ)
- [x] Step execution logic
- [x] Wait step scheduling
- [x] Condition evaluation
- [x] Stop on reply
- [x] Stop on bounce/unsubscribe

#### Sprint 11.2: Campaign Analytics
- [x] Sent/delivered/opened/replied counts
- [x] Step-by-step funnel
- [x] A/B test results
- [x] Best performing templates
- [x] Time-based analytics

---

# 🎨 FRONTEND - Plano Detalhado

## 📦 Frontend Core (Semana 2-4)

### Semana 2: Setup & Layout

#### Sprint F2.1: Project Setup
- [ ] Next.js 14 com App Router
- [ ] TailwindCSS + shadcn/ui
- [ ] Zustand para state
- [ ] React Query para data fetching
- [ ] Axios/Fetch wrapper
- [ ] Environment config

#### Sprint F2.2: Layout & Auth
- [ ] Layout principal (sidebar, header)
- [ ] Login page
- [ ] Register page
- [ ] Forgot password page
- [ ] Auth context + guards
- [ ] Loading states

### Semana 3-4: Dashboard & Leads

#### Sprint F3.1: Dashboard
- [ ] Overview cards (leads, sent, opens, replies)
- [ ] Funnel chart
- [ ] Recent activity feed
- [ ] Quick actions
- [ ] Period selector

#### Sprint F3.2: Leads List
- [ ] Data table com pagination
- [ ] Filters (status, source, tags, date)
- [ ] Search
- [ ] Column customization
- [ ] Bulk actions
- [ ] Export

#### Sprint F4.1: Lead Details
- [ ] Lead profile view
- [ ] Activity timeline
- [ ] Edit modal
- [ ] Tags management
- [ ] Notes
- [ ] Quick actions (send email, whatsapp)

#### Sprint F4.2: Lead Import
- [ ] CSV upload
- [ ] Column mapping
- [ ] Preview + validation
- [ ] Import progress
- [ ] Error handling

---

## 📧 Frontend - Campaigns (Semana 5-7)

### Semana 5-6: Campaign Builder

#### Sprint F5.1: Campaign List
- [ ] Campaigns table
- [ ] Status badges
- [ ] Quick stats
- [ ] Duplicate, archive, delete

#### Sprint F5.2: Campaign Creation
- [ ] Step-by-step wizard
- [ ] Campaign settings
- [ ] Audience selection (filters)
- [ ] Schedule configuration

#### Sprint F6.1: Sequence Builder
- [ ] Visual step editor
- [ ] Drag & drop reorder
- [ ] Email step (subject, content, template)
- [ ] WhatsApp step
- [ ] Wait step (days, hours)
- [ ] Condition step (opened? replied?)

#### Sprint F6.2: Template Editor
- [ ] Rich text editor
- [ ] Variable insertion
- [ ] Preview with sample data
- [ ] Mobile preview
- [ ] AI generate button
- [ ] Template library

### Semana 7: Campaign Analytics

#### Sprint F7.1: Campaign Details
- [ ] Overview stats
- [ ] Step-by-step metrics
- [ ] Leads in campaign (list)
- [ ] Lead journey view

---

## 💬 Frontend - Inbox (Semana 7-8)

### Semana 7-8: Unified Inbox

#### Sprint F7.2: Inbox Layout
- [ ] Conversation list (left panel)
- [ ] Conversation view (center)
- [ ] Lead details (right panel)
- [ ] Channel filter (email, whatsapp, all)

#### Sprint F8.1: Conversation Thread
- [ ] Message bubbles (in/out)
- [ ] Timestamps
- [ ] Status indicators
- [ ] Media attachments
- [ ] Reply composer
- [ ] AI suggested replies

#### Sprint F8.2: Inbox Features
- [ ] Mark as read/unread
- [ ] Star/flag conversation
- [ ] Assign to team member
- [ ] Quick notes
- [ ] Lead status update

---

## 🕷️ Frontend - Scraping (Semana 8-9)

### Semana 8-9: Scraping Dashboard

#### Sprint F8.3: Scraping Jobs
- [ ] Jobs list + status
- [ ] Create new job wizard
- [ ] Source selection
- [ ] Query configuration per source
- [ ] Schedule (one-time, recurring)

#### Sprint F9.1: Job Details
- [ ] Progress bar
- [ ] Leads found preview
- [ ] Error log
- [ ] Re-run / cancel buttons

---

## ⚙️ Frontend - Settings (Semana 9-10)

### Semana 9-10: Settings

#### Sprint F9.2: Organization Settings
- [ ] Organization profile
- [ ] Team members
- [ ] Invite users
- [ ] Role management

#### Sprint F10.1: Integration Settings
- [ ] Mailboxes list + add new
- [ ] WhatsApp instances + QR modal
- [ ] API keys (enrichment providers)
- [ ] Webhooks configuration

#### Sprint F10.2: Billing
- [ ] Current plan + usage
- [ ] Upgrade modal
- [ ] Stripe checkout integration
- [ ] Invoice history

---

## 🚀 Frontend - Polish (Semana 11-12)

### Semana 11-12: Final Polish

#### Sprint F11.1: Onboarding
- [ ] Welcome wizard
- [ ] Connect first mailbox
- [ ] Connect WhatsApp
- [ ] Import first leads
- [ ] Send first campaign

#### Sprint F11.2: Notifications
- [ ] In-app notifications
- [ ] Email notifications settings
- [ ] Real-time updates (WebSocket)

#### Sprint F12.1: Mobile Responsive
- [ ] Responsive sidebar
- [ ] Mobile-friendly tables
- [ ] Touch-friendly actions

#### Sprint F12.2: Final Testing
- [ ] E2E tests (Playwright)
- [ ] Performance optimization
- [ ] Error boundaries
- [ ] Loading skeletons
- [ ] Empty states

---

# 🚀 DEPLOYMENT

## Development (Docker)

```bash
# Clone & setup
git clone https://github.com/you/lastreia.git
cd lastreia
cp .env.example .env

# Start everything
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate dev

# Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
# Evolution: http://localhost:8080
```

## Production (Vercel + Railway)

### Frontend (Vercel)
```
1. Connect GitHub repo
2. Set root directory: frontend
3. Add environment variables:
   - NEXT_PUBLIC_API_URL=https://api.lastreia.com.br
4. Deploy
```

### Backend (Railway)
```
1. Create new project
2. Add services:
   - Node.js (backend)
   - PostgreSQL
   - Redis
3. Add Python services:
   - Scraping service
   - Enrichment service
   - AI service
4. Add Evolution API (Docker)
5. Configure environment variables
6. Deploy
```

---

# ✅ Checklist de Aceite

> [!IMPORTANT]
> Antes de aprovar este plano, confirme:

1. **A estrutura de pastas está adequada?**

2. **O schema do banco cobre todos os casos de uso?**

3. **O cronograma de 12 semanas é realista para você?**
   - Posso ajustar para mais ou menos semanas

4. **Quer começar por onde?**
   - [ ] A) Backend Core (Setup + Auth + Leads)
   - [ ] B) Frontend Core (Layout + Dashboard)
   - [ ] C) Ambos em paralelo

5. **Algum módulo que quer priorizar ou desprioritizar?**

---

Quando aprovar, eu começo a implementar! 🚀
