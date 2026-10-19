-- =============================================================================
-- MARÇAL_CONTAS - MIGRAÇÃO INICIAL (PASSO 1 AO PASSO 5 + POLÍTICAS RLS)
-- =============================================================================

-- Extensão necessária para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABELA: family_groups (Grupo Familiar / Casal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. TABELA: profiles (Perfis Individuais do Casal vinculados ao FamilyGroup)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_group_id uuid REFERENCES public.family_groups(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role_label text NOT NULL DEFAULT 'Parceiro(a)', -- Ex: "Eu (Marido)", "Esposa"
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. TABELA: monthly_budgets (Orçamento e Receita Mensal do Casal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  partner_1_income numeric(12, 2) NOT NULL DEFAULT 0,
  partner_2_income numeric(12, 2) NOT NULL DEFAULT 0,
  total_income numeric(12, 2) NOT NULL DEFAULT 0,
  split_mode text NOT NULL DEFAULT 'FIFTY_FIFTY' CHECK (split_mode IN ('FIFTY_FIFTY', 'PROPORTIONAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_group_id, year, month)
);

-- -----------------------------------------------------------------------------
-- 4. TABELA: expenses (Planilha de Gastos do Casal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'Outros',
  -- "Quem Pagou" na visão de planilha: 'USER_A', 'USER_B' ou 'SHARED' (Dividido)
  payer_type text NOT NULL DEFAULT 'SHARED' CHECK (payer_type IN ('USER_A', 'USER_B', 'SHARED')),
  -- Quem efetivamente desembolsou o valor da conta compartilhada (para o cálculo Splitwise)
  paid_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  installment_group_id uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. TABELA: financial_goals (Metas Financeiras - ex: "Comprar um PS5")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_price numeric(12, 2) NOT NULL CHECK (target_price > 0),
  current_saved numeric(12, 2) NOT NULL DEFAULT 0 CHECK (current_saved >= 0),
  target_date date NOT NULL,
  product_url text,
  product_query text,
  interest_rate_monthly numeric(5, 2) NOT NULL DEFAULT 0,
  max_installments int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. TABELA: goal_price_history (Histórico de Preços Monitorados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  recorded_price numeric(12, 2) NOT NULL CHECK (recorded_price > 0),
  source_store text DEFAULT 'Monitor Automático',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- FUNÇÕES AUXILIARES E TRIGGERS DE AUTENTICAÇÃO / VÍNCULO DE CASAL
-- =============================================================================

-- Retorna o family_group_id do usuário autenticado (evita recursão no RLS)
CREATE OR REPLACE FUNCTION public.get_my_family_group_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT family_group_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Trigger automática: cria registro em public.profiles assim que um usuário se cadastra no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_label, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role_label', 'Parceiro(a)'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC Segura: Criar novo FamilyGroup e vincular automaticamente o usuário logado
CREATE OR REPLACE FUNCTION public.create_family_group_and_join(group_name text, user_role_label text DEFAULT 'Eu')
RETURNS public.family_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_group public.family_groups;
BEGIN
  INSERT INTO public.family_groups (name, created_by)
  VALUES (group_name, auth.uid())
  RETURNING * INTO new_group;

  UPDATE public.profiles
  SET family_group_id = new_group.id,
      role_label = COALESCE(NULLIF(trim(user_role_label), ''), role_label),
      updated_at = now()
  WHERE id = auth.uid();

  RETURN new_group;
END;
$$;

-- RPC Segura: Entrar em um FamilyGroup existente usando o código de convite (limitado a 2 pessoas - casal)
CREATE OR REPLACE FUNCTION public.join_family_group_by_code(code text, user_role_label text DEFAULT 'Esposa')
RETURNS public.family_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_group public.family_groups;
  member_count int;
BEGIN
  SELECT * INTO target_group
  FROM public.family_groups
  WHERE upper(invite_code) = upper(trim(code));

  IF target_group.id IS NULL THEN
    RAISE EXCEPTION 'Código de convite inválido ou não encontrado.';
  END IF;

  SELECT count(*) INTO member_count
  FROM public.profiles
  WHERE family_group_id = target_group.id
    AND id <> auth.uid();

  IF member_count >= 2 THEN
    RAISE EXCEPTION 'Este Grupo Familiar já possui 2 membros vinculados.';
  END IF;

  UPDATE public.profiles
  SET family_group_id = target_group.id,
      role_label = COALESCE(NULLIF(trim(user_role_label), ''), role_label),
      updated_at = now()
  WHERE id = auth.uid();

  RETURN target_group;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_price_history ENABLE ROW LEVEL SECURITY;

-- Políticas: family_groups
CREATE POLICY "Membros podem ver seu FamilyGroup"
  ON public.family_groups FOR SELECT
  USING (id = public.get_my_family_group_id() OR created_by = auth.uid());

CREATE POLICY "Usuários autenticados podem criar FamilyGroup"
  ON public.family_groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Membros podem atualizar seu FamilyGroup"
  ON public.family_groups FOR UPDATE
  USING (id = public.get_my_family_group_id());

-- Políticas: profiles
CREATE POLICY "Usuários veem o próprio perfil e o do cônjuge no mesmo FamilyGroup"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (family_group_id IS NOT NULL AND family_group_id = public.get_my_family_group_id())
  );

CREATE POLICY "Usuários podem inserir o próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Usuários podem atualizar o próprio perfil"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Políticas: monthly_budgets
CREATE POLICY "Casal gerencia o próprio orçamento mensal"
  ON public.monthly_budgets FOR ALL
  USING (family_group_id = public.get_my_family_group_id())
  WITH CHECK (family_group_id = public.get_my_family_group_id());

-- Políticas: expenses
CREATE POLICY "Casal gerencia os próprios gastos"
  ON public.expenses FOR ALL
  USING (family_group_id = public.get_my_family_group_id())
  WITH CHECK (family_group_id = public.get_my_family_group_id());

-- Políticas: financial_goals
CREATE POLICY "Casal gerencia as próprias metas financeiras"
  ON public.financial_goals FOR ALL
  USING (family_group_id = public.get_my_family_group_id())
  WITH CHECK (family_group_id = public.get_my_family_group_id());

-- Políticas: goal_price_history
CREATE POLICY "Casal gerencia histórico de preços de suas metas"
  ON public.goal_price_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_goals fg
      WHERE fg.id = goal_price_history.goal_id
        AND fg.family_group_id = public.get_my_family_group_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_goals fg
      WHERE fg.id = goal_price_history.goal_id
        AND fg.family_group_id = public.get_my_family_group_id()
    )
  );
