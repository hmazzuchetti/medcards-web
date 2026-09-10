-- ============================================================
-- Fix: get_leaderboard / get_my_rank quebram com
--   {"code":"42P01","message":"relation \"user_scores\" does not exist"}
--
-- Causa: medcards/scripts/fix_warnings.sql definiu `search_path = ''` nas
-- funções (para calar o linter do Supabase), mas gamification.sql referencia
-- as tabelas sem o prefixo `public.`.
--
-- Execute no SQL Editor do Supabase (precisa de owner). Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_period TEXT DEFAULT 'alltime',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  points INT,
  cards_done INT,
  best_streak INT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY us.points DESC, us.cards_done DESC, us.best_streak DESC, us.updated_at ASC
    ) AS rank,
    us.user_id,
    COALESCE(p.display_name, 'Anônimo') AS display_name,
    p.avatar_url,
    us.points,
    us.cards_done,
    us.best_streak
  FROM public.user_scores us
  JOIN public.profiles p ON p.id = us.user_id
  WHERE us.period = p_period
    AND us.points > 0
  ORDER BY us.points DESC, us.cards_done DESC, us.best_streak DESC, us.updated_at ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank(
  p_period TEXT DEFAULT 'alltime'
)
RETURNS TABLE (
  rank BIGINT,
  points INT,
  cards_done INT,
  best_streak INT,
  total_players BIGINT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH my_score AS (
    SELECT points, cards_done, best_streak, updated_at
    FROM public.user_scores
    WHERE user_id = auth.uid() AND period = p_period
  ),
  players_ahead AS (
    SELECT COUNT(*) AS cnt
    FROM public.user_scores us, my_score ms
    WHERE us.period = p_period
      AND us.points > 0
      AND (
        us.points > ms.points
        OR (us.points = ms.points AND us.cards_done > ms.cards_done)
        OR (us.points = ms.points AND us.cards_done = ms.cards_done AND us.best_streak > ms.best_streak)
        OR (us.points = ms.points AND us.cards_done = ms.cards_done AND us.best_streak = ms.best_streak AND us.updated_at < ms.updated_at)
      )
  ),
  total AS (
    SELECT COUNT(*) AS cnt
    FROM public.user_scores
    WHERE period = p_period AND points > 0
  )
  SELECT
    COALESCE(pa.cnt, 0) + 1 AS rank,
    COALESCE(ms.points, 0) AS points,
    COALESCE(ms.cards_done, 0) AS cards_done,
    COALESCE(ms.best_streak, 0) AS best_streak,
    COALESCE(t.cnt, 0) AS total_players
  FROM
    (SELECT 1) AS dummy
    LEFT JOIN my_score ms ON true
    LEFT JOIN players_ahead pa ON true
    LEFT JOIN total t ON true;
$$;

-- Verificação rápida:
-- SELECT * FROM public.get_leaderboard('alltime', 5, 0);
