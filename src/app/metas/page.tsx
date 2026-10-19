'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCoupleAuth, DEFAULT_GROUP_ID } from '@/lib/context/CoupleAuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Expense, FinancialGoal } from '@/lib/types/database.types';
import AppHeader from '@/components/layout/AppHeader';
import GoalCard from '@/components/goals/GoalCard';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import {
  STORAGE_KEY_GOALS,
} from '@/lib/constants/goals';
import {
  Target,
  Plus,
  PiggyBank,
  Calculator,
  Link2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

const STORAGE_KEY_EXPENSES = 'marcal_contas_expenses_v3';
const STORAGE_KEY_INCOME = 'marcal_contas_monthly_income_v3';

export default function MetasPage() {
  const { currentUser, familyGroup, isSupabaseReady } = useCoupleAuth();

  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [availableMonthlyBalance, setAvailableMonthlyBalance] = useState<number>(7099.6);

  // Formulário com validação para criar nova Meta Financeira
  const [title, setTitle] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetDate, setTargetDate] = useState('2026-12-15');
  const [productUrl, setProductUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetGroupId =
    familyGroup?.id || currentUser?.family_group_id || DEFAULT_GROUP_ID;

  const fetchGoals = useCallback(async () => {
    const savedGoalsRaw = localStorage.getItem(STORAGE_KEY_GOALS);
    const localGoals: FinancialGoal[] = savedGoalsRaw ? JSON.parse(savedGoalsRaw) : [];

    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: goalsData, error } = await supabase
          .from('goals')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && goalsData) {
          const normalized = goalsData.map((g) => ({
            ...(g as FinancialGoal),
            target_price: Number(g.target_price),
            current_saved: Number(g.current_saved || 0),
            interest_rate_monthly: Number(g.interest_rate_monthly || 0),
          }));
          setGoals(normalized);
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(normalized));
          return;
        }
      }
    }

    setGoals(localGoals);
  }, [isSupabaseReady]);

  useEffect(() => {
    const loadBalanceAndGoals = async () => {
      const savedIncome = Number(localStorage.getItem(STORAGE_KEY_INCOME) || '12000');
      const savedExpensesRaw = localStorage.getItem(STORAGE_KEY_EXPENSES);
      const savedExpenses: Expense[] = savedExpensesRaw ? JSON.parse(savedExpensesRaw) : [];
      const sumExp = savedExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      setAvailableMonthlyBalance(savedIncome - sumExp);

      await fetchGoals();
    };

    loadBalanceAndGoals();
  }, [fetchGoals]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedTitle = title.trim();
    const parsedTarget = parseFloat(targetPrice.replace(',', '.'));

    if (!trimmedTitle) {
      setValidationError('Por favor, informe o Nome da Meta (ex: Comprar PS5).');
      return;
    }
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setValidationError('Por favor, informe um Preço Alvo maior que R$ 0,00.');
      return;
    }
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setValidationError('Por favor, selecione uma Data de Prazo válida.');
      return;
    }

    const newGoalPayload: Omit<FinancialGoal, 'id' | 'created_at'> = {
      family_group_id: targetGroupId,
      title: trimmedTitle,
      target_price: Number(parsedTarget.toFixed(2)),
      current_saved: 0,
      target_date: targetDate,
      product_url: productUrl.trim() || null,
      product_query: trimmedTitle,
      interest_rate_monthly: 0,
      max_installments: 10,
    };

    const tempId = 'goal-' + Date.now();
    const optimisticGoal: FinancialGoal = {
      ...newGoalPayload,
      id: tempId,
      created_at: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      // 1. Atualização Otimista Imediata
      setGoals((prev) => {
        const next = [optimisticGoal, ...prev];
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
        return next;
      });

      // 2. Insere no Supabase e faz refetch
      if (isSupabaseReady) {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const { data, error } = await supabase
            .from('goals')
            .insert(newGoalPayload)
            .select('*')
            .single();

          if (!error && data) {
            setGoals((prev) => {
              const next = prev.map((g) =>
                g.id === tempId
                  ? {
                      ...(data as FinancialGoal),
                      target_price: Number(data.target_price),
                      current_saved: Number(data.current_saved || 0),
                      interest_rate_monthly: Number(data.interest_rate_monthly || 0),
                    }
                  : g
              );
              localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
              return next;
            });
            await fetchGoals();
          }
        }
      }

      setTitle('');
      setTargetPrice('');
      setProductUrl('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGoal = async (updated: FinancialGoal) => {
    setGoals((prev) => {
      const next = prev.map((g) => (g.id === updated.id ? { ...updated } : g));
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
      return next;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { error } = await supabase
          .from('goals')
          .update({
            title: updated.title,
            target_price: updated.target_price,
            current_saved: updated.current_saved,
            target_date: updated.target_date,
            max_installments: updated.max_installments,
            interest_rate_monthly: updated.interest_rate_monthly,
            product_url: updated.product_url,
            product_query: updated.product_query,
          })
          .eq('id', updated.id);

        if (!error) {
          await fetchGoals();
        }
      }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
      return next;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { error } = await supabase.from('goals').delete().eq('id', id);
        if (!error) {
          await fetchGoals();
        }
      }
    }
  };

  const totalGoalsTarget = useMemo(
    () => goals.reduce((acc, g) => acc + g.target_price, 0),
    [goals]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Cabeçalho Global Padronizado */}
      <AppHeader />

      {/* Página Dedicada Exclusivamente às Metas Financeiras ("/metas") */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Resumo do Saldo para Simulações */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4" />
              Saldo Disponível Mensal do Casal
            </span>
            <strong className="text-2xl font-extrabold text-emerald-400 block mt-2">
              {formatBRL(availableMonthlyBalance)}
            </strong>
            <p className="text-[11px] text-slate-400 mt-1">
              Sincronizado com o Dashboard de Gastos.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-purple-400" />
              Total em Metas Ativas ({goals.length})
            </span>
            <strong className="text-2xl font-bold text-white block mt-2">
              {formatBRL(totalGoalsTarget)}
            </strong>
            <p className="text-[11px] text-slate-400 mt-1">
              Planeamento de conquistas do casal (Yan & Larissa).
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-sky-400" />
              Simulador À Vista & Parcelado
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Crie uma meta abaixo para calcular automaticamente a poupança mensal à vista, simular
              parcelas (10x/12x) e monitorizar o histórico de preços.
            </p>
          </div>
        </section>

        {/* Formulário de Criação de Nova Meta Financeira */}
        <section className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Adicionar Nova Meta Financeira
          </h2>

          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <form
            onSubmit={handleCreateGoal}
            noValidate
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nome da Meta <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Ex: Comprar PS5"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Preço Alvo (R$) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={targetPrice}
                onChange={(e) => {
                  setTargetPrice(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Ex: 3500"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Prazo (Data) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                URL do Produto (Opcional)
              </label>
              <div className="relative">
                <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://www.amazon.com.br/..."
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                {submitting ? 'A criar...' : 'Adicionar Meta'}
              </button>
            </div>
          </form>
        </section>

        {/* Estado Vazio Limpo ou Grid de Cards */}
        {goals.length === 0 ? (
          <section className="p-12 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              Nenhuma meta financeira criada ainda
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Utilize o formulário acima para criar a sua primeira meta (ex: &quot;Comprar PS5&quot;,
              Preço Alvo: R$ 3.500, Prazo: Dezembro) e simular a compra à vista ou parcelada!
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                availableMonthlyBalance={availableMonthlyBalance}
                isSupabaseReady={isSupabaseReady}
                onUpdateGoal={handleUpdateGoal}
                onDeleteGoal={handleDeleteGoal}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
