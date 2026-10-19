import type { Expense } from '@/lib/types/database.types';

export interface SplitwiseSummary {
  /** Soma de tudo que Yan desembolsou no mês (paid_by_user_id === yanId ou payer_type === 'USER_A') */
  totalPaidByYan: number;
  /** Soma de tudo que Larissa desembolsou no mês (paid_by_user_id === larissaId ou payer_type === 'USER_B') */
  totalPaidByLarissa: number;
  /** Gastos exclusivos de Yan */
  personalUserATotal: number;
  /** Gastos exclusivos de Larissa */
  personalUserBTotal: number;
  /** Total de despesas compartilhadas do grupo familiar */
  sharedHouseholdTotal: number;
  /** Quota justa de cada um nas despesas compartilhadas (50% cada) */
  fairSharePerPartner: number;
  /** Quanto Yan desembolsou nas despesas compartilhadas da casa */
  sharedPaidByUserA: number;
  /** Quanto Larissa desembolsou nas despesas compartilhadas da casa */
  sharedPaidByUserB: number;
  /**
   * Saldo líquido de Yan:
   * > 0: Yan pagou mais despesas compartilhadas -> Larissa deve para Yan
   * < 0: Larissa pagou mais despesas compartilhadas -> Yan deve para Larissa
   * = 0: Contas em dia!
   */
  netBalanceUserA: number;
  settlementStatus: 'USER_B_OWES_USER_A' | 'USER_A_OWES_USER_B' | 'SETTLED';
  settlementAmount: number;
}

/**
 * Calcula o Balanço do Mês (estilo Splitwise) entre Yan e Larissa.
 */
export function calculateCoupleSplitwise(
  expenses: Expense[],
  yanId: string = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  larissaId: string = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
): SplitwiseSummary {
  let totalPaidByYan = 0;
  let totalPaidByLarissa = 0;
  let personalUserATotal = 0;
  let personalUserBTotal = 0;
  let sharedHouseholdTotal = 0;
  let sharedPaidByUserA = 0;
  let sharedPaidByUserB = 0;

  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;

    // Soma geral desembolsada por cada usuário no mês
    if (exp.paid_by_user_id === yanId || exp.payer_type === 'USER_A') {
      totalPaidByYan += amount;
    } else if (exp.paid_by_user_id === larissaId || exp.payer_type === 'USER_B') {
      totalPaidByLarissa += amount;
    }

    // Separação entre Individual e Compartilhado para o rateio Splitwise
    if (exp.payer_type === 'USER_A') {
      personalUserATotal += amount;
    } else if (exp.payer_type === 'USER_B') {
      personalUserBTotal += amount;
    } else {
      // Despesa compartilhada da casa
      sharedHouseholdTotal += amount;
      if (exp.paid_by_user_id === larissaId) {
        sharedPaidByUserB += amount;
      } else if (exp.paid_by_user_id === yanId) {
        sharedPaidByUserA += amount;
      } else {
        sharedPaidByUserA += amount / 2;
        sharedPaidByUserB += amount / 2;
      }
    }
  }

  const fairSharePerPartner = sharedHouseholdTotal / 2;
  const netBalanceUserA = Number((sharedPaidByUserA - fairSharePerPartner).toFixed(2));
  const absDiff = Math.abs(netBalanceUserA);

  let settlementStatus: SplitwiseSummary['settlementStatus'] = 'SETTLED';
  if (absDiff >= 0.01) {
    settlementStatus = netBalanceUserA > 0 ? 'USER_B_OWES_USER_A' : 'USER_A_OWES_USER_B';
  }

  return {
    totalPaidByYan,
    totalPaidByLarissa,
    personalUserATotal,
    personalUserBTotal,
    sharedHouseholdTotal,
    fairSharePerPartner,
    sharedPaidByUserA,
    sharedPaidByUserB,
    netBalanceUserA,
    settlementStatus,
    settlementAmount: absDiff,
  };
}
