# Lead Pool v2 - Cache Inteligente de Leads

> **Problema real:** Org A scrapa "pizzarias em Sao Paulo". Org B scrapa "pizzarias SP". Org C scrapa "restaurantes Sao Paulo". As tres queries retornam leads sobrepostos. Exigir a mesma keyword nao escala.
>
> **Principio fundamental:** A dedup acontece no **lead individual**, nao na query.

---

## Conceito-Chave

O pool nao armazena "buscas". Ele armazena **leads individuais** com identidade unica. Quando uma nova busca acontece, cada resultado e verificado contra o pool individualmente.

```
Org A busca "pizzarias Sao Paulo"
  -> Scraper retorna 200 resultados
  -> Para CADA resultado:
     -> Tem Google Place ID "ChIJ..."? Ja existe no pool? 
        SIM -> Pula scraping desse, importa do pool
        NAO -> Salva no pool + importa pra Org A

Org B busca "pizzarias SP" (dias depois)
  -> Scraper retorna 180 resultados
  -> 150 deles ja estao no pool (Place ID ja conhecido)
  -> So precisa processar 30 novos
  -> Economia: 83% menos scraping
```

---

## Identidade Unica por Fonte

Cada fonte de scraping tem seu proprio identificador natural. E **isso** que faz a dedup, nao a keyword.

| Fonte | Chave Unica | Exemplo |
|-------|------------|---------|
| Google Maps | `placeId` | `ChIJN1t_tDeuEmsRUsoyG83frY4` |
| CNPJ | `cnpj` normalizado | `12345678000100` |
| LinkedIn | `profileUrl` | `linkedin.com/in/joao-silva` |
| Website manual | `domain` + `email` | `empresa.com` + `joao@empresa.com` |

> [!IMPORTANT]
> Nao dependemos de nome/endereco para dedup. Esses campos sao ambiguos ("Pizzaria do Ze" vs "Pizzaria Do Ze Ltda"). Usamos **IDs estruturais** que a propria fonte fornece.

---

## Sistema de Duas Camadas (Anti-Scraping Redundante)

### Visao Geral

```
Org B pede "dentistas Curitiba"
         |
         v
   +----- CAMADA 1: PRE-BUSCA -----+
   | Normalizar query:              |
   |   category=dental              |
   |   city=Curitiba, state=PR      |
   |                                |
   | Pool tem leads frescos (<7d)?  |
   +------------|-------------------+
               / \
         >=200    <200
          |         |
          v         v
   +-- CACHE HIT --+    +-- CACHE PARCIAL/MISS --+
   | Importar do   |    | Importar o que tem      |
   | pool direto.  |    | + rodar scraper so pro  |
   | ZERO scraping!|    | que falta.              |
   +---------------+    +---------|---------------+
                                  |
                                  v
                    +----- CAMADA 2: PER-LEAD -----+
                    | Para cada resultado novo:     |
                    |   placeId ja existe no pool?   |
                    |     SIM -> merge + claim       |
                    |     NAO -> criar + claim       |
                    +-------------------------------+
```

---

### Camada 1: Pre-Busca (Evitar o Scraping)

**Objetivo:** Antes de ligar o scraper, verificar se o pool ja tem dados suficientes.

```typescript
async handleScrapingRequest(query: ScrapingQuery, orgId: string) {
  // 1. Normalizar a query em campos estruturados
  const parsed = {
    source: "google_maps",
    category: normalizeCategory(query.keyword),  // "dentistas" -> "dental"
    city: normalizeCity(query.location),          // "SP" -> "Sao Paulo"
    state: normalizeState(query.location),        // "SP" -> "SP"
  };

  // 2. Buscar no pool: quantos leads frescos existem?
  const freshThreshold = subDays(new Date(), FRESHNESS_TTL[parsed.source]);
  
  const poolLeads = await prisma.sharedLead.findMany({
    where: {
      source: parsed.source,
      category: parsed.category,
      city: parsed.city,
      state: parsed.state,
      lastScrapedAt: { gte: freshThreshold },
    },
    take: query.desiredAmount,
  });

  const poolCount = poolLeads.length;

  // 3. Decidir: scraping total, parcial, ou zero?
  if (poolCount >= query.desiredAmount) {
    // === CACHE HIT TOTAL ===
    // Pool tem TUDO que o usuario precisa. Scraper NAO roda.
    const claimed = await claimLeads(poolLeads, orgId);
    return { 
      leads: claimed, 
      fromPool: poolCount, 
      scraped: 0,
      message: "Leads importados do cache (sem scraping)" 
    };
  }

  if (poolCount > 0) {
    // === CACHE PARCIAL ===
    // Importar o que tem + scraper busca so o restante
    await claimLeads(poolLeads, orgId);
    
    const remaining = query.desiredAmount - poolCount;
    const scraped = await startScraper(query, orgId, { limit: remaining });
    return { 
      leads: [...poolLeads, ...scraped],
      fromPool: poolCount,
      scraped: scraped.length,
      message: `${poolCount} do cache + ${scraped.length} scraped`
    };
  }

  // === CACHE MISS ===
  // Pool vazio pra essa combinacao. Scraping completo.
  const scraped = await startScraper(query, orgId);
  return { 
    leads: scraped,
    fromPool: 0,
    scraped: scraped.length,
    message: "Scraping completo (primeira busca nessa regiao)"
  };
}
```

**Por que funciona?** A pre-busca nao depende da keyword exata. Ela normaliza:

| Input do usuario | Normalizado |
|-----------------|-------------|
| "dentistas Curitiba" | `category=dental, city=Curitiba, state=PR` |
| "clinica odontologica Curitiba PR" | `category=dental, city=Curitiba, state=PR` |
| "dentist Curitiba" | `category=dental, city=Curitiba, state=PR` |

Todas as tres queries encontram **os mesmos leads** no pool.

---

### Camada 2: Dedup Per-Lead (Durante o Scraping)

**Objetivo:** Quando o scraper roda (cache miss ou parcial), cada resultado e verificado individualmente contra o pool.

```typescript
async processScrapedResult(result: RawResult, orgId: string) {
  // 1. Buscar por ID unico da fonte
  const existing = await prisma.sharedLead.findFirst({
    where: {
      OR: [
        result.placeId ? { googlePlaceId: result.placeId } : undefined,
        result.cnpj    ? { companyCnpj: result.cnpj } : undefined,
        result.email   ? { email: result.email } : undefined,
      ].filter(Boolean) as any[],
    },
  });

  if (existing) {
    // Ja existe no pool -> merge dados novos + claim
    await mergeSharedLead(existing, result);
    await claimIfNotClaimed(existing.id, orgId);
    return; // Sem duplicata
  }

  // Novo lead -> salvar no pool + criar na org
  const shared = await createSharedLead(result);
  await claimIfNotClaimed(shared.id, orgId);
}
```

### Pipeline de Dedup Detalhado

```
Resultado do scraper chega
        |
        v
  [1] Tem placeId? ----SIM----> Busca por placeId
        |                            |
       NAO                      Encontrou?
        |                       /       \
        v                     SIM       NAO
  [2] Tem CNPJ? ---SIM----> Busca por CNPJ   |
        |                        |             |
       NAO                  Encontrou?         |
        |                  /       \           |
        v                SIM       NAO         |
  [3] Tem email? --SIM--> Busca por email      |
        |                      |               |
       NAO                Encontrou?           |
        |                /       \             |
        v              SIM       NAO           |
  [4] Tem phone? -SIM-> Busca por phone        |
        |                    |                 |
       NAO              Encontrou?             |
        |              /       \               |
        v            SIM       NAO             |
                      |         |              |
              MERGE com      CRIAR novo        |
              existente      SharedLead <------+
                      |         |
                      v         v
              Org ja fez claim?
                /         \
              SIM         NAO
               |           |
           (pular)    Criar Lead na Org
                      + SharedLeadClaim
```

---

## Exemplos Praticos

### Exemplo 1: Tres orgs buscam dentistas em Curitiba

```
Dia 1 - Org A: "dentistas Curitiba"
  Pool: vazio
  Acao: Scraping completo -> 200 leads -> salvos no pool
  Resultado: 200 leads (200 scraped, 0 do cache)

Dia 2 - Org B: "clinicas odontologicas Curitiba PR"
  Pool: 200 leads (category=dental, city=Curitiba)
  Pre-busca: 200 >= 150 (desejado) -> CACHE HIT TOTAL
  Acao: Importar 150 do pool. ZERO scraping.
  Resultado: 150 leads (0 scraped, 150 do cache)

Dia 3 - Org C: "dentistas e ortodontistas Curitiba"
  Pool: 200 leads dental + 0 ortodontia
  Pre-busca: parcial (200 dental, mas pediu 300 total)
  Acao: Importar 200 do pool + scraper busca 100 novos
  Resultado: 300 leads (100 scraped, 200 do cache)
  Bonus: dos 100 "novos", 30 ja estavam no pool (dedup per-lead)
         -> So 70 realmente novos
```

### Exemplo 2: Mesmo lead aparece em buscas diferentes

```
Org A scrapa "restaurantes Sao Paulo" -> encontra "Pizzaria Bella" (placeId: ChIJ...)
Org B scrapa "pizzarias zona sul SP" -> scraper retorna "Pizzaria Bella" (mesmo placeId)

Camada 2 detecta: placeId "ChIJ..." ja existe no pool
  -> Merge dados novos (se tiver algo a mais)
  -> Claim pra Org B
  -> NAO cria duplicata
```

---

## Normalizacao de Categoria

Para que "dentistas", "clinica odontologica", "dentist" encontrem os mesmos leads:

```typescript
const CATEGORY_MAP: Record<string, string> = {
  "dentista": "dental", "dentistas": "dental",
  "clinica odontologica": "dental", "odontologia": "dental",
  
  "pizzaria": "pizza", "pizzarias": "pizza", "pizza delivery": "pizza",
  
  "advogado": "legal", "advogados": "legal",
  "escritorio advocacia": "legal",
  
  "academia": "fitness", "academias": "fitness",
  "personal trainer": "fitness",
  
  "contabilidade": "accounting", "contador": "accounting",
  "escritorio contabil": "accounting",
  // ... extensivel via config
};

function normalizeCategory(input: string): string {
  const lower = input.toLowerCase().trim();
  // Match exato
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Match parcial (contem a chave)
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value;
  }
  return lower; // Fallback: usar como esta
}
```

> [!NOTE]
> A normalizacao nao precisa ser perfeita. Ela e uma **otimizacao de pre-busca**. A dedup real acontece pelos IDs unicos (placeId, CNPJ). Mesmo que a categoria nao batesse, o lead nao seria duplicado na Camada 2.

---

## Freshness TTL (Tempo de Vida)

| Fonte | TTL | Justificativa |
|-------|-----|---------------|
| Google Maps | 7 dias | Estabelecimentos mudam pouco |
| CNPJ | 30 dias | Dados cadastrais sao estaveis |
| LinkedIn | 14 dias | Perfis mudam com frequencia media |
| Manual | Sem expiracao | Dados inseridos nao expiram |

Apos o TTL, o pool ainda retorna os dados mas marca como "stale". O sistema pode:
- Usar leads stale e re-scraper em background (async refresh)
- Ou forcar scraping novo se o usuario preferir dados frescos

---

## Schema

```prisma
// ==================== LEAD POOL ====================

model SharedLead {
  id              String   @id @default(cuid())

  // === IDENTIDADE (chaves de dedup) ===
  googlePlaceId   String?  @unique
  companyCnpj     String?  @unique
  linkedinUrl     String?  @unique
  email           String?
  phone           String?

  // === DADOS DO LEAD ===
  fullName        String?
  firstName       String?
  lastName        String?
  companyName     String?
  companyDomain   String?
  website         String?
  jobTitle        String?

  // === LOCALIZACAO ===
  address         String?
  city            String?
  state           String?
  country         String?  @default("BR")
  latitude        Float?
  longitude       Float?

  // === CLASSIFICACAO (usada na pre-busca) ===
  category        String?          // Normalizada: "dental", "pizza", etc
  industry        String?
  companySize     String?
  source          String           // google_maps, cnpj, linkedin
  sourceUrl       String?

  // === DADOS BRUTOS ===
  rawData         Json?
  enrichmentData  Json?

  // === CONTROLE ===
  quality         Int      @default(50)
  confirmations   Int      @default(1)
  lastScrapedAt   DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  claims          SharedLeadClaim[]

  @@index([city, state, category])
  @@index([source])
  @@index([lastScrapedAt])
  @@index([email])
  @@index([phone])
}

model SharedLeadClaim {
  id              String   @id @default(cuid())
  sharedLeadId    String
  sharedLead      SharedLead @relation(fields: [sharedLeadId], references: [id])
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  leadId          String?  @unique
  lead            Lead?    @relation(fields: [leadId], references: [id])
  claimedAt       DateTime @default(now())

  @@unique([sharedLeadId, organizationId])
  @@index([organizationId])
}
```

---

## Merge Inteligente

Quando encontra lead existente no pool:

```typescript
async function mergeSharedLead(existing: SharedLead, newData: ScrapedData) {
  return prisma.sharedLead.update({
    where: { id: existing.id },
    data: {
      // Preencher campos que estavam vazios
      fullName:     existing.fullName     ?? newData.fullName,
      email:        existing.email        ?? newData.email,
      phone:        existing.phone        ?? newData.phone,
      companyName:  existing.companyName  ?? newData.companyName,
      website:      existing.website      ?? newData.website,
      address:      existing.address      ?? newData.address,
      city:         existing.city         ?? newData.city,
      state:        existing.state        ?? newData.state,
      
      // Sempre atualizar
      lastScrapedAt: new Date(),
      confirmations: { increment: 1 },
      quality: Math.min(100, existing.quality + 5),
    },
  });
}
```

---

## Privacidade entre Orgs

| Informacao | Compartilhada? | Observacao |
|-----------|---------------|------------|
| Dados basicos (nome, email, empresa) | Sim, via pool | Sao dados publicos (scraped) |
| Tags, scores, notas da org | **Nao** | Ficam no Lead, nao no SharedLead |
| Mensagens enviadas | **Nao** | Ficam no Lead/Message |
| Campanhas associadas | **Nao** | Ficam no CampaignLead |
| Quem mais esta usando o lead | **Nao** | Claim e invisivel entre orgs |

---

## Claim: Importar do Pool pra Org

```typescript
async function claimLeads(sharedLeads: SharedLead[], orgId: string) {
  const created = [];
  
  for (const shared of sharedLeads) {
    // Verificar se org ja tem esse lead
    const existingClaim = await prisma.sharedLeadClaim.findUnique({
      where: { sharedLeadId_organizationId: { sharedLeadId: shared.id, organizationId: orgId } },
    });
    if (existingClaim) continue; // Ja importado
    
    // Criar Lead na org (copia independente)
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: shared.firstName,
        lastName: shared.lastName,
        fullName: shared.fullName,
        email: shared.email,
        phone: shared.phone,
        companyName: shared.companyName,
        companyDomain: shared.companyDomain,
        companyCnpj: shared.companyCnpj,
        companySize: shared.companySize,
        industry: shared.industry,
        jobTitle: shared.jobTitle,
        city: shared.city,
        state: shared.state,
        country: shared.country,
        source: `pool:${shared.source}`,
        sourceUrl: shared.sourceUrl,
        status: "NEW",
      },
    });
    
    // Registrar claim
    await prisma.sharedLeadClaim.create({
      data: { sharedLeadId: shared.id, organizationId: orgId, leadId: lead.id },
    });
    
    // Incrementar uso
    await prisma.sharedLead.update({
      where: { id: shared.id },
      data: { timesUsed: { increment: 1 } },
    });
    
    created.push(lead);
  }
  
  return created;
}
```

---

## Metricas de Economia

```
Dashboard Admin:
- Total de SharedLeads no pool: 45,230
- Scraping jobs evitados (cache hit total): 234 (este mes)
- Scraping jobs reduzidos (cache parcial): 89 (este mes)
- Tempo economizado: ~39 horas
- Leads redistribuidos: 12,450
- Taxa de dedup (Camada 2): 23%
```

---

## Arquivos de Implementacao

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `prisma/schema.prisma` | MODIFY | Adicionar `SharedLead`, `SharedLeadClaim` |
| `modules/lead-pool/lead-pool.service.ts` | NEW | Pre-busca, claim, merge, CRUD do pool |
| `modules/lead-pool/lead-pool.routes.ts` | NEW | `GET /search`, `POST /claim`, `GET /stats` |
| `modules/lead-pool/dedup.service.ts` | NEW | Engine de dedup per-lead (Camada 2) |
| `modules/lead-pool/category-normalizer.ts` | NEW | Mapa de normalizacao de categorias |
| `modules/scraping/scraping.service.ts` | MODIFY | Interceptar com pre-busca (Camada 1) |
| `frontend/app/scraping/[id]/page.tsx` | MODIFY | Indicador "do cache" vs "scraping novo" |
| `frontend/components/scraping/pool-indicator.tsx` | NEW | Badge mostrando economia |

---

## Ordem de Implementacao

| Fase | Descricao | Esforco |
|------|-----------|---------|
| **1** | Schema + migration | 0.5 dia |
| **2** | Dedup service (Camada 2) | 1 dia |
| **3** | Category normalizer + pre-busca (Camada 1) | 1 dia |
| **4** | Claim service + integracao com scraping | 1 dia |
| **5** | Frontend indicators + metricas | 1 dia |

**Total estimado: ~4.5 dias**
