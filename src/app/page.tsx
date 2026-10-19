'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/types/database.types';
import SummaryHeader from '@/components/dashboard/SummaryHeader';
import SplitwiseBalanceCard from '@/components/dashboard/SplitwiseBalanceCard';
import ExpensesDataGrid from '@/components/grid/ExpensesDataGrid';
import PayerFilterTabs, { type ExpenseTabFilter } from '@/components/grid/PayerFilterTabs';
import { calculateCoupleSplitwise } from '@/lib/calculations/splitwise';
import {
  HeartHandshake,
  Users,
  Copy,
  Check,
  LogOut,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
} from 'lucide-react';

const STORAGE_KEY_EXPENSES = 'marcal_contas_expenses_v2';
const STORAGE_KEY_INCOME = 'marcal_contas_monthly_income_v2';

const DEFAULT_GROUP_ID = '11111111-1111-1111-1111-111111111111';
const YAN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LARISSA_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const INITIAL_SAMPLE_EXPENSES: Expense[] = [
  {
    id: '10000000-0000-0000-0000-000000000101',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-05',
    description: 'Aluguel + Condomínio',
    amount: 2800.0,
    category: 'Moradia',
    payer_type: 'SHARED',
    paid_by_user_id: YAN_ID,
    created_by: YAN_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000102',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-08',
    description: 'Supermercado Atacadão (Mês)',
    amount: 1150.5,
    category: 'Mercado',
    payer_type: 'SHARED',
    paid_by_user_id: LARISSA_ID,
    created_by: LARISSA_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000103',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-12',
    description: 'Fone Bluetooth / Setup Home Office',
    amount: 320.0,
    category: 'Compras',
    payer_type: 'USER_A',
    paid_by_user_id: YAN_ID,
    created_by: YAN_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000104',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-14',
    description: 'Consulta Médica & Farmácia',
    amount: 240.0,
    category: 'Saúde',
    payer_type: 'USER_B',
    paid_by_user_id: LARISSA_ID,
    created_by: LARISSA_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000105',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-16',
    description: 'Internet Fibra + Energia Elétrica',
    amount: 389.9,
    category: 'Moradia',
    payer_type: 'SHARED',
    paid_by_user_id: YAN_ID,
    created_by: YAN_ID,
  },
];

export default function HomePage() {
  const {
    currentUser,
    partnerUser,
    familyGroup,
    loading,
    isSupabaseReady,
    activeDemoRole,
    switchDemoRole,
    signOut,
  } = useCoupleAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(12000);
  const [activeTab, setActiveTab] = useState<ExpenseTabFilter>('ALL_SHARED');
  const [copied, setCopied] = useState(false);
  const [showCoupleDetails, setShowCoupleDetails] = useState(false);

  // Resolve dinamicamente os IDs de Yan e Larissa a partir dos perfis reais logados no Supabase
  const resolvedYanId = useMemo(() => {
    if (currentUser?.role_label !== 'Larissa' && currentUser?.role_label !== 'Esposa') {
      return currentUser?.id || YAN_ID;
    }
    return partnerUser?.id || YAN_ID;
  }, [currentUser, partnerUser]);

  const resolvedLarissaId = useMemo(() => {
    if (currentUser?.role_label === 'Larissa' || currentUser?.role_label === 'Esposa') {
      return currentUser?.id || LARISSA_ID;
    }
    return partnerUser?.id || LARISSA_ID;
  }, [currentUser, partnerUser]);

  const targetGroupId = familyGroup?.id || currentUser?.family_group_id || null;

  // Função reutilizável para buscar os gastos mais recentes do Supabase (Refetch)
  const fetchExpensesFromSupabase = React.useCallback(async () => {
    if (!isSupabaseReady) return;
    const supabase = createClient();

    let query = supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (targetGroupId) {
      query = query.eq('family_group_id', targetGroupId);
    }

    const { data: expData, error } = await query;
    if (!error && expData) {
      setExpenses(
        expData.map((item) => ({
          ...(item as Expense),
          amount: Number(item.amount),
        }))
      );
    }
  }, [isSupabaseReady, targetGroupId]);

  // Carrega Receita Mensal e Gastos (do Supabase se configurado ou LocalStorage) + Realtime
  useEffect(() => {
    const loadBudgetAndExpenses = async () => {
      if (isSupabaseReady) {
        if (!currentUser) return;
        const supabase = createClient();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        if (targetGroupId) {
          const { data: budgetData } = await supabase
            .from('monthly_budgets')
            .select('*')
            .eq('family_group_id', targetGroupId)
            .eq('year', year)
            .eq('month', month)
            .maybeSingle();

          if (budgetData) {
            setTotalIncome(Number(budgetData.total_income));
          }
        }

        await fetchExpensesFromSupabase();
        return;
      }

      // Modo Local / Sandbox
      const savedIncome = localStorage.getItem(STORAGE_KEY_INCOME);
      if (savedIncome !== null) {
        setTotalIncome(Number(savedIncome));
      } else {
        localStorage.setItem(STORAGE_KEY_INCOME, '12000');
      }

      const savedExpenses = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (savedExpenses) {
        setExpenses(JSON.parse(savedExpenses));
      } else {
        localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(INITIAL_SAMPLE_EXPENSES));
        setExpenses(INITIAL_SAMPLE_EXPENSES);
      }
    };

    loadBudgetAndExpenses();

    // Assinatura Realtime no Supabase para atualizar a planilha automaticamente
    if (isSupabaseReady && currentUser) {
      const supabase = createClient();
      const channel = supabase
        .channel('realtime-expenses-grid')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          () => {
            fetchExpensesFromSupabase();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser, targetGroupId, isSupabaseReady, fetchExpensesFromSupabase]);

  const totalExpenses = useMemo(
    () => expenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [expenses]
  );

  // Cálculo Splitwise e totais por aba (Passo 3)
  const splitwiseSummary = useMemo(
    () => calculateCoupleSplitwise(expenses, resolvedYanId, resolvedLarissaId),
    [expenses, resolvedYanId, resolvedLarissaId]
  );

  const yanExpenses = useMemo(
    () =>
      expenses.filter(
        (e) => e.payer_type === 'USER_A' || e.paid_by_user_id === resolvedYanId
      ),
    [expenses, resolvedYanId]
  );

  const larissaExpenses = useMemo(
    () =>
      expenses.filter(
        (e) => e.payer_type === 'USER_B' || e.paid_by_user_id === resolvedLarissaId
      ),
    [expenses, resolvedLarissaId]
  );

  const tabCounts = useMemo(
    () => ({
      allShared: expenses.length,
      yan: yanExpenses.length,
      larissa: larissaExpenses.length,
    }),
    [expenses, yanExpenses, larissaExpenses]
  );

  const tabTotals = useMemo(
    () => ({
      allShared: totalExpenses,
      yan: yanExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
      larissa: larissaExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    }),
    [totalExpenses, yanExpenses, larissaExpenses]
  );

  const filteredExpenses = useMemo(() => {
    if (activeTab === 'MINE_YAN') return yanExpenses;
    if (activeTab === 'HERS_LARISSA') return larissaExpenses;
    return expenses;
  }, [expenses, yanExpenses, larissaExpenses, activeTab]);

  const handleUpdateIncome = async (newIncome: number) => {
    setTotalIncome(newIncome);
    if (isSupabaseReady && targetGroupId) {
      const supabase = createClient();
      const now = new Date();
      await supabase.from('monthly_budgets').upsert(
        {
          family_group_id: targetGroupId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          total_income: newIncome,
        },
        { onConflict: 'family_group_id,year,month' }
      );
      return;
    }
    localStorage.setItem(STORAGE_KEY_INCOME, String(newIncome));
  };

  const handleAddExpense = async (newExpenseData: Omit<Expense, 'id' | 'created_at'>) => {
    // 1. Atualização Otimista Imediata no Estado do React (Planilha + Dashboard mudam na hora!)
    const tempId = 'temp-' + Date.now();
    const optimisticExpense: Expense = {
      ...newExpenseData,
      family_group_id: targetGroupId || newExpenseData.family_group_id,
      amount: Number(newExpenseData.amount),
      id: tempId,
      created_at: new Date().toISOString(),
    };

    setExpenses((prev) => [optimisticExpense, ...prev]);

    if (isSupabaseReady) {
      const supabase = createClient();
      const payloadToInsert = {
        ...newExpenseData,
        family_group_id: targetGroupId || newExpenseData.family_group_id,
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert(payloadToInsert)
        .select('*')
        .single();

      if (!error && data) {
        setExpenses((prev) =>
          prev.map((item) =>
            item.id === tempId ? { ...(data as Expense), amount: Number(data.amount) } : item
          )
        );
      }

      // 2. Faz o refetch completo do Supabase para garantir sincronia 100% com o banco
      await fetchExpensesFromSupabase();
      return;
    }

    // Modo Local
    setExpenses((prev) => {
      const nextList = prev.map((item) =>
        item.id === tempId ? { ...item, id: 'exp-' + Date.now() } : item
      );
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(nextList));
      return nextList;
    });
  };

  const handleUpdateExpense = async (updated: Expense) => {
    // Atualização otimista imediata no estado local
    setExpenses((prev) => {
      const nextList = prev.map((item) =>
        item.id === updated.id ? { ...updated, amount: Number(updated.amount) } : item
      );
      if (!isSupabaseReady) {
        localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(nextList));
      }
      return nextList;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      await supabase
        .from('expenses')
        .update({
          expense_date: updated.expense_date,
          description: updated.description,
          amount: Number(updated.amount),
          category: updated.category,
          payer_type: updated.payer_type,
          paid_by_user_id: updated.paid_by_user_id,
        })
        .eq('id', updated.id);

      await fetchExpensesFromSupabase();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    // Remoção otimista imediata no estado local
    setExpenses((prev) => {
      const nextList = prev.filter((item) => item.id !== id);
      if (!isSupabaseReady) {
        localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(nextList));
      }
      return nextList;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      await supabase.from('expenses').delete().eq('id', id);
      await fetchExpensesFromSupabase();
    }
  };

  const copyInviteCode = () => {
    if (!familyGroup?.invite_code) return;
    navigator.clipboard.writeText(familyGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Carregando planilha financeira do casal...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-center">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4">
          <HeartHandshake className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Marçal Contas</h1>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Organização financeira inteligente para casais. Entre ou cadastre-se para acessar a
          planilha compartilhada do seu Grupo Familiar.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition"
          >
            Criar Conta de Casal
          </Link>
        </div>
      </div>
    );
  }

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
                  Passos 1 a 4 Ativos
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grupo:{' '}
                <strong className="text-slate-200">
                  {familyGroup ? familyGroup.name : 'Casal'}
                </strong>{' '}
                • Logado como <strong className="text-emerald-400">{currentUser.full_name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/metas"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition"
            >
              <Target className="w-3.5 h-3.5" />
              Metas Financeiras
            </Link>

            <button
              type="button"
              onClick={() => setShowCoupleDetails((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-slate-700 flex items-center gap-1.5 transition"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Vínculo do Casal ({familyGroup?.invite_code})
              {showCoupleDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => switchDemoRole('USER_A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeDemoRole === 'USER_A'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👤 Yan
              </button>
              <button
                type="button"
                onClick={() => switchDemoRole('USER_B')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeDemoRole === 'USER_B'
                    ? 'bg-purple-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👩‍❤️‍👨 Larissa
              </button>
            </div>

            <Link
              href="/login"
              onClick={() => signOut()}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
              title="Sair / Trocar Conta"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Gaveta Expansível com Detalhes do FamilyGroup (Passo 1) */}
        {showCoupleDetails && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Parceiro 1 (Você)</span>
              <strong className="text-white text-sm block">{currentUser.full_name}</strong>
              <code className="text-emerald-400 text-[11px]">ID: {currentUser.id}</code>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Parceiro 2 (Vinculado)</span>
              <strong className="text-white text-sm block">
                {partnerUser ? partnerUser.full_name : 'Aguardando vínculo...'}
              </strong>
              <code className="text-purple-400 text-[11px]">
                ID: {partnerUser ? partnerUser.id : '---'}
              </code>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block mb-1">Código do FamilyGroup</span>
                <strong className="font-mono text-emerald-400 text-sm tracking-widest">
                  {familyGroup?.invite_code}
                </strong>
              </div>
              <button
                type="button"
                onClick={copyInviteCode}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Passo 2 & 3: Painel de Dashboard no Topo (Receita Total - Gastos = Saldo Disponível + Balanço Splitwise ao lado) */}
        <SummaryHeader
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          onUpdateIncome={handleUpdateIncome}
          selectedMonthLabel="Outubro / 2026"
          splitwiseSummary={splitwiseSummary}
        />

        {/* Passo 3: Card de Balanço Estilo Splitwise (Quem pagou mais da casa e valor de repasse) */}
        <SplitwiseBalanceCard
          summary={splitwiseSummary}
          userAName="Yan"
          userBName="Larissa"
        />

        {/* Passo 3: Sistema de Abas Rápidas (Todos, Meus Gastos, Gastos Dela, Gastos Compartilhados) */}
        <PayerFilterTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={tabCounts}
          totals={tabTotals}
        />

        {/* Passo 2 & 3: Planilha Superpoderosa AG Grid filtrada pela aba ativa */}
        <ExpensesDataGrid
          expenses={filteredExpenses}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          familyGroupId={targetGroupId || DEFAULT_GROUP_ID}
          currentUserId={currentUser.id}
          userAId={resolvedYanId}
          userBId={resolvedLarissaId}
        />
      </main>
    </div>
  );
}
