import type { FinancialGoal } from '@/lib/types/database.types';

export const STORAGE_KEY_GOALS = 'marcal_contas_goals_v2';
export const STORAGE_KEY_EXPENSES = 'marcal_contas_expenses_v2';
export const STORAGE_KEY_INCOME = 'marcal_contas_monthly_income_v2';

export const DEFAULT_GROUP_ID = '11111111-1111-1111-1111-111111111111';

export const INITIAL_SAMPLE_GOALS: FinancialGoal[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    family_group_id: DEFAULT_GROUP_ID,
    title: 'Comprar PS5',
    target_price: 3500.0,
    current_saved: 0.0,
    target_date: '2026-12-15',
    product_url: 'https://www.amazon.com.br/PlayStation-5-Slim',
    product_query: 'Console PlayStation 5 Slim 1TB',
    interest_rate_monthly: 0,
    max_installments: 10,
    created_at: new Date().toISOString(),
  },
];
