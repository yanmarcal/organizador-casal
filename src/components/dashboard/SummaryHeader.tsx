'use client';

import React, { useState } from 'react';
import { Wallet, TrendingDown, PiggyBank, Scale, Edit3, Check, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import type { SplitwiseSummary } from '@/lib/calculations/splitwise';

interface SummaryHeaderProps {
  totalIncome: number;
  totalExpenses: number;
  onUpdateIncome: (newIncome: number) => void;
  selectedMonthLabel: string;
  splitwiseSummary?: SplitwiseSummary;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function SummaryHeader({
  totalIncome,
  totalExpenses,
  onUpdateIncome,
  selectedMonthLabel,
  splitwiseSummary,
}: SummaryHeaderProps) {
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState(String(totalIncome));

  const availableBalance = totalIncome - totalExpenses;
  const spentPercentage =
    totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(incomeInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateIncome(parsed);
    }
    setEditingIncome(false);
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Receita Total do Mês */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Receita do Mês ({selectedMonthLabel})
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            {editingIncome ? (
              <form onSubmit={handleSaveIncome} className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-emerald-500 rounded-xl text-base font-bold text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
                  title="Salvar Receita"
                >
                  <Check className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{formatBRL(totalIncome)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIncomeInput(String(totalIncome));
                    setEditingIncome(true);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar
                </button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Orçamento familiar compartilhado (Yan & Larissa).
          </p>
        </div>

        {/* Card 2: Total de Gastos na Planilha */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Soma dos Gastos
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{formatBRL(totalExpenses)}</span>
            <span className="text-xs font-medium text-slate-400">
              {spentPercentage}% da receita
            </span>
          </div>

          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden mt-2 border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                spentPercentage >= 90
                  ? 'bg-rose-500'
                  : spentPercentage >= 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${spentPercentage}%` }}
            />
          </div>
        </div>

        {/* Card 3: Saldo Disponível em Tempo Real */}
        <div
          className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-between transition ${
            availableBalance >= 0
              ? 'bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 border-emerald-500/40'
              : 'bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-900 border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Saldo Disponível
            </span>
            <div
              className={`p-2 rounded-xl border ${
                availableBalance >= 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <span
              className={`text-2xl font-extrabold tracking-tight ${
                availableBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatBRL(availableBalance)}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Receita Total menos a soma dos gastos da planilha.
          </p>
        </div>

        {/* Card 4: Balanço do Mês (Splitwise) ao lado do Saldo Disponível */}
        {splitwiseSummary && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-950/50 via-slate-900 to-purple-950/30 border border-sky-500/40 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                Balanço do Mês (Splitwise)
              </span>
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <Scale className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              {splitwiseSummary.settlementStatus === 'SETTLED' ? (
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-lg">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Contas em dia!</span>
                </div>
              ) : splitwiseSummary.settlementStatus === 'USER_B_OWES_USER_A' ? (
                <div>
                  <span className="text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 shrink-0 text-amber-400" />
                    Larissa deve {formatBRL(splitwiseSummary.settlementAmount)} para Yan este mês
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 shrink-0 text-amber-400" />
                    Yan deve {formatBRL(splitwiseSummary.settlementAmount)} para Larissa este mês
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span>Yan pagou: <strong className="text-emerald-300">{formatBRL(splitwiseSummary.sharedPaidByUserA)}</strong></span>
              <span>Larissa: <strong className="text-purple-300">{formatBRL(splitwiseSummary.sharedPaidByUserB)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
