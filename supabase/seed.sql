-- =============================================================================
-- MARÇAL_CONTAS - SEED INICIAL DE TESTE (CASAL: YAN & LARISSA)
-- =============================================================================
-- Cria o Grupo Familiar "Família Marçal" e insere os dois usuários de teste
-- "Yan" e "Larissa" tanto em auth.users quanto em public.profiles vinculados
-- ao mesmo family_group_id.
-- Senha padrão dos usuários de teste no Supabase Auth: Marcal123!
-- =============================================================================

DO $$
DECLARE
  v_group_id uuid := '11111111-1111-1111-1111-111111111111';
  v_yan_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_larissa_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  -- 1. Verifica ou cria o usuário "Yan" no Supabase Auth (auth.users)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'yan@marcalcontas.com') THEN
    SELECT id INTO v_yan_id FROM auth.users WHERE email = 'yan@marcalcontas.com' LIMIT 1;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_yan_id,
      'authenticated',
      'authenticated',
      'yan@marcalcontas.com',
      crypt('Marcal123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Yan","role_label":"Yan"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- 2. Verifica ou cria a usuária "Larissa" no Supabase Auth (auth.users)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'larissa@marcalcontas.com') THEN
    SELECT id INTO v_larissa_id FROM auth.users WHERE email = 'larissa@marcalcontas.com' LIMIT 1;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_larissa_id,
      'authenticated',
      'authenticated',
      'larissa@marcalcontas.com',
      crypt('Marcal123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Larissa","role_label":"Larissa"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- 3. Cria o Grupo Familiar (family_groups) compartilhado pelo casal Yan & Larissa
  INSERT INTO public.family_groups (id, name, invite_code, created_by)
  VALUES (v_group_id, 'Família Marçal (Yan & Larissa)', 'MARCAL-26', v_yan_id)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        invite_code = EXCLUDED.invite_code;

  -- 4. Garante o vínculo de "Yan" e "Larissa" na tabela public.profiles sob o mesmo family_group_id
  INSERT INTO public.profiles (id, family_group_id, full_name, role_label, email)
  VALUES
    (v_yan_id, v_group_id, 'Yan', 'Yan', 'yan@marcalcontas.com'),
    (v_larissa_id, v_group_id, 'Larissa', 'Larissa', 'larissa@marcalcontas.com')
  ON CONFLICT (id) DO UPDATE
    SET family_group_id = EXCLUDED.family_group_id,
        full_name = EXCLUDED.full_name,
        role_label = EXCLUDED.role_label,
        email = EXCLUDED.email,
        updated_at = now();

  -- 5. Cria o orçamento mensal inicial do casal (Outubro/2026)
  INSERT INTO public.monthly_budgets (family_group_id, year, month, partner_1_income, partner_2_income, total_income)
  VALUES (v_group_id, 2026, 10, 6500.00, 5500.00, 12000.00)
  ON CONFLICT (family_group_id, year, month) DO NOTHING;

END $$;
