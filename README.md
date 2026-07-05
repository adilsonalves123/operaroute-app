# OperaRoute

SaaS de gestão operacional para pequenos e médios operadores — pontos físicos, coletas, financeiro, rotas, equipe e relatórios.

## Stack

- **Next.js 16** (App Router)
- **Supabase** (Auth + Database + RLS)
- **Tailwind CSS 4** (tema dark premium)
- **TypeScript**

## Configuração

### 1. Instalar dependências

```bash
cd operaroute-app
npm install
```

### 2. Configurar Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Copie `.env.local.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

3. Execute o schema SQL no **SQL Editor** do Supabase:

```
supabase/schema.sql
supabase/equipamentos.sql
supabase/multi-nicho.sql
supabase/cassino-visitas.sql
supabase/storage-coleta.sql
```

### 3. Rodar localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### 4. Abrir no celular com Expo Go (QR Code)

O app web roda dentro do **Expo Go** via WebView — escaneie o QR code no terminal.

**Terminal 1** — servidor web (obrigatório):

```bash
npm run dev
```

**Terminal 2** — Expo com QR code:

```bash
npm run mobile
```

1. Instale **Expo Go** no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
2. Celular e PC na **mesma Wi‑Fi**
3. Escaneie o QR code que aparece no terminal (Android: câmera do Expo Go · iOS: câmera nativa)
4. O OperaRoute abre dentro do Expo Go

**IP do PC:** edite `mobile/.env` se necessário:

```
EXPO_PUBLIC_WEB_URL=http://192.168.0.52:3000
```

Use o mesmo IP que aparece em **Network** quando roda `npm run dev`.


## Fluxo do app

1. **Login** → `/login`
2. **Cadastro** → `/cadastro` (7 dias de trial grátis)
3. **Onboarding** → `/configuracao` (escolha nicho, pontos, objetivo)
4. **Dashboard** → adaptado ao nicho (Fura Fura, Máquinas/Cassino, Outros)

## Módulos

| Módulo | Rota | Status |
|--------|------|--------|
| Dashboard | `/dashboard` | ✅ Completo |
| Pontos/Clientes | `/pontos` | ✅ CRUD básico |
| Coletas cassino | `/coletas`, `/coletas/nova/cassino`, `/coletas/visita/[id]` | ✅ Completo |
| Financeiro | `/financeiro` | ✅ Entradas cassino vinculadas à visita |
| Pendências | `/pendencias` | ✅ Cassino (negativo, parcial) |
| Estoque | `/estoque` | 🔲 Estrutura |
| Rotas | `/rotas` | 🔲 Estrutura |
| Equipe | `/equipe` | 🔲 Estrutura |
| Relatórios | `/relatorios` | ✅ PNG das visitas |
| IA do Sistema | `/ia` | ✅ Análise local |
| Universidade | `/universidade` | ✅ UI completa |
| Planos | `/planos` | ✅ UI completa |

## Planos

Preço = **faixa de pontos** + **nichos ativos** (fura-fura, cassino). Nicho "Outros" é incluso.

| Pontos | 1 nicho | 2 nichos | 3 nichos |
|--------|---------|----------|----------|
| 1–10 | R$ 79 | R$ 119 | R$ 149 |
| 11–30 | R$ 129 | R$ 179 | R$ 219 |
| 31–60 | R$ 199 | R$ 259 | R$ 299 |
| 61–100 | R$ 279 | R$ 349 | R$ 399 |
| 100+ | Sob consulta | | |

Config em `src/lib/pricing.ts`.

- **Fura Fura** — coletas com furos, brindes, comissão
- **Máquinas / Cassino** — entrada/saída, leituras
- **Outros** — visitas genéricas

## Segurança

- Row Level Security (RLS) em todas as tabelas
- Dados isolados por `empresa_id`
- Operadores veem apenas pontos atribuídos (políticas avançadas no schema)

## Estrutura

```
src/
├── app/
│   ├── (auth)/          # Login e cadastro
│   ├── (app)/           # Módulos autenticados
│   ├── configuracao/    # Onboarding
│   └── api/ia/          # IA com dados reais
├── components/
│   ├── ui/              # FormInput, EmptyState, etc.
│   ├── cards/           # StatCard, PointCard, etc.
│   └── layout/          # Sidebar, BottomNav, AppShell
└── lib/
    ├── supabase/        # Client, server, middleware
    ├── nicho.ts         # Config por nicho
    └── types/           # TypeScript types
```
