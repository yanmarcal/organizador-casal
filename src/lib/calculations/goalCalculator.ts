export interface GoalSimulationInput {
  targetPrice: number;
  currentSaved: number;
  targetDate: string; // YYYY-MM-DD
  installments: number;
  monthlyInterestRatePercent: number; // ex: 0 para sem juros, 1.99 para 1.99% a.m.
  currentMonthlyAvailableBalance: number;
  referenceDate?: Date;
}

export interface GoalSimulationResult {
  remainingAmount: number;
  monthsUntilDeadline: number;
  /** Simulação 1: Compra À Vista (Economia mensal até o prazo) */
  cashPlan: {
    monthlySavingsCouple: number;
    monthlySavingsPerPartner: number;
    fitsInCurrentBalance: boolean;
    projectedMonthlyBalanceAfterSavings: number;
    percentageOfAvailableBalance: number;
  };
  /** Simulação 2: Compra Parcelada no Cartão */
  installmentPlan: {
    installments: number;
    monthlyInterestRatePercent: number;
    monthlyInstallmentCouple: number;
    monthlyInstallmentPerPartner: number;
    totalPaidWithInterest: number;
    totalInterestPaid: number;
    fitsInCurrentBalance: boolean;
    projectedFutureMonthlyBalance: number;
    percentageOfAvailableBalance: number;
  };
}

/**
 * Calcula quantos meses restam entre a data de referência e a data alvo (mínimo de 1 mês).
 */
export function calculateMonthsUntil(targetDateStr: string, refDate: Date = new Date()): number {
  const [yearStr, monthStr] = targetDateStr.split('-');
  const targetYear = Number(yearStr);
  const targetMonth = Number(monthStr); // 1..12

  if (!targetYear || !targetMonth) return 1;

  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth() + 1;

  const diffMonths = (targetYear - refYear) * 12 + (targetMonth - refMonth) + 1;
  return Math.max(1, diffMonths);
}

/**
 * Motor de simulação financeira de metas (À Vista vs. Parcelado com/sem juros via Tabela Price).
 */
export function simulateFinancialGoal(input: GoalSimulationInput): GoalSimulationResult {
  const remainingAmount = Math.max(0, input.targetPrice - input.currentSaved);
  const monthsUntilDeadline = calculateMonthsUntil(input.targetDate, input.referenceDate);

  // 1. Simulação À Vista (Poupança mensal até o prazo)
  const monthlySavingsCouple = Number((remainingAmount / monthsUntilDeadline).toFixed(2));
  const monthlySavingsPerPartner = Number((monthlySavingsCouple / 2).toFixed(2));
  const projectedMonthlyBalanceAfterSavings = Number(
    (input.currentMonthlyAvailableBalance - monthlySavingsCouple).toFixed(2)
  );
  const cashPct =
    input.currentMonthlyAvailableBalance > 0
      ? Math.round((monthlySavingsCouple / input.currentMonthlyAvailableBalance) * 100)
      : 100;

  // 2. Simulação Parcelada no Cartão (Sem juros ou com juros compostos - Tabela Price)
  const n = Math.max(1, Math.round(input.installments || 1));
  const i = Math.max(0, Number(input.monthlyInterestRatePercent) || 0) / 100;

  let monthlyInstallmentCouple = 0;
  if (remainingAmount === 0) {
    monthlyInstallmentCouple = 0;
  } else if (i === 0) {
    monthlyInstallmentCouple = remainingAmount / n;
  } else {
    const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    monthlyInstallmentCouple = remainingAmount * factor;
  }

  monthlyInstallmentCouple = Number(monthlyInstallmentCouple.toFixed(2));
  const monthlyInstallmentPerPartner = Number((monthlyInstallmentCouple / 2).toFixed(2));
  const totalPaidWithInterest = Number((monthlyInstallmentCouple * n).toFixed(2));
  const totalInterestPaid = Math.max(
    0,
    Number((totalPaidWithInterest - remainingAmount).toFixed(2))
  );

  const projectedFutureMonthlyBalance = Number(
    (input.currentMonthlyAvailableBalance - monthlyInstallmentCouple).toFixed(2)
  );
  const installmentPct =
    input.currentMonthlyAvailableBalance > 0
      ? Math.round((monthlyInstallmentCouple / input.currentMonthlyAvailableBalance) * 100)
      : 100;

  return {
    remainingAmount,
    monthsUntilDeadline,
    cashPlan: {
      monthlySavingsCouple,
      monthlySavingsPerPartner,
      fitsInCurrentBalance: projectedMonthlyBalanceAfterSavings >= 0,
      projectedMonthlyBalanceAfterSavings,
      percentageOfAvailableBalance: cashPct,
    },
    installmentPlan: {
      installments: n,
      monthlyInterestRatePercent: input.monthlyInterestRatePercent,
      monthlyInstallmentCouple,
      monthlyInstallmentPerPartner,
      totalPaidWithInterest,
      totalInterestPaid,
      fitsInCurrentBalance: projectedFutureMonthlyBalance >= 0,
      projectedFutureMonthlyBalance,
      percentageOfAvailableBalance: installmentPct,
    },
  };
}
