# 🚀 Lastreia Backend

Backend API for Lastreia - B2B Prospecting SaaS Platform.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Development Setup (Local)

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Development Setup (Docker)

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

## API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123",
  "organizationName": "My Company"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Leads

#### Create Lead
```http
POST /api/leads
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Jane Smith",
  "email": "jane@company.com",
  "companyName": "Company XYZ",
  "jobTitle": "CEO"
}
```

#### List Leads
```http
GET /api/leads?page=1&limit=20&search=john&status=NEW
Authorization: Bearer <token>
```

#### Get Lead
```http
GET /api/leads/:id
Authorization: Bearer <token>
```

#### Update Lead
```http
PATCH /api/leads/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONTACTED"
}
```

#### Delete Lead
```http
DELETE /api/leads/:id
Authorization: Bearer <token>
```

### Email

#### Add Mailbox
```http
POST /api/email/mailboxes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sales",
  "email": "sales@company.com",
  "smtpHost": "smtp.company.com",
  "smtpPort": 587,
  "smtpUser": "sales@company.com",
  "smtpPass": "password"
}
```

#### Send Email
```http
POST /api/email/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadIds": ["lead_id_1", "lead_id_2"],
  "subject": "Olá {{lead.firstName}}",
  "content": "<p>Oi {{lead.firstName}}, tudo bem?</p>"
}
```

### WhatsApp

#### Create Instance
```http
POST /api/whatsapp/instances
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Equipe Vendas",
  "dailyLimit": 200
}
```

#### List Instances
```http
GET /api/whatsapp/instances?page=1&limit=20
Authorization: Bearer <token>
```

#### Refresh QR
```http
POST /api/whatsapp/instances/:id/qr
Authorization: Bearer <token>
```

#### Send WhatsApp
```http
POST /api/whatsapp/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadIds": ["lead_id_1", "lead_id_2"],
  "message": "Oi {{lead.firstName}}, tudo bem?"
}
```

### Enrichment

#### Create Enrichment Job
```http
POST /api/enrichment/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Enrich batch",
  "leadIds": ["lead_id_1", "lead_id_2"]
}
```

#### List Enrichment Jobs
```http
GET /api/enrichment/jobs?page=1&limit=20
Authorization: Bearer <token>
```

#### Get Enrichment Job
```http
GET /api/enrichment/jobs/:id
Authorization: Bearer <token>
```

### Campaigns

#### Create Campaign
```http
POST /api/campaigns
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Outbound Q1",
  "type": "MULTI_CHANNEL",
  "leadIds": ["lead_id_1"],
  "steps": [
    { "type": "EMAIL", "subject": "Oi {{lead.firstName}}", "content": "<p>Olá!</p>" },
    { "type": "WAIT", "content": "wait", "delayDays": 2 },
    { "type": "WHATSAPP", "content": "Mensagem rápida no WhatsApp" }
  ]
}
```

#### Launch Campaign
```http
POST /api/campaigns/:id/launch
Authorization: Bearer <token>
```

#### Pause/Resume Campaign
```http
POST /api/campaigns/:id/pause
POST /api/campaigns/:id/resume
Authorization: Bearer <token>
```

#### Campaign Analytics
```http
GET /api/campaigns/:id/analytics
Authorization: Bearer <token>
```

### AI Engine

#### Create Lead Scoring Job
```http
POST /api/ai/scoring/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Scoring batch",
  "leadIds": ["lead_id_1", "lead_id_2"],
  "icp": {"industry": "SaaS", "companySize": "50-200"}
}
```

#### Generate Email (AI)
```http
POST /api/ai/generate/email
Authorization: Bearer <token>
Content-Type: application/json

{
  "lead": {"fullName": "Maria Silva", "companyName": "ACME"},
  "tone": "friendly",
  "language": "pt-BR"
}
```

#### Analyze Intent (AI)
```http
POST /api/ai/analyze/intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Gostei, podemos marcar uma demo?"
}
```

#### Update ICP (AI)
```http
PUT /api/ai/icp
Authorization: Bearer <token>
Content-Type: application/json

{
  "icp": {"industry": "SaaS", "companySize": "50-200"}
}
```

## Database Management

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint

# Format
npm run format

# Prisma
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── lib/            # Libraries (Prisma, Redis, Queue)
│   ├── middlewares/    # Fastify middlewares
│   ├── modules/        # Feature modules
│   │   ├── auth/
│   │   ├── leads/
│   │   ├── campaigns/
│   │   ├── email/
│   │   └── whatsapp/
│   ├── jobs/           # BullMQ workers
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point
├── prisma/
│   └── schema.prisma   # Database schema
└── package.json
```

## Environment Variables

See `.env.example` for all available environment variables.

## License

ISC
