# MedCards Web

Flashcards de medicina com repetição espaçada, no padrão do **Anki**. Versão web (Next.js 16 + Supabase) do app React Native em `../medcards`.

## Rodando localmente

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # ou crie o arquivo com as duas variáveis abaixo
npm run dev                  # http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

> `--legacy-peer-deps` é necessário porque `@cloudflare/next-on-pages` ainda declara peer em `next@<=15`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/app/(app)/page.tsx` | Aba **Estudar**: abre direto no card (baralho único das pastas ativas) |
| `src/app/(app)/study/[categoryId]` · `study/folder/[subcategoryId]` | Estudo por categoria / por pasta |
| `src/app/(app)/decks` | **Pastas**: liga/desliga subcategorias, novos por dia; nomes abrem a Busca filtrada |
| `src/app/(app)/search` | **Buscar**: texto livre e/ou filtro por pasta (`?folder=` / `?category=`) |
| `src/lib/scheduler.ts` | Scheduler Anki (learning steps, ease, lapses, previews dos botões) |
| `src/hooks/useStudySession.ts` | Fila da sessão: aprendendo → revisão → novos, learn-ahead, contadores |
| `src/components/study/study-session.tsx` | Tela do card: toque em qualquer lugar revela; esquerda = Errei, direita = Bom; atalhos `espaço`/`1-4` |
| `src/stores/review-store.ts` | Estado local (zustand + localStorage) e sync com `user_card_state` / `daily_stats` |
| `src/proxy.ts` | Proteção de rotas (Next 16 chama o middleware de *proxy*; precisa ficar em `src/`) |
| `docs/` | Feedback do sócio (transcrições dos vídeos) e SQL de correções |

## Scheduler (igual ao Anki, opções padrão)

- Card novo: passos `1m` → `10m` → gradua com `1d`; **Fácil** gradua direto com `4d`.
- Botões em card novo: `1m / 6m / 10m / 4d` (Errei / Difícil / Bom / Fácil).
- Revisão: Difícil ×1.2 (ease −15%), Bom ×ease, Fácil ×ease×1.3 (ease +15%); Errei → relearning `10m`, ease −20%, volta com `1d`.
- Cards em aprendizado voltam **na mesma sessão** quando o passo vence (learn-ahead de 20 min).
- O dia de estudo vira às 4h da manhã.

Tabela completa de casos em `tests/unit/scheduler.spec.ts`.

## Testes

```bash
npm run test:unit   # scheduler (sem browser)
npm run test:ui     # páginas de auth e rotas protegidas (Pixel 5)
npm run test:e2e    # fluxo completo contra o Supabase real: cadastro → pastas → estudo → perfil → banco → ranking → busca
npm test            # tudo (inclui iPhone/WebKit)
```

### Vídeo de demonstração

```bash
npm run demo   # grava tests/demo/record-demo.spec.ts com cursor visível e legendas (Pixel 5)
```

O `.webm` fica em `test-results/<teste>/video.webm`. Para MP4 (WhatsApp), cortando a faixa cinza do gravador:

```bash
ffmpeg -i test-results/<teste>/video.webm -vf "crop=392:726:0:0,fps=30" -c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart -an demo.mp4
```

O Playwright sobe o `next dev` sozinho (`webServer` no `playwright.config.ts`). O E2E cria um usuário `playwright+e2e<timestamp>@medcards.test` a cada execução; apague-os pelo painel do Supabase de tempos em tempos.

## Banco (Supabase)

Schema e RLS estão em `../medcards/scripts/*.sql`. Correção pendente: `docs/sql/fix_leaderboard_search_path.sql` (RPCs `get_leaderboard`/`get_my_rank` quebradas por `search_path = ''`).

## Deploy

O app de teste roda em `medcards.briangroup.uk` (EC2 do Brian, atrás do Cloudflare). Fazer `git pull` lá e reiniciar o `next start` (ou `next dev`) após o merge.
