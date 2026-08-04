# Etapa 1 — Status

## O que foi criado

### Estrutura de autenticação
- `src/lib/supabase/client.ts` — cliente Supabase para o browser (SSR-compatible via `@supabase/ssr`)
- `src/lib/supabase/server.ts` — cliente Supabase para Server Components
- `src/lib/supabase/middleware.ts` — helper de refresh de sessão para o middleware
- `middleware.ts` (raiz) — proteção de rotas: redireciona unauthenticated → `/login`, authenticated + auth route → `/`

### Páginas
- `/login` → `src/app/(auth)/login/page.tsx` — página de login
- `/signup` → `src/app/(auth)/signup/page.tsx` — página de cadastro
- `/` → `src/app/(app)/page.tsx` — dashboard placeholder com Bem-vindo + Logout

### Componentes
- `src/components/auth/LoginForm.tsx` — formulário de login com Supabase real
- `src/components/auth/SignupForm.tsx` — formulário de cadastro (nome, email, senha, confirmação)
- `src/components/auth/AuthProvider.tsx` — inicializa o auth store no mount

### State Management
- `src/store/authStore.ts` — Zustand store com signIn, signUp, signOut, fetchDisplayName

### Tipos
- `src/types/database.ts` — tipos do schema do Supabase (Profile, Category, Subcategory, Card, UserCardState, DailyStats)

### Configuração
- `.env.local` — variáveis de ambiente Supabase
- `playwright.config.ts` — configuração do Playwright (mobile Chrome + Safari)
- `tests/auth.spec.ts` — testes básicos de estrutura das páginas de auth

### Dependências instaladas
- `@supabase/ssr` — auth server-side para Next.js App Router

## Como rodar localmente

```bash
cd /home/ubuntu/medcards-web
npm run dev
```

Acesse: http://localhost:3000

## Status do build

**Build passou sem erros.**

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /decks
├ ○ /login
├ ○ /manifest.webmanifest
├ ○ /profile
├ ○ /ranking
├ ○ /search
└ ○ /signup

ƒ Proxy (Middleware)
```

## Fluxo de autenticação

1. Usuário acessa qualquer rota protegida → middleware redireciona para `/login`
2. Login com email/senha → Supabase `signInWithPassword` → redirect para `/`
3. Cadastro → `signUp` + upsert em `profiles` → redirect para `/`
4. Logout → `signOut` + redirect para `/login`

## Problemas encontrados

- Node.js 20 deprecation warning do Supabase (não bloqueia — upgrade para Node 22 recomendado)
- O projeto já existia com páginas mock; a Etapa 1 adicionou a camada de auth real sobre a estrutura existente

## Próximos passos (Etapa 2)

- Conectar o dashboard real (study page) com dados do Supabase
- Implementar SM-2 com `user_card_state`
- Ativar `daily_stats`
