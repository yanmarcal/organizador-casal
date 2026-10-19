'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Expense, FinancialGoal } from '@/lib/types/database.types';
import GoalCard from '@/components/goals/GoalCard';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import {
  HeartHandshake,
  Target,
  Plus,
  ArrowLeft,
  PiggyBank,
  Sparkles,
  Calculator,
  Link2,
} from 'lucide-react';
import {
  STORAGE_KEY_GOALS,
  STORAGE_KEY_EXPENSES,
  STORAGE_KEY_INCOME,
  DEFAULT_GROUP_ID,
  INITIAL_SAMPLE_GOALS,
} from '@/lib/constants/goals';

export default function MetasPage() {
  const { currentUser, familyGroup, isSupabaseReady } = useCoupleAuth();

  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [availableMonthlyBalance, setAvailableMonthlyBalance] = useState<number>(7099.6);

  // Formulário para criar um novo card de Meta (ex: "Comprar PS5")
  const [title, setTitle] = useState('');
  const [targetPrice, setTargetPrice] = useState('3500');
  const [targetDate, setTargetDate] = useState('2026-12-15');
  const [productUrl, setProductUrl] = useState('');

  useEffect(() => {
    const loadGoalsAndBalance = async () => {
      if (isSupabaseReady && familyGroup) {
        const supabase = createClient();
        // Tenta ler da tabela `goals` criada no Passo 4 (com fallback para `financial_goals`)
        const { data: goalsData, error } = await supabase
          .from('goals')
          .select('*')
          .eq('family_group_id', familyGroup.id)
          .order('created_at', { ascending: false });

        if (!error && goalsData) {
          setGoals(
            goalsData.map((g) => ({
              ...g,
              target_price: Number(g.target_price),
              current_saved: Number(g.current_saved || 0),
              interest_rate_monthly: Number(g.interest_rate_monthly || 0),
            })) as FinancialGoal[]
          );
          return;
        }
      }

      // Carrega o Saldo Disponível atual da planilha do casal
      const savedIncome = Number(localStorage.getItem(STORAGE_KEY_INCOME) || '12000');
      const savedExpensesRaw = localStorage.getItem(STORAGE_KEY_EXPENSES);
      const savedExpenses: Expense[] = savedExpensesRaw ? JSON.parse(savedExpensesRaw) : [];
      const sumExp = savedExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      setAvailableMonthlyBalance(savedIncome - sumExp);

      const savedGoalsRaw = localStorage.getItem(STORAGE_KEY_GOALS);
      if (savedGoalsRaw) {
        setGoals(JSON.parse(savedGoalsRaw));
      } else {
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(INITIAL_SAMPLE_GOALS));
        setGoals(INITIAL_SAMPLE_GOALS);
      }
    };

    loadGoalsAndBalance();
  }, [familyGroup, isSupabaseReady]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = parseFloat(targetPrice.replace(',', '.'));
    if (!title.trim() || isNaN(parsedTarget) || parsedTarget <= 0) return;

    const newGoalPayload: Omit<FinancialGoal, 'id' | 'created_at'> = {
      family_group_id: familyGroup?.id || DEFAULT_GROUP_ID,
      title: title.trim(),
      target_price: parsedTarget,
      current_saved: 0,
      target_date: targetDate || '2026-12-15',
      product_url: productUrl.trim() || null,
      product_query: title.trim(),
      interest_rate_monthly: 0,
      max_installments: 10,
    };

    if (isSupabaseReady && familyGroup) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('goals')
        .insert(newGoalPayload)
        .select('*')
        .single();
      if (!error && data) {
        setGoals((prev) => [
          {
            ...(data as FinancialGoal),
            target_price: Number(data.target_price),
            current_saved: Number(data.current_saved || 0),
            interest_rate_monthly: Number(data.interest_rate_monthly || 0),
          },
          ...prev,
        ]);
      }
    } else {
      const created: FinancialGoal = {
        ...newGoalPayload,
        id: 'goal-' + Date.now(),
        created_at: new Date().toISOString(),
      };
      const next = [created, ...goals];
      setGoals(next);
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
    }

    setTitle('');
    setTargetPrice('3500');
    setProductUrl('');
  };

  const handleUpdateGoal = async (updated: FinancialGoal) => {
    if (isSupabaseReady) {
      const supabase = createClient();
      await supabase
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
    }

    setGoals((prev) => {
      const next = prev.map((g) => (g.id === updated.id ? updated : g));
      if (!isSupabaseReady) {
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleDeleteGoal = async (id: string) => {
    if (isSupabaseReady) {
      const supabase = createClient();
      await supabase.from('goals').delete().eq('id', id);
    }

    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (!isSupabaseReady) {
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
      }
      return next;
    });
  };

  const totalGoalsTarget = useMemo(
    () => goals.reduce((acc, g) => acc + g.target_price, 0),
    [goals]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">Marçal Contas</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Passo 4: Motor de Metas ("Missão PS5")
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Planejamento de Metas de Yan & Larissa ({currentUser?.full_name || 'Casal'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              Voltar para Planilha de Gastos
            </Link>
          </div>
        </div>
      </header>

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
              Baseado na Receita Total menos os gastos da planilha.
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
              Vinculadas ao <code>family_group_id</code> de Yan & Larissa.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-sky-400" />
              Calculadora Inteligente
            </span>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Calcula automaticamente quanto poupar por mês para comprar <strong>À Vista</strong> e
              simula parcelas de <strong>10x ou 12x</strong> no cartão com alerta de impacto.
            </p>
          </div>
        </section>

        {/* Formulário de Criação de Nova Meta (Nome, Preço Alvo, Prazo, URL do Produto) */}
        <section className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Criar Nova Meta Financeira (Tabela <code>goals</code>)
          </h2>

          <form
            onSubmit={handleCreateGoal}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome da Meta
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Comprar PS5"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Preço Alvo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="3500"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Prazo (Data)
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                Adicionar Meta
              </button>
            </div>
          </form>
        </section>

        {/* Grid de Cards das Metas */}
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
      </main>
    </div>
  );
}
