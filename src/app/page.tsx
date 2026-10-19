'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useCoupleAuth,
  DEFAULT_GROUP_ID,
  YAN_DEFAULT_ID,
  LARISSA_DEFAULT_ID,
} from '@/lib/context/CoupleAuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/types/database.types';
import AppHeader from '@/components/layout/AppHeader';
import SummaryHeader from '@/components/dashboard/SummaryHeader';
import SplitwiseBalanceCard from '@/components/dashboard/SplitwiseBalanceCard';
import ExpensesDataGrid from '@/components/grid/ExpensesDataGrid';
import PayerFilterTabs, { type ExpenseTabFilter } from '@/components/grid/PayerFilterTabs';
import { calculateCoupleSplitwise } from '@/lib/calculations/splitwise';
import { HeartHandshake } from 'lucide-react';

const STORAGE_KEY_EXPENSES = 'marcal_contas_expenses_v3';
const STORAGE_KEY_INCOME = 'marcal_contas_monthly_income_v3';

const INITIAL_SAMPLE_EXPENSES: Expense[] = [
  {
    id: '10000000-0000-0000-0000-000000000101',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-05',
    description: 'Aluguel + Condomínio',
    amount: 2800.0,
    category: 'Moradia',
    payer_type: 'SHARED',
    paid_by_user_id: YAN_DEFAULT_ID,
    created_by: YAN_DEFAULT_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000102',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-08',
    description: 'Supermercado Atacadão (Mês)',
    amount: 1150.5,
    category: 'Mercado',
    payer_type: 'SHARED',
    paid_by_user_id: LARISSA_DEFAULT_ID,
    created_by: LARISSA_DEFAULT_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000103',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-12',
    description: 'Fone Bluetooth / Setup Home Office',
    amount: 320.0,
    category: 'Compras',
    payer_type: 'USER_A',
    paid_by_user_id: YAN_DEFAULT_ID,
    created_by: YAN_DEFAULT_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000104',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-14',
    description: 'Consulta Médica & Farmácia',
    amount: 240.0,
    category: 'Saúde',
    payer_type: 'USER_B',
    paid_by_user_id: LARISSA_DEFAULT_ID,
    created_by: LARISSA_DEFAULT_ID,
  },
  {
    id: '10000000-0000-0000-0000-000000000105',
    family_group_id: DEFAULT_GROUP_ID,
    expense_date: '2026-10-16',
    description: 'Internet Fibra + Energia Elétrica',
    amount: 389.9,
    category: 'Moradia',
    payer_type: 'SHARED',
    paid_by_user_id: YAN_DEFAULT_ID,
    created_by: YAN_DEFAULT_ID,
  },
];

export default function HomePage() {
  const {
    currentUser,
    partnerUser,
    familyGroup,
    loading,
    isSupabaseReady,
    activeRole,
  } = useCoupleAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(12000);
  const [activeTab, setActiveTab] = useState<ExpenseTabFilter>('ALL_SHARED');

  // Identifica dinamicamente os IDs de Yan e Larissa
  const resolvedYanId = useMemo(() => {
    if (activeRole === 'USER_A') return currentUser?.id || YAN_DEFAULT_ID;
    return partnerUser?.id || YAN_DEFAULT_ID;
  }, [activeRole, currentUser, partnerUser]);

  const resolvedLarissaId = useMemo(() => {
    if (activeRole === 'USER_B') return currentUser?.id || LARISSA_DEFAULT_ID;
    return partnerUser?.id || LARISSA_DEFAULT_ID;
  }, [activeRole, currentUser, partnerUser]);

  const targetGroupId =
    familyGroup?.id || currentUser?.family_group_id || DEFAULT_GROUP_ID;

  // Função central de Refetch: busca gastos no Supabase ou cai para o estado local se o banco estiver vazio/sem sessão
  const fetchExpenses = useCallback(async () => {
    const savedLocal = localStorage.getItem(STORAGE_KEY_EXPENSES);
    const localFallback: Expense[] = savedLocal
      ? JSON.parse(savedLocal)
      : INITIAL_SAMPLE_EXPENSES;

    if (!isSupabaseReady) {
      if (!savedLocal) {
        localStorage.setItem(
          STORAGE_KEY_EXPENSES,
          JSON.stringify(INITIAL_SAMPLE_EXPENSES)
        );
      }
      setExpenses([...localFallback]);
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Se o cliente não tiver sessão autenticada no Supabase, mantém sincronizado no LocalStorage
    if (!session) {
      if (!savedLocal) {
        localStorage.setItem(
          STORAGE_KEY_EXPENSES,
          JSON.stringify(INITIAL_SAMPLE_EXPENSES)
        );
      }
      setExpenses([...localFallback]);
      return;
    }

    const { data: expData, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && expData) {
      const normalized = expData.map((item) => ({
        ...(item as Expense),
        amount: Number(item.amount),
      }));
      setExpenses(normalized);
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(normalized));
    }
  }, [isSupabaseReady]);

  // Carregamento inicial de Receita + Despesas + Assinatura Realtime
  useEffect(() => {
    const loadInitial = async () => {
      const savedIncome = localStorage.getItem(STORAGE_KEY_INCOME);
      if (savedIncome !== null) {
        setTotalIncome(Number(savedIncome));
      }

      if (isSupabaseReady) {
        const supabase = createClient();
        const now = new Date();
        const { data: budgetData } = await supabase
          .from('monthly_budgets')
          .select('*')
          .eq('year', now.getFullYear())
          .eq('month', now.getMonth() + 1)
          .maybeSingle();

        if (budgetData) {
          setTotalIncome(Number(budgetData.total_income));
        }
      }

      await fetchExpenses();
    };

    loadInitial();

    if (isSupabaseReady) {
      const supabase = createClient();
      const channel = supabase
        .channel('expenses-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          () => {
            fetchExpenses();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isSupabaseReady, fetchExpenses]);

  // Soma Total dos Gastos do Mês (sempre sobre o array completo para os Cards Superiores)
  const totalExpenses = useMemo(
    () => expenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [expenses]
  );

  // Cálculo Splitwise em Tempo Real
  const splitwiseSummary = useMemo(
    () => calculateCoupleSplitwise(expenses, resolvedYanId, resolvedLarissaId),
    [expenses, resolvedYanId, resolvedLarissaId]
  );

  // Filtros Instantâneos por Aba ("Meus Gastos (Yan)", "Gastos Dela (Larissa)", "Todos / Compartilhados")
  const yanExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.payer_type === 'USER_A' ||
          (e.payer_type === 'SHARED' && e.paid_by_user_id === resolvedYanId)
      ),
    [expenses, resolvedYanId]
  );

  const larissaExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.payer_type === 'USER_B' ||
          (e.payer_type === 'SHARED' && e.paid_by_user_id === resolvedLarissaId)
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

  // Atualização da Receita Mensal em Tempo Real
  const handleUpdateIncome = async (newIncome: number) => {
    setTotalIncome(newIncome);
    localStorage.setItem(STORAGE_KEY_INCOME, String(newIncome));

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
    }
  };

  // Adição de Despesa com Atualização Imediata + Refetch do Supabase
  const handleAddExpense = async (newExpenseData: Omit<Expense, 'id' | 'created_at'>) => {
    const tempId = 'exp-' + Date.now();
    const optimisticItem: Expense = {
      ...newExpenseData,
      family_group_id: targetGroupId,
      amount: Number(newExpenseData.amount),
      id: tempId,
      created_at: new Date().toISOString(),
    };

    // 1. Atualiza o estado local imediatamente (nova referência de array p/ o AG Grid e Cards)
    setExpenses((prev) => {
      const next = [optimisticItem, ...prev];
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(next));
      return next;
    });

    // 2. Persiste no Supabase e faz refetch ao receber sucesso
    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data, error } = await supabase
          .from('expenses')
          .insert({
            ...newExpenseData,
            family_group_id: targetGroupId,
            amount: Number(newExpenseData.amount),
          })
          .select('*')
          .single();

        if (!error && data) {
          setExpenses((prev) => {
            const next = prev.map((item) =>
              item.id === tempId
                ? { ...(data as Expense), amount: Number(data.amount) }
                : item
            );
            localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(next));
            return next;
          });
          await fetchExpenses();
        }
      }
    }
  };

  // Importação em Lote de Faturas com Atualização Imediata + Refetch
  const handleBatchAddExpenses = async (
    batchItems: Omit<Expense, 'id' | 'created_at'>[]
  ) => {
    if (batchItems.length === 0) return;

    const nowIso = new Date().toISOString();
    const optimisticBatch: Expense[] = batchItems.map((item, idx) => ({
      ...item,
      family_group_id: targetGroupId,
      amount: Number(item.amount),
      id: `exp-batch-${Date.now()}-${idx}`,
      created_at: nowIso,
    }));

    setExpenses((prev) => {
      const next = [...optimisticBatch, ...prev];
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(next));
      return next;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const payload = batchItems.map((item) => ({
          ...item,
          family_group_id: targetGroupId,
          amount: Number(item.amount),
        }));
        const { error } = await supabase.from('expenses').insert(payload);
        if (!error) {
          await fetchExpenses();
        }
      }
    }
  };

  // Edição de Despesa / Troca de Pagador com Atualização Imediata + Refetch
  const handleUpdateExpense = async (updated: Expense) => {
    const normalizedUpdated: Expense = {
      ...updated,
      amount: Number(updated.amount) || 0,
    };

    // 1. Atualiza o estado local imediatamente (forçando re-render dos Cards e do AG Grid)
    setExpenses((prev) => {
      const next = prev.map((item) =>
        item.id === normalizedUpdated.id ? { ...normalizedUpdated } : item
      );
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(next));
      return next;
    });

    // 2. Persiste no Supabase e faz refetch após sucesso
    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { error } = await supabase
          .from('expenses')
          .update({
            expense_date: normalizedUpdated.expense_date,
            description: normalizedUpdated.description,
            amount: normalizedUpdated.amount,
            category: normalizedUpdated.category,
            payer_type: normalizedUpdated.payer_type,
            paid_by_user_id: normalizedUpdated.paid_by_user_id,
          })
          .eq('id', normalizedUpdated.id);

        if (!error) {
          await fetchExpenses();
        }
      }
    }
  };

  // Exclusão de Despesa com Atualização Imediata + Refetch
  const handleDeleteExpense = async (id: string) => {
    setExpenses((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(next));
      return next;
    });

    if (isSupabaseReady) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (!error) {
          await fetchExpenses();
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        A carregar o Dashboard de Gastos...
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
          Organização financeira inteligente para casais. Entre ou cadastre-se para aceder à
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
      {/* Cabeçalho Global Padronizado com Navegação para "/" e "/metas" + Troca de Utilizador */}
      <AppHeader />

      {/* Conteúdo Exclusivo da Página Inicial ("/"): Dashboard de Gastos + Splitwise + Planilha */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* 1. Cartões de Saldo em Tempo Real + Card Resumo Splitwise */}
        <SummaryHeader
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          onUpdateIncome={handleUpdateIncome}
          selectedMonthLabel="Outubro / 2026"
          splitwiseSummary={splitwiseSummary}
        />

        {/* 2. Painel Detalhado Splitwise (Rateio 50/50 entre Yan e Larissa) */}
        <SplitwiseBalanceCard
          summary={splitwiseSummary}
          userAName="Yan"
          userBName="Larissa"
        />

        {/* 3. Abas Instantâneas de Filtro: "Todos / Compartilhados", "Meus Gastos (Yan)", "Gastos Dela (Larissa)" */}
        <PayerFilterTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={tabCounts}
          totals={tabTotals}
        />

        {/* 4. Planilha Editável AG Grid + Formulário com Validação + Importador de Faturas */}
        <ExpensesDataGrid
          expenses={filteredExpenses}
          onAddExpense={handleAddExpense}
          onBatchAddExpenses={handleBatchAddExpenses}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          familyGroupId={targetGroupId}
          currentUserId={currentUser.id}
          activeRole={activeRole}
          userAId={resolvedYanId}
          userBId={resolvedLarissaId}
        />
      </main>
    </div>
  );
}
