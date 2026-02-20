# 🎨 Leadflow Frontend

Frontend para a plataforma SaaS Leadflow, construído com Next.js 14, TailwindCSS e shadcn/ui.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + shadcn/ui
- **State**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Icons**: Tabler Icons + Lucide React
- **Animations**: Framer Motion

## 🚀 Como Rodar

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

O frontend estará disponível em [http://localhost:3000](http://localhost:3000).

## 📂 Estrutura

```
frontend/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Rotas de autenticação (login, register)
│   ├── dashboard/        # Dashboard principal
│   ├── leads/            # Gestão de leads
│   ├── campaigns/        # Gestão de campanhas (em breve)
│   ├── layout.tsx        # Layout raiz com Providers
│   └── page.tsx          # Home (redirect para dashboard)
├── components/           # Componentes React
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Componentes de layout (Sidebar, Header)
│   └── shared/           # Componentes reutilizáveis
├── lib/                  # Utilitários e configurações
│   ├── api.ts            # Client Axios configurado
│   └── utils.ts          # Helpers gerais
├── store/                # Zustand stores (auth, etc)
└── hooks/                # Custom hooks (use-toast, etc)
```

## 🔐 Autenticação

A autenticação é gerenciada via Zustand (`store/auth-store.ts`) persistindo o token JWT no localStorage. O `api.ts` intercepta requisições para adicionar o token automaticamente.

## 🎨 UI Guidelines

- **Fonte**: Inter (Google Fonts)
- **Cores**: Slate/Neutral (Tailwind default)
- **Dark Mode**: Suportado (via `next-themes` - a configurar)
