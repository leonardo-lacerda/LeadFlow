# 🔍 Lead Discovery - Fontes de Dados Massivas

> **50+ fontes de dados** para scraping de leads B2B organizadas por categoria

---

## 📊 Visão Geral das Fontes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FONTES DE DADOS - OVERVIEW                       │
├─────────────────────────────────────────────────────────────────────┤
│  🏢 Diretórios de Empresas      │  15+ fontes                       │
│  👤 Redes Profissionais         │  8+ fontes                        │
│  🇧🇷 Dados Governamentais BR    │  10+ fontes                       │
│  💼 Portais de Emprego          │  8+ fontes                        │
│  🛒 E-commerce & Marketplaces   │  10+ fontes                       │
│  💰 Investimento & Startups     │  8+ fontes                        │
│  🌐 Tecnologia & SaaS           │  10+ fontes                       │
│  📍 Locais & Mapas              │  5+ fontes                        │
│  📰 Notícias & Eventos          │  6+ fontes                        │
│  ⭐ Review & Reputação          │  6+ fontes                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏢 1. Diretórios de Empresas

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 1 | **CNPJ.ws** | cnpj.ws | CNPJ, razão social, sócios, endereço, CNAE, capital | ⭐ | 50M+ |
| 2 | **Receita WS** | receitaws.com.br | Dados completos CNPJ | ⭐ | 50M+ |
| 3 | **Empresas Brasil** | empresasbrasil.com | Listagem por cidade/setor | ⭐⭐ | 20M+ |
| 4 | **Econodata** | econodata.com.br | Empresas + decisores | ⭐⭐⭐ | 20M+ |
| 5 | **Lista Amarga** | listaamarga.com.br | Lista negra de empresas | ⭐⭐ | 500K+ |
| 6 | **Bing Places** | bingplaces.com | Empresas locais | ⭐⭐ | Global |
| 7 | **Yelp** | yelp.com | Empresas + reviews | ⭐⭐ | Global |
| 8 | **Yellow Pages BR** | guiamais.com.br | Listagem por categoria | ⭐⭐ | 5M+ |
| 9 | **TeleListas** | telelistas.net | Telefones comerciais | ⭐⭐ | 3M+ |
| 10 | **Apontador** | apontador.com.br | Empresas locais BR | ⭐⭐ | 2M+ |
| 11 | **Encontra BR** | encontrabrasil.com.br | Diretório geral | ⭐⭐ | 1M+ |
| 12 | **Hotfrog** | hotfrog.com.br | Diretório B2B | ⭐⭐ | 500K+ |
| 13 | **Kompass** | br.kompass.com | B2B internacional | ⭐⭐⭐ | 40M+ |
| 14 | **D&B Hoovers** | dnb.com | Enterprise data | ⭐⭐⭐⭐ | 400M+ |
| 15 | **ZoomInfo** (scrape listings) | zoominfo.com | B2B data | ⭐⭐⭐⭐ | 100M+ |

### Dados Extraídos
```json
{
  "cnpj": "12.345.678/0001-90",
  "razao_social": "Empresa XYZ Ltda",
  "nome_fantasia": "XYZ Solutions",
  "endereco": {
    "logradouro": "Av. Paulista, 1000",
    "cidade": "São Paulo",
    "estado": "SP",
    "cep": "01310-100"
  },
  "telefone": "(11) 3456-7890",
  "email": "contato@xyz.com.br",
  "cnae_principal": "6201-5/00 - Desenvolvimento de software",
  "porte": "Média empresa",
  "capital_social": 500000,
  "socios": ["João Silva", "Maria Santos"],
  "data_abertura": "2015-03-20"
}
```

---

## 👤 2. Redes Profissionais

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 16 | **LinkedIn*** | linkedin.com | Perfis, cargos, empresas | ⭐⭐⭐⭐⭐ | 900M+ |
| 17 | **LinkedIn Sales Nav** | linkedin.com/sales | Leads qualificados | ⭐⭐⭐ | 900M+ |
| 18 | **Apollo.io** (scrape) | apollo.io | Emails, telefones | ⭐⭐⭐ | 250M+ |
| 19 | **Lusha** (scrape) | lusha.com | Contatos diretos | ⭐⭐⭐ | 100M+ |
| 20 | **RocketReach** | rocketreach.co | Emails profissionais | ⭐⭐⭐ | 700M+ |
| 21 | **Hunter.io** (API) | hunter.io | Emails corporativos | ⭐ | 100M+ |
| 22 | **Snov.io** (API) | snov.io | Emails + LinkedIn | ⭐ | 50M+ |
| 23 | **GetProspect** | getprospect.com | LinkedIn emails | ⭐⭐ | 200M+ |

### ⚠️ LinkedIn Strategy

```
ABORDAGEM SEGURA para LinkedIn:

1. LinkedIn Sales Navigator (oficial)
   └── Usar API oficial onde possível
   └── Export de listas de leads

2. Google Dorking para LinkedIn
   └── site:linkedin.com/in/ "CEO" "São Paulo"
   └── site:linkedin.com/company/ "software"

3. Phantombuster / Dripify
   └── Automação "tolerada" pelo LinkedIn
   └── Rate limit: 80-100 profiles/dia

4. Proxycurl API (pago)
   └── API legal para dados LinkedIn
   └── $0.01/perfil
```

---

## 🇧🇷 3. Dados Governamentais Brasil

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 24 | **Portal Transparência** | portaltransparencia.gov.br | Contratos gov, fornecedores | ⭐⭐ | 1M+ |
| 25 | **ComprasNet** | comprasnet.gov.br | Licitações, pregões | ⭐⭐⭐ | 500K+ |
| 26 | **Dados Abertos** | dados.gov.br | Datasets públicos | ⭐ | Variado |
| 27 | **Junta Comercial** | redesim.gov.br | Abertura de empresas | ⭐⭐⭐ | 5M+ |
| 28 | **INPI** | inpi.gov.br | Marcas, patentes | ⭐⭐ | 2M+ |
| 29 | **CVM** | cvm.gov.br | Empresas de capital aberto | ⭐⭐ | 500+ |
| 30 | **SUSEP** | susep.gov.br | Seguradoras, corretoras | ⭐⭐ | 5K+ |
| 31 | **BACEN** | bcb.gov.br | Bancos, fintechs | ⭐⭐ | 2K+ |
| 32 | **ANVISA** | anvisa.gov.br | Pharma, alimentos | ⭐⭐ | 100K+ |
| 33 | **Diário Oficial** | in.gov.br | Publicações oficiais | ⭐⭐⭐ | Daily |

### Casos de Uso Governamentais

```
🎯 LICITAÇÕES = Leads Quentes!

Empresas que participam de licitações:
- Têm CNPJ ativo
- Têm capacidade financeira
- Estão crescendo
- Precisam de ferramentas/serviços

Scraping de ComprasNet:
→ Nome da empresa
→ CNPJ
→ Valor do contrato
→ Tipo de serviço
→ Contato do responsável
```

---

## 💼 4. Portais de Emprego

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 34 | **LinkedIn Jobs** | linkedin.com/jobs | Empresas contratando | ⭐⭐⭐ | 15M+ |
| 35 | **Glassdoor** | glassdoor.com.br | Empresas + salários | ⭐⭐⭐ | 2M+ |
| 36 | **Indeed** | indeed.com.br | Vagas abertas | ⭐⭐ | 500K+ |
| 37 | **Catho** | catho.com.br | Empresas contratando BR | ⭐⭐ | 50K+ |
| 38 | **InfoJobs** | infojobs.com.br | Vagas, empresas | ⭐⭐ | 100K+ |
| 39 | **Gupy** | gupy.io | Tech companies | ⭐⭐⭐ | 5K+ |
| 40 | **Vagas.com** | vagas.com.br | Empresas BR | ⭐⭐ | 100K+ |
| 41 | **Trampos** | trampos.co | Startups, tech | ⭐⭐ | 10K+ |

### Insight de Portais de Emprego

```
💡 EMPRESAS CONTRATANDO = CRESCENDO

Sinais de compra detectados:
├── Abrindo vaga de SDR/Vendas → Querem vender mais
├── Abrindo vaga de Marketing → Investindo em growth
├── Abrindo vaga de Dev → Construindo produto
├── Múltiplas vagas → Empresa em expansão
└── Vaga de C-level → Reestruturação/investimento
```

---

## 🛒 5. E-commerce & Marketplaces

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 42 | **Mercado Livre** | mercadolivre.com.br | Vendedores, lojas | ⭐⭐ | 500K+ |
| 43 | **Amazon Brasil** | amazon.com.br | Sellers | ⭐⭐⭐ | 100K+ |
| 44 | **Shopee** | shopee.com.br | Vendedores | ⭐⭐⭐ | 200K+ |
| 45 | **Magazine Luiza** | magazineluiza.com.br | Parceiros | ⭐⭐ | 50K+ |
| 46 | **Americanas** | americanas.com.br | Sellers | ⭐⭐ | 50K+ |
| 47 | **B2W** | b2wmarketplace.com.br | Marketplace sellers | ⭐⭐ | 80K+ |
| 48 | **Bling** (scrape users) | bling.com.br | E-commerces usando ERP | ⭐⭐⭐ | 30K+ |
| 49 | **Tiny** (scrape users) | tiny.com.br | E-commerces usando ERP | ⭐⭐⭐ | 25K+ |
| 50 | **Loja Integrada** | lojaintegrada.com.br | Lojas ativas | ⭐⭐⭐ | 2M+ |
| 51 | **Nuvemshop** | nuvemshop.com.br | E-commerces | ⭐⭐⭐ | 100K+ |

### Estratégia E-commerce

```
🛒 SCRAPING DE MARKETPLACES

Mercado Livre:
└── /perfil/{seller_id}
    ├── Nome da loja
    ├── CNPJ (às vezes visível)
    ├── Localização
    ├── Reputação
    ├── Produtos vendidos
    └── Volume de vendas estimado

Loja Integrada / Nuvemshop:
└── Sites que usam mostram footer/badge
└── Identificar tecnologia com Wappalyzer
└── Scrape direto das lojas identificadas
```

---

## 💰 6. Investimento & Startups

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 52 | **Crunchbase** | crunchbase.com | Startups, funding | ⭐⭐⭐ | 1M+ |
| 53 | **AngelList** | angel.co | Startups, founders | ⭐⭐⭐ | 500K+ |
| 54 | **ProductHunt** | producthunt.com | Novos produtos | ⭐⭐ | 100K+ |
| 55 | **Distrito** | distrito.me | Startups BR | ⭐⭐ | 15K+ |
| 56 | **Startupbase** | startupbase.com.br | Startups BR | ⭐⭐ | 10K+ |
| 57 | **LAVCA** | lavca.org | VC deals LATAM | ⭐⭐⭐ | 5K+ |
| 58 | **Sling Hub** | slinghub.io | Startups LATAM | ⭐⭐ | 20K+ |
| 59 | **F6S** | f6s.com | Startups globais | ⭐⭐ | 1M+ |

### Sinais de Investimento

```
💸 STARTUPS QUE RECEBERAM FUNDING

→ Precisam escalar RÁPIDO
→ Estão contratando
→ Vão comprar ferramentas
→ Têm budget disponível

Dados de funding:
├── Rodada (Seed, Series A, B, C)
├── Valor levantado
├── Investidores
├── Data do funding
└── Uso declarado do capital
```

---

## 🌐 7. Tecnologia & SaaS

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 60 | **BuiltWith** | builtwith.com | Tech stack de sites | ⭐⭐ | 600M+ |
| 61 | **Wappalyzer** | wappalyzer.com | Tecnologias usadas | ⭐ | 10M+ |
| 62 | **SimilarWeb** | similarweb.com | Tráfego, competidores | ⭐⭐⭐ | 100M+ |
| 63 | **G2** | g2.com | Reviews de software | ⭐⭐ | 2M+ |
| 64 | **Capterra** | capterra.com.br | Comparação software | ⭐⭐ | 1M+ |
| 65 | **GitHub** | github.com | Devs, companies | ⭐⭐ | 100M+ |
| 66 | **Stack Overflow** | stackoverflow.com | Tech companies | ⭐⭐⭐ | 50M+ |
| 67 | **HackerNews** | news.ycombinator.com | Startups, founders | ⭐⭐ | 500K+ |
| 68 | **AWS Marketplace** | aws.amazon.com/marketplace | SaaS products | ⭐⭐ | 10K+ |
| 69 | **Chrome Web Store** | chrome.google.com/webstore | Extensions, devs | ⭐⭐ | 200K+ |

### Tech Stack = Qualificação

```
🔧 IDENTIFICAR TECNOLOGIA = ICP MATCH

Se usam Salesforce → Empresa enterprise, $$
Se usam HubSpot → Marketing-focused
Se usam Shopify → E-commerce
Se usam WordPress → Pequenas empresas
Se usam React/Node → Tech company

BuiltWith permite:
├── Filtrar por tecnologia
├── Ver mudanças recentes (migração)
├── Identificar stack completo
└── Estimar tamanho da operação
```

---

## 📍 8. Locais & Mapas

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 70 | **Google Maps** | google.com/maps | Empresas locais | ⭐⭐ | 200M+ |
| 71 | **Google My Business** | business.google.com | Perfis de negócio | ⭐⭐ | 100M+ |
| 72 | **Bing Maps** | bing.com/maps | Locais comerciais | ⭐⭐ | 50M+ |
| 73 | **Apple Maps** | maps.apple.com | Empresas locais | ⭐⭐⭐ | 30M+ |
| 74 | **Foursquare** | foursquare.com | Locais + reviews | ⭐⭐ | 100M+ |

### Google Maps Scraping

```python
# Estratégia de busca no Google Maps

QUERIES = [
    # Por categoria
    "restaurantes em São Paulo",
    "escritório de contabilidade Rio de Janeiro",
    "agência de marketing Curitiba",
    
    # Por área específica
    "empresas Av Paulista",
    "escritórios Faria Lima",
    
    # Por keyword específica
    "software house Brasil",
    "fábrica de móveis Bento Gonçalves"
]

DADOS_EXTRAÍDOS = {
    "nome": "Empresa XYZ",
    "categoria": "Agência de Marketing",
    "endereco": "Av. Paulista, 1000",
    "telefone": "(11) 99999-9999",
    "website": "www.xyz.com.br",
    "horario_funcionamento": "9h-18h",
    "avaliacao": 4.5,
    "num_reviews": 150,
    "fotos": ["url1", "url2"]
}
```

---

## 📰 9. Notícias & Eventos

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 75 | **Google News** | news.google.com | Empresas na mídia | ⭐⭐ | Daily |
| 76 | **Exame** | exame.com | Empresas BR | ⭐⭐ | Daily |
| 77 | **Valor Econômico** | valor.globo.com | Negócios, M&A | ⭐⭐ | Daily |
| 78 | **Estadão Empresas** | estadao.com.br/economia | Empresas BR | ⭐⭐ | Daily |
| 79 | **Eventbrite** | eventbrite.com.br | Empresas em eventos | ⭐⭐ | 50K+ |
| 80 | **Meetup** | meetup.com | Comunidades, orgs | ⭐⭐ | 100K+ |

### Sinais de Notícias

```
📰 EVENTOS DE TRIGGER

Empresas mencionadas por:
├── Expansão / Nova sede → Crescimento
├── Contratação em massa → Budget disponível
├── Novo produto lançado → Investindo
├── Fusão / Aquisição → Reestruturação
├── Prêmio / Reconhecimento → Momento positivo
└── Problemas / Crise → Pode precisar de ajuda
```

---

## ⭐ 10. Review & Reputação

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 81 | **Reclame Aqui** | reclameaqui.com.br | Empresas + reputação | ⭐⭐ | 500K+ |
| 82 | **Google Reviews** | google.com | Avaliações | ⭐⭐ | 200M+ |
| 83 | **Trustpilot** | trustpilot.com | Reviews globais | ⭐⭐ | 1M+ |
| 84 | **Glassdoor** | glassdoor.com.br | Reviews de empregados | ⭐⭐⭐ | 2M+ |
| 85 | **Indeed Reviews** | indeed.com.br | Reviews de empresas | ⭐⭐ | 500K+ |
| 86 | **Consumidor.gov** | consumidor.gov.br | Reclamações oficiais | ⭐⭐ | 100K+ |

---

## 🔗 11. Redes Sociais & Comunidades

| # | Fonte | URL | Dados Disponíveis | Dificuldade | Volume |
|---|-------|-----|-------------------|-------------|--------|
| 87 | **Instagram Business** | instagram.com | Perfis comerciais | ⭐⭐⭐ | 200M+ |
| 88 | **Facebook Pages** | facebook.com | Páginas de empresas | ⭐⭐⭐ | 200M+ |
| 89 | **Twitter/X** | x.com | Empresas, founders | ⭐⭐ | 400M+ |
| 90 | **YouTube Channels** | youtube.com | Canais empresariais | ⭐⭐ | 50M+ |
| 91 | **TikTok Business** | tiktok.com | Marcas, D2C | ⭐⭐⭐ | 10M+ |
| 92 | **Reddit** | reddit.com | Comunidades, menções | ⭐⭐ | Variado |
| 93 | **Discord** (servers) | discord.com | Comunidades tech | ⭐⭐⭐ | 150M+ |
| 94 | **Slack Communities** | slack.com | Comunidades B2B | ⭐⭐⭐ | Variado |

---

## 🏭 12. Setores Específicos

### Saúde
| # | Fonte | Dados |
|---|-------|-------|
| 95 | **CRM/CFM** | Médicos, clínicas |
| 96 | **Doctoralia** | Médicos, consultórios |
| 97 | **iClinic** (users) | Clínicas usando o sistema |

### Imobiliário
| # | Fonte | Dados |
|---|-------|-------|
| 98 | **ZAP Imóveis** | Imobiliárias, corretores |
| 99 | **VivaReal** | Idem |
| 100 | **CRECI** | Corretores registrados |

### Educação
| # | Fonte | Dados |
|---|-------|-------|
| 101 | **MEC/e-MEC** | Instituições de ensino |
| 102 | **Hotmart** (creators) | Infoprodutores |
| 103 | **Udemy** (instructors) | Produtores de curso |

### Jurídico
| # | Fonte | Dados |
|---|-------|-------|
| 104 | **OAB** | Advogados registrados |
| 105 | **Jusbrasil** | Escritórios, advogados |
| 106 | **Escavador** | Processos, partes |

### Contabilidade
| # | Fonte | Dados |
|---|-------|-------|
| 107 | **CRC** | Contadores registrados |
| 108 | **Contabilizei** (similar) | Contabilidades online |

---

## 📊 Matriz de Priorização

### Por Volume x Facilidade

```
                    FÁCIL                              DIFÍCIL
              ┌─────────────────────────────────────────────────┐
              │                                                 │
   ALTO       │  🟢 Google Maps        🟡 LinkedIn              │
   VOLUME     │  🟢 CNPJ APIs          🟡 Crunchbase            │
              │  🟢 Reclame Aqui       🟡 Instagram             │
              │                                                 │
              ├─────────────────────────────────────────────────┤
              │                                                 │
   MÉDIO      │  🟢 Indeed/Catho       🟡 Glassdoor             │
   VOLUME     │  🟢 Mercado Livre      🟡 Apollo (scrape)       │
              │  🟢 BuiltWith          🟡 ZoomInfo              │
              │                                                 │
              ├─────────────────────────────────────────────────┤
              │                                                 │
   BAIXO      │  🟢 ProductHunt        🟡 LinkedIn Sales Nav    │
   VOLUME     │  🟢 Distrito           🟡 Specific APIs         │
   (QUALI)    │  🟢 Startupbase        🟡 Manual research       │
              │                                                 │
              └─────────────────────────────────────────────────┘

🟢 = Prioridade 1 (começar aqui)
🟡 = Prioridade 2 (adicionar depois)
```

---

## 🚀 Plano de Implementação - Scraping

### Fase 1: Fontes Básicas (Semana 1-2)
- [ ] Google Maps scraper
- [ ] CNPJ.ws / ReceitaWS integration
- [ ] Reclame Aqui scraper
- [ ] Indeed/Catho job listings

### Fase 2: E-commerce & Tech (Semana 3-4)
- [ ] Mercado Livre sellers
- [ ] BuiltWith/Wappalyzer integration
- [ ] Loja Integrada/Nuvemshop detection

### Fase 3: Profissional (Semana 5-6)
- [ ] LinkedIn Google dorking
- [ ] Hunter.io/Snov.io APIs
- [ ] Glassdoor enrichment

### Fase 4: Avançado (Semana 7-8)
- [ ] Crunchbase/Distrito startups
- [ ] Licitações/ComprasNet
- [ ] News monitoring

---

## 🔧 Arquitetura do Scraping Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCRAPING ORCHESTRATOR                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Config  │  │  Queue   │  │  Rate    │  │  Proxy   │        │
│  │  Manager │  │  Manager │  │  Limiter │  │  Manager │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Browser     │     │     API       │     │    RSS/       │
│   Scrapers    │     │   Scrapers    │     │   Feed        │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ • Google Maps │     │ • CNPJ.ws     │     │ • News        │
│ • LinkedIn    │     │ • Hunter.io   │     │ • Eventos     │
│ • Glassdoor   │     │ • BuiltWith   │     │ • Jobs RSS    │
│ • Reclame Aqui│     │ • Crunchbase  │     │ • Diário      │
│ • Marketplaces│     │ • Gov APIs    │     │   Oficial     │
└───────────────┘     └───────────────┘     └───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA NORMALIZER                             │
│   (Unifica formato de todas as fontes)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DEDUPLICATION                               │
│   (Remove duplicatas por CNPJ/email/nome)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LEAD DATABASE                               │
│   PostgreSQL + Full-text Search                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ❓ Próximas Decisões

> [!IMPORTANT]
> Para começar a implementar, preciso saber:

1. **Quais 5 fontes são prioridade máxima para você?**
   - Exemplo: Google Maps, CNPJ, LinkedIn, Indeed, Mercado Livre

2. **Quer foco em algum setor específico?**
   - Geral / E-commerce / Saúde / Tech / etc.

3. **Precisa de proxy rotation?**
   - Para scraping pesado, proxies evitam bloqueios
   - Custo: ~$50-200/mês

4. **Qual frequência de scraping?**
   - Real-time / Diário / Semanal / On-demand
