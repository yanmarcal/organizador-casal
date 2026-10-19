'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import { createClient } from '@/lib/supabase/client';
import type { FinancialGoal, GoalPriceHistory } from '@/lib/types/database.types';
import { INITIAL_SAMPLE_GOALS, STORAGE_KEY_GOALS } from '@/lib/constants/goals';
import PriceHistoryChart from '@/components/goals/PriceHistoryChart';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import {
  HeartHandshake,
  ArrowLeft,
  Link2,
  Search,
  RefreshCw,
  Plus,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const STORAGE_KEY_PRICE_HISTORY_PREFIX = 'marcal_contas_price_history_';

function buildInitialHistoryForGoal(goalId: string, targetPrice: number): GoalPriceHistory[] {
  const base = targetPrice || 3500;
  return [
    {
      id: `${goalId}-h1`,
      goal_id: goalId,
      recorded_price: Number((base * 1.14).toFixed(2)),
      source_store: 'Amazon Brasil',
      recorded_at: '2026-09-01T10:00:00Z',
    },
    {
      id: `${goalId}-h2`,
      goal_id: goalId,
      recorded_price: Number((base * 1.09).toFixed(2)),
      source_store: 'KaBuM!',
      recorded_at: '2026-09-15T10:00:00Z',
    },
    {
      id: `${goalId}-h3`,
      goal_id: goalId,
      recorded_price: Number((base * 1.11).toFixed(2)),
      source_store: 'Mercado Livre',
      recorded_at: '2026-09-28T10:00:00Z',
    },
    {
      id: `${goalId}-h4`,
      goal_id: goalId,
      recorded_price: Number((base * 1.03).toFixed(2)),
      source_store: 'Amazon Brasil',
      recorded_at: '2026-10-08T10:00:00Z',
    },
    {
      id: `${goalId}-h5`,
      goal_id: goalId,
      recorded_price: Number((base * 0.98).toFixed(2)),
      source_store: 'Promoção KaBuM!',
      recorded_at: '2026-10-18T10:00:00Z',
    },
  ];
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const goalId = params?.id || 'goal-ps5';
  const { isSupabaseReady } = useCoupleAuth();

  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [history, setHistory] = useState<GoalPriceHistory[]>([]);
  const [productUrl, setProductUrl] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualStore, setManualStore] = useState('Amazon Brasil');
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    const loadGoalAndHistory = async () => {
      if (isSupabaseReady) {
        const supabase = createClient();
        const { data: gData } = await supabase
          .from('goals')
          .select('*')
          .eq('id', goalId)
          .maybeSingle();

        if (gData) {
          const parsedGoal: FinancialGoal = {
            ...(gData as FinancialGoal),
            target_price: Number(gData.target_price),
            current_saved: Number(gData.current_saved),
            interest_rate_monthly: Number(gData.interest_rate_monthly),
          };
          setGoal(parsedGoal);
          setProductUrl(parsedGoal.product_url || '');
          setProductQuery(parsedGoal.product_query || parsedGoal.title);

          const { data: hData } = await supabase
            .from('price_history')
            .select('*')
            .eq('goal_id', goalId)
            .order('recorded_at', { ascending: true });

          if (hData && hData.length > 0) {
            setHistory(
              hData.map((h) => ({
                ...h,
                recorded_price: Number(h.recorded_price),
              })) as GoalPriceHistory[]
            );
          } else {
            setHistory(buildInitialHistoryForGoal(goalId, parsedGoal.target_price));
          }
          return;
        }
      }

      // Modo Local / Sandbox
      const rawGoals = localStorage.getItem(STORAGE_KEY_GOALS);
      const allGoals: FinancialGoal[] = rawGoals ? JSON.parse(rawGoals) : INITIAL_SAMPLE_GOALS;
      const found = allGoals.find((g) => g.id === goalId) || INITIAL_SAMPLE_GOALS[0];
      setGoal(found);
      setProductUrl(found.product_url || '');
      setProductQuery(found.product_query || found.title);

      const historyKey = STORAGE_KEY_PRICE_HISTORY_PREFIX + found.id;
      const rawHistory = localStorage.getItem(historyKey);
      if (rawHistory) {
        setHistory(JSON.parse(rawHistory));
      } else {
        const seeded = buildInitialHistoryForGoal(found.id, found.target_price);
        localStorage.setItem(historyKey, JSON.stringify(seeded));
        setHistory(seeded);
      }
    };

    loadGoalAndHistory();
  }, [goalId, isSupabaseReady]);

  const handleSaveProductMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;

    const updatedGoal: FinancialGoal = {
      ...goal,
      product_url: productUrl.trim() || null,
      product_query: productQuery.trim() || goal.title,
    };
    setGoal(updatedGoal);

    if (isSupabaseReady) {
      const supabase = createClient();
      await supabase
        .from('goals')
        .update({
          product_url: updatedGoal.product_url,
          product_query: updatedGoal.product_query,
        })
        .eq('id', goal.id);
    } else {
      const rawGoals = localStorage.getItem(STORAGE_KEY_GOALS);
      const allGoals: FinancialGoal[] = rawGoals ? JSON.parse(rawGoals) : INITIAL_SAMPLE_GOALS;
      const nextGoals = allGoals.map((g) => (g.id === goal.id ? updatedGoal : g));
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(nextGoals));
    }

    setSavedBanner('URL e termo de monitoramento salvos com sucesso!');
    setTimeout(() => setSavedBanner(null), 3000);
  };

  const appendPriceRecord = async (record: Omit<GoalPriceHistory, 'id'>) => {
    if (isSupabaseReady) {
      const supabase = createClient();
      const { data } = await supabase
        .from('price_history')
        .insert(record)
        .select('*')
        .single();
      if (data) {
        setHistory((prev) => [
          ...prev,
          { ...(data as GoalPriceHistory), recorded_price: Number(data.recorded_price) },
        ]);
        return;
      }
    }

    const newItem: GoalPriceHistory = {
      ...record,
      id: 'ph-' + Date.now(),
    };
    const nextHistory = [...history, newItem];
    setHistory(nextHistory);
    if (goal) {
      localStorage.setItem(
        STORAGE_KEY_PRICE_HISTORY_PREFIX + goal.id,
        JSON.stringify(nextHistory)
      );
    }
  };

  const handleRunAutomatedPriceCheck = async () => {
    if (!goal) return;
    setCheckingPrice(true);
    try {
      const lastPrice =
        history.length > 0 ? history[history.length - 1].recorded_price : goal.target_price;
      const response = await fetch('/api/price-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: productUrl || goal.product_url,
          productQuery: productQuery || goal.product_query || goal.title,
          targetPrice: goal.target_price,
          lastPrice,
        }),
      });
      const data = await response.json();
      if (data.recorded_price) {
        await appendPriceRecord({
          goal_id: goal.id,
          recorded_price: Number(data.recorded_price),
          source_store: data.source_store || 'Monitor Automático',
          recorded_at: data.recorded_at || new Date().toISOString(),
        });
      }
    } finally {
      setCheckingPrice(false);
    }
  };

  const handleManualAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;
    const numeric = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(numeric) || numeric <= 0) return;

    await appendPriceRecord({
      goal_id: goal.id,
      recorded_price: numeric,
      source_store: manualStore.trim() || 'Cotação Manual',
      recorded_at: new Date().toISOString(),
    });
    setManualPrice('');
  };

  const stats = useMemo(() => {
    if (!goal || history.length === 0) {
      return {
        latestPrice: goal?.target_price || 0,
        lowestPrice: goal?.target_price || 0,
        highestPrice: goal?.target_price || 0,
        isBelowTarget: false,
        diffFromTarget: 0,
      };
    }
    const prices = history.map((h) => h.recorded_price);
    const latestPrice = prices[prices.length - 1];
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const diffFromTarget = Number((latestPrice - goal.target_price).toFixed(2));
    return {
      latestPrice,
      lowestPrice,
      highestPrice,
      isBelowTarget: latestPrice <= goal.target_price,
      diffFromTarget,
    };
  }, [goal, history]);

  if (!goal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Carregando histórico e monitoramento de preços...
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
                <span className="font-bold text-white text-base">{goal.title}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Passo 5: Monitoramento & Histórico de Preços
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Preço Alvo definido pelo casal: <strong className="text-emerald-400">{formatBRL(goal.target_price)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/metas"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              Voltar para Metas
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {savedBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
            {savedBanner}
          </div>
        )}

        {/* Indicadores de Preço Atual vs Preço Alvo */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 block">
              Preço Alvo da Meta
            </span>
            <strong className="text-2xl font-extrabold text-emerald-400 block mt-2">
              {formatBRL(goal.target_price)}
            </strong>
            <span className="text-[11px] text-slate-400">Linha tracejada verde no gráfico</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Último Preço Capturado
            </span>
            <strong className="text-2xl font-extrabold text-sky-400 block mt-2">
              {formatBRL(stats.latestPrice)}
            </strong>
            <span className="text-[11px] text-slate-400">
              {stats.isBelowTarget ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Abaixo/igual ao Preço Alvo! Hora de comprar!
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> {formatBRL(stats.diffFromTarget)} acima do alvo
                </span>
              )}
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Menor Preço Histórico
            </span>
            <strong className="text-2xl font-bold text-white block mt-2">
              {formatBRL(stats.lowestPrice)}
            </strong>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <TrendingDown className="w-3.5 h-3.5" /> Melhor oferta registrada
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Maior Preço Histórico
            </span>
            <strong className="text-2xl font-bold text-slate-300 block mt-2">
              {formatBRL(stats.highestPrice)}
            </strong>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Baseado em {history.length} coletas registradas
            </span>
          </div>
        </section>

        {/* Configuração da URL / Nome do Produto e Disparo do Monitor */}
        <section className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-sky-400" />
                Produto Monitorado (URL ou Nome para Rastreador / Cron Job)
              </h2>
              <p className="text-xs text-slate-400">
                Cole o link da loja (Amazon, KaBuM, Mercado Livre, etc.) ou o nome exato do produto.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAutomatedPriceCheck}
              disabled={checkingPrice}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-sky-500/20 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${checkingPrice ? 'animate-spin' : ''}`} />
              {checkingPrice ? 'Consultando Preço...' : 'Consultar Novo Preço Agora'}
            </button>
          </div>

          <form
            onSubmit={handleSaveProductMetadata}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-6">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                URL do Produto na Loja
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://www.amazon.com.br/dp/..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome / Termo de Busca do Produto
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Ex: Console PlayStation 5 Slim 1TB"
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition"
              >
                Salvar Vínculo
              </button>
              {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-sky-400 hover:border-sky-500/40"
                  title="Abrir link na loja"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </form>
        </section>

        {/* Gráfico Recharts: Flutuação de Preço vs Preço Alvo */}
        <section className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Curva de Flutuação de Preço vs. Preço Alvo ({formatBRL(goal.target_price)})
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhe quando o preço de mercado cruza abaixo da meta estipulada pelo casal.
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Cron Job: <code>supabase/functions/price-monitor</code>
            </span>
          </div>

          <PriceHistoryChart history={history} targetPrice={goal.target_price} />
        </section>

        {/* Registro Manual de Oferta + Tabela de Histórico */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleManualAddPrice}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 h-fit"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Registrar Preço / Promoção Manualmente
            </h3>
            <p className="text-xs text-slate-400">
              Viu uma promoção com cupom ou cashback? Adicione ao gráfico:
            </p>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Preço Encontrado (R$)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Ex: 3399.90"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Loja / Origem</label>
              <input
                type="text"
                required
                value={manualStore}
                onChange={(e) => setManualStore(e.target.value)}
                placeholder="Ex: Amazon c/ Cupom"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
            >
              Adicionar Cotação ao Gráfico
            </button>
          </form>

          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-3">
              Histórico de Coletas Registradas ({history.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3">Loja / Fonte</th>
                    <th className="py-2 px-3">Preço Capturado</th>
                    <th className="py-2 px-3">Status vs. Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[...history].reverse().map((item) => {
                    const isGood = item.recorded_price <= goal.target_price;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(item.recorded_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-medium">
                          {item.source_store}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-sky-300">
                          {formatBRL(item.recorded_price)}
                        </td>
                        <td className="py-2.5 px-3">
                          {isGood ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                              ✅ Abaixo/No Alvo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px]">
                              +{formatBRL(item.recorded_price - goal.target_price)} acima
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
