-- =============================================================================
-- MARÇAL_CONTAS - MIGRAÇÃO PASSO 4: TABELA GOALS ("MISSÃO PS5") + RLS + SEED
-- =============================================================================
-- Cria a tabela public.goals vinculada ao family_group_id com as colunas:
-- Nome da Meta (title), Preço Alvo (target_price), Prazo (target_date),
-- URL do Produto (product_url), Valor já Guardado (current_saved) e parâmetros
-- de simulação. Inclui políticas de Row Level Security (RLS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  title text NOT NULL,                                           -- Nome da Meta (ex: "Comprar PS5")
  target_price numeric(12, 2) NOT NULL CHECK (target_price > 0), -- Preço Alvo (ex: 3500.00)
  current_saved numeric(12, 2) NOT NULL DEFAULT 0 CHECK (current_saved >= 0),
  target_date date NOT NULL,                                     -- Prazo (data)
  product_url text,                                              -- URL do Produto
  product_query text,
  interest_rate_monthly numeric(5, 2) NOT NULL DEFAULT 0,
  max_installments int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_family_group
  ON public.goals (family_group_id, target_date ASC);

-- Row Level Security (RLS) restrita ao family_group_id do casal
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros do FamilyGroup gerenciam suas metas (goals)" ON public.goals;
CREATE POLICY "Membros do FamilyGroup gerenciam suas metas (goals)"
  ON public.goals FOR ALL
  USING (family_group_id = public.get_my_family_group_id())
  WITH CHECK (family_group_id = public.get_my_family_group_id());

-- =============================================================================
-- SEED INICIAL: A "MISSÃO PS5" DE YAN & LARISSA
-- =============================================================================
DO $$
DECLARE
  v_group_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  IF EXISTS (SELECT 1 FROM public.family_groups WHERE id = v_group_id) THEN
    INSERT INTO public.goals (
      id,
      family_group_id,
      title,
      target_price,
      current_saved,
      target_date,
      product_url,
      product_query,
      interest_rate_monthly,
      max_installments
    ) VALUES (
      '20000000-0000-0000-0000-000000000001',
      v_group_id,
      'Comprar PS5',
      3500.00,
      0.00,
      '2026-12-15',
      'https://www.amazon.com.br/PlayStation-5-Slim',
      'Console PlayStation 5 Slim 1TB',
      0,
      10
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
