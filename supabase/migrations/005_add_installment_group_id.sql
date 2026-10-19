-- ============================================================================
-- MIGRAÇÃO 005: Vínculo entre Parcelas (installment_group_id) na tabela expenses
-- ============================================================================

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS installment_group_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_installment_group_id
ON public.expenses (installment_group_id)
WHERE installment_group_id IS NOT NULL;

COMMENT ON COLUMN public.expenses.installment_group_id IS
  'UUID compartilhado por todas as parcelas geradas a partir de uma mesma compra parcelada manual.';
