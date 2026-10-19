-- =============================================================================
-- MARÇAL_CONTAS - MIGRAÇÃO PASSO 5: TABELA PRICE_HISTORY + RLS + SEED DO PS5
-- =============================================================================
-- Cria a tabela public.price_history vinculada ao ID da meta (public.goals.id)
-- para armazenar o valor extraído via scraping e a data sempre que o botão
-- "Atualizar Preço" for acionado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  recorded_price numeric(12, 2) NOT NULL CHECK (recorded_price > 0),
  source_store text DEFAULT 'Scraper Loja',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_goal_date
  ON public.price_history (goal_id, recorded_at ASC);

-- Row Level Security (RLS) vinculada ao family_group_id da meta em public.goals
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Casal gerencia o histórico de preços (price_history) de suas metas" ON public.price_history;
CREATE POLICY "Casal gerencia o histórico de preços (price_history) de suas metas"
  ON public.price_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = price_history.goal_id
        AND g.family_group_id = public.get_my_family_group_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = price_history.goal_id
        AND g.family_group_id = public.get_my_family_group_id()
    )
  );

-- =============================================================================
-- SEED INICIAL: HISTÓRICO DE PREÇOS DA "MISSÃO PS5"
-- =============================================================================
DO $$
DECLARE
  v_ps5_goal_id uuid := '20000000-0000-0000-0000-000000000001';
BEGIN
  IF EXISTS (SELECT 1 FROM public.goals WHERE id = v_ps5_goal_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.price_history WHERE goal_id = v_ps5_goal_id) THEN
      INSERT INTO public.price_history (goal_id, recorded_price, source_store, recorded_at)
      VALUES
        (v_ps5_goal_id, 3899.90, 'Amazon Brasil', '2026-09-05 10:00:00+00'),
        (v_ps5_goal_id, 3749.00, 'KaBuM!', '2026-09-18 10:00:00+00'),
        (v_ps5_goal_id, 3690.00, 'Mercado Livre', '2026-10-01 10:00:00+00'),
        (v_ps5_goal_id, 3580.00, 'Amazon Brasil', '2026-10-10 10:00:00+00'),
        (v_ps5_goal_id, 3449.90, 'Oferta Amazon Brasil', '2026-10-18 10:00:00+00');
    END IF;
  END IF;
END $$;
