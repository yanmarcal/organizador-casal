-- =============================================================================
-- MARÇAL_CONTAS - MIGRAÇÃO PASSO 2: TABELA EXPENSES + POLÍTICAS RLS + SEED
-- =============================================================================
-- Garante a estrutura da tabela public.expenses vinculada ao family_group_id
-- e ao ID do usuário em "Quem Pagou" (paid_by_user_id -> public.profiles.id),
-- além das políticas de Row Level Security (RLS) restritas ao Grupo Familiar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,               -- Coluna: Data
  description text NOT NULL,                                     -- Coluna: Descrição
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),            -- Coluna: Valor (R$)
  category text NOT NULL DEFAULT 'Outros',                       -- Coluna: Categoria
  payer_type text NOT NULL DEFAULT 'SHARED' CHECK (payer_type IN ('USER_A', 'USER_B', 'SHARED')),
  paid_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Coluna: "Quem Pagou" (FK p/ usuário)
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para alta performance nas consultas mensais por Grupo Familiar
CREATE INDEX IF NOT EXISTS idx_expenses_family_group_date
  ON public.expenses (family_group_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_user
  ON public.expenses (paid_by_user_id);

-- Ativação estrita de Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Casal gerencia os próprios gastos" ON public.expenses;
DROP POLICY IF EXISTS "Membros do FamilyGroup podem visualizar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Membros do FamilyGroup podem inserir gastos" ON public.expenses;
DROP POLICY IF EXISTS "Membros do FamilyGroup podem atualizar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Membros do FamilyGroup podem excluir gastos" ON public.expenses;

CREATE POLICY "Membros do FamilyGroup podem visualizar gastos"
  ON public.expenses FOR SELECT
  USING (family_group_id = public.get_my_family_group_id());

CREATE POLICY "Membros do FamilyGroup podem inserir gastos"
  ON public.expenses FOR INSERT
  WITH CHECK (family_group_id = public.get_my_family_group_id());

CREATE POLICY "Membros do FamilyGroup podem atualizar gastos"
  ON public.expenses FOR UPDATE
  USING (family_group_id = public.get_my_family_group_id())
  WITH CHECK (family_group_id = public.get_my_family_group_id());

CREATE POLICY "Membros do FamilyGroup podem excluir gastos"
  ON public.expenses FOR DELETE
  USING (family_group_id = public.get_my_family_group_id());

-- =============================================================================
-- SEED DE GASTOS DE TESTE PARA YAN & LARISSA (FAMÍLIA MARÇAL)
-- =============================================================================
DO $$
DECLARE
  v_group_id uuid := '11111111-1111-1111-1111-111111111111';
  v_yan_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_larissa_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  IF EXISTS (SELECT 1 FROM public.family_groups WHERE id = v_group_id) THEN
    -- Insere despesas iniciais caso a tabela ainda esteja vazia para este grupo
    IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE family_group_id = v_group_id) THEN
      INSERT INTO public.expenses (
        id, family_group_id, expense_date, description, amount, category, payer_type, paid_by_user_id, created_by
      ) VALUES
        ('10000000-0000-0000-0000-000000000101', v_group_id, '2026-10-05', 'Aluguel + Condomínio', 2800.00, 'Moradia', 'SHARED', v_yan_id, v_yan_id),
        ('10000000-0000-0000-0000-000000000102', v_group_id, '2026-10-08', 'Supermercado Atacadão (Mês)', 1150.50, 'Mercado', 'SHARED', v_larissa_id, v_larissa_id),
        ('10000000-0000-0000-0000-000000000103', v_group_id, '2026-10-12', 'Fone Bluetooth / Setup Home Office', 320.00, 'Compras', 'USER_A', v_yan_id, v_yan_id),
        ('10000000-0000-0000-0000-000000000104', v_group_id, '2026-10-14', 'Consulta Médica & Farmácia', 240.00, 'Saúde', 'USER_B', v_larissa_id, v_larissa_id),
        ('10000000-0000-0000-0000-000000000105', v_group_id, '2026-10-16', 'Internet Fibra + Energia Elétrica', 389.90, 'Moradia', 'SHARED', v_yan_id, v_yan_id);
    END IF;
  END IF;
END $$;
