export type PayerType = 'USER_A' | 'USER_B' | 'SHARED';
export type SplitMode = 'FIFTY_FIFTY' | 'PROPORTIONAL';

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  family_group_id: string | null;
  full_name: string;
  role_label: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBudget {
  id: string;
  family_group_id: string;
  year: number;
  month: number;
  partner_1_income: number;
  partner_2_income: number;
  total_income: number;
  split_mode: SplitMode;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  family_group_id: string;
  expense_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  payer_type: PayerType; // 'USER_A' (Eu), 'USER_B' (Esposa) ou 'SHARED' (Dividido)
  paid_by_user_id: string | null;
  created_by: string | null;
  created_at?: string;
}

export interface FinancialGoal {
  id: string;
  family_group_id: string;
  title: string;
  target_price: number;
  current_saved: number;
  target_date: string; // YYYY-MM-DD
  product_url: string | null;
  product_query: string | null;
  interest_rate_monthly: number;
  max_installments: number;
  created_at?: string;
}

export interface GoalPriceHistory {
  id: string;
  goal_id: string;
  recorded_price: number;
  source_store: string;
  recorded_at: string;
}

export interface CoupleContextState {
  currentUser: Profile;
  partnerUser: Profile | null;
  familyGroup: FamilyGroup;
  isConfiguredSupabase: boolean;
}
