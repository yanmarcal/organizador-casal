'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { FinancialGoal, GoalPriceHistory } from '@/lib/types/database.types';
import { simulateFinancialGoal } from '@/lib/calculations/goalCalculator';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import { createClient } from '@/lib/supabase/client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Target,
  Calendar,
  Banknote,
  CreditCard,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Link2,
  RefreshCw,
  Check,
} from 'lucide-react';

interface GoalCardProps {
  goal: FinancialGoal;
  availableMonthlyBalance: number;
  isSupabaseReady: boolean;
  onUpdateGoal: (updated: FinancialGoal) => void;
  onDeleteGoal: (id: string) => void;
}

const STORAGE_KEY_PRICE_HISTORY_PREFIX = 'marcal_contas_price_history_';

function createInitialHistory(goalId: string, targetPrice: number): GoalPriceHistory[] {
  const base = targetPrice || 3500;
  return [
    {
      id: `${goalId}-p1`,
      goal_id: goalId,
      recorded_price: Number((base * 1.11).toFixed(2)),
      source_store: 'Amazon Brasil',
      recorded_at: '2026-09-05T10:00:00Z',
    },
    {
      id: `${goalId}-p2`,
      goal_id: goalId,
      recorded_price: Number((base * 1.07).toFixed(2)),
      source_store: 'KaBuM!',
      recorded_at: '2026-09-18T10:00:00Z',
    },
    {
      id: `${goalId}-p3`,
      goal_id: goalId,
      recorded_price: Number((base * 1.05).toFixed(2)),
      source_store: 'Mercado Livre',
      recorded_at: '2026-10-01T10:00:00Z',
    },
    {
      id: `${goalId}-p4`,
      goal_id: goalId,
      recorded_price: Number((base * 1.02).toFixed(2)),
      source_store: 'Amazon Brasil',
      recorded_at: '2026-10-10T10:00:00Z',
    },
    {
      id: `${goalId}-p5`,
      goal_id: goalId,
      recorded_price: Number((base * 0.985).toFixed(2)),
      source_store: 'Oferta Amazon Brasil',
      recorded_at: '2026-10-18T10:00:00Z',
    },
  ];
}

export default function GoalCard({
  goal,
  availableMonthlyBalance,
  isSupabaseReady,
  onUpdateGoal,
  onDeleteGoal,
}: GoalCardProps) {
  const [showInstallmentSim, setShowInstallmentSim] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<10 | 12>(
    goal.max_installments === 12 ? 12 : 10
  );
  const [interestRate, setInterestRate] = useState<number>(goal.interest_rate_monthly || 0);
  const [savedInput, setSavedInput] = useState<string>(String(goal.current_saved));
  const [editingSaved, setEditingSaved] = useState(false);

  // Passo 5: Estado do Link da Loja e Histórico de Preços (`price_history`) dentro do Card
  const [urlInput, setUrlInput] = useState<string>(goal.product_url || '');
  const [urlSaved, setUrlSaved] = useState(false);
  const [priceHistory, setPriceHistory] = useState<GoalPriceHistory[]>([]);
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Carrega o histórico da tabela `price_history` do Supabase ou LocalStorage
  useEffect(() => {
    const loadPriceHistory = async () => {
      if (isSupabaseReady) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('price_history')
          .select('*')
          .eq('goal_id', goal.id)
          .order('recorded_at', { ascending: true });

        if (!error && data && data.length > 0) {
          setPriceHistory(
            data.map((row) => ({
              ...row,
              recorded_price: Number(row.recorded_price),
            })) as GoalPriceHistory[]
          );
          return;
        }
      }

      const key = STORAGE_KEY_PRICE_HISTORY_PREFIX + goal.id;
      const raw = localStorage.getItem(key);
      if (raw) {
        setPriceHistory(JSON.parse(raw));
      } else {
        const seeded = createInitialHistory(goal.id, goal.target_price);
        localStorage.setItem(key, JSON.stringify(seeded));
        setPriceHistory(seeded);
      }
    };

    loadPriceHistory();
  }, [goal.id, goal.target_price, isSupabaseReady]);

  const handleSaveUrl = () => {
    onUpdateGoal({
      ...goal,
      product_url: urlInput.trim() || null,
    });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  // Chama a API Route `/api/price-check` (Cheerio) e grava na tabela `price_history`
  const handleUpdatePriceNow = async () => {
    setUpdatingPrice(true);
    try {
      if (urlInput.trim() !== (goal.product_url || '')) {
        onUpdateGoal({
          ...goal,
          product_url: urlInput.trim() || null,
        });
      }

      const lastPrice =
        priceHistory.length > 0
          ? priceHistory[priceHistory.length - 1].recorded_price
          : goal.target_price;

      const response = await fetch('/api/price-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: urlInput.trim() || goal.product_url,
          productQuery: goal.title,
          targetPrice: goal.target_price,
          lastPrice,
        }),
      });

      const data = await response.json();
      if (data.recorded_price) {
        const newRecordPayload = {
          goal_id: goal.id,
          recorded_price: Number(data.recorded_price),
          source_store: data.source_store || 'Scraper Loja',
          recorded_at: data.recorded_at || new Date().toISOString(),
        };

        if (isSupabaseReady) {
          const supabase = createClient();
          const { data: inserted, error } = await supabase
            .from('price_history')
            .insert(newRecordPayload)
            .select('*')
            .single();

          if (!error && inserted) {
            setPriceHistory((prev) => [
              ...prev,
              { ...(inserted as GoalPriceHistory), recorded_price: Number(inserted.recorded_price) },
            ]);
            return;
          }
        }

        const localEntry: GoalPriceHistory = {
          ...newRecordPayload,
          id: 'ph-' + Date.now(),
        };
        const nextList = [...priceHistory, localEntry];
        setPriceHistory(nextList);
        localStorage.setItem(
          STORAGE_KEY_PRICE_HISTORY_PREFIX + goal.id,
          JSON.stringify(nextList)
        );
      }
    } finally {
      setUpdatingPrice(false);
    }
  };

  // Simulações Financeiras (Passo 4)
  const simulation = useMemo(
    () =>
      simulateFinancialGoal({
        targetPrice: goal.target_price,
        currentSaved: goal.current_saved,
        targetDate: goal.target_date,
        installments: selectedInstallments,
        monthlyInterestRatePercent: interestRate,
        currentMonthlyAvailableBalance: availableMonthlyBalance,
      }),
    [
      goal.target_price,
      goal.current_saved,
      goal.target_date,
      selectedInstallments,
      interestRate,
      availableMonthlyBalance,
    ]
  );

  const sim10x = useMemo(
    () =>
      simulateFinancialGoal({
        targetPrice: goal.target_price,
        currentSaved: goal.current_saved,
        targetDate: goal.target_date,
        installments: 10,
        monthlyInterestRatePercent: interestRate,
        currentMonthlyAvailableBalance: availableMonthlyBalance,
      }),
    [goal.target_price, goal.current_saved, goal.target_date, interestRate, availableMonthlyBalance]
  );

  const sim12x = useMemo(
    () =>
      simulateFinancialGoal({
        targetPrice: goal.target_price,
        currentSaved: goal.current_saved,
        targetDate: goal.target_date,
        installments: 12,
        monthlyInterestRatePercent: interestRate,
        currentMonthlyAvailableBalance: availableMonthlyBalance,
      }),
    [goal.target_price, goal.current_saved, goal.target_date, interestRate, availableMonthlyBalance]
  );

  const progressPct = Math.min(
    100,
    Math.round((goal.current_saved / Math.max(1, goal.target_price)) * 100)
  );

  const formattedDeadline = useMemo(() => {
    const [y, m, d] = goal.target_date.split('-');
    if (!y || !m) return goal.target_date;
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d || 1));
    return dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [goal.target_date]);

  const handleSaveCurrentSaved = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(savedInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateGoal({
        ...goal,
        current_saved: parsed,
      });
    }
    setEditingSaved(false);
  };

  // Dados para o Gráfico de Linha Embutido no Card (Recharts)
  const chartData = useMemo(() => {
    return priceHistory.map((item) => {
      const d = new Date(item.recorded_at);
      return {
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        price: Number(item.recorded_price),
        store: item.source_store,
      };
    });
  }, [priceHistory]);

  const latestPrice =
    chartData.length > 0 ? chartData[chartData.length - 1].price : goal.target_price;
  const isBelowOrAtTarget = latestPrice <= goal.target_price;

  const isPs5 =
    goal.title.toLowerCase().includes('ps5') ||
    goal.title.toLowerCase().includes('playstation');

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-slate-800 hover:border-emerald-500/40 shadow-2xl flex flex-col justify-between space-y-5 transition">
      {/* Cabeçalho Visual do Card */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner">
              {isPs5 ? <Gamepad2 className="w-6 h-6" /> : <Target className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{goal.title}</h3>
                {goal.product_url && (
                  <a
                    href={goal.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300"
                    title="Abrir link da loja"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                <span className="inline-flex items-center gap-1 capitalize">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Prazo: <strong className="text-slate-200">{formattedDeadline}</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                  {simulation.monthsUntilDeadline}{' '}
                  {simulation.monthsUntilDeadline === 1 ? 'mês restante' : 'meses restantes'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDeleteGoal(goal.id)}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Excluir Meta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Painel de Preço Alvo e Progresso */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                Preço Alvo da Meta
              </span>
              <span className="text-2xl font-extrabold text-white">
                {formatBRL(goal.target_price)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                Valor Já Poupado (Yan & Larissa)
              </span>
              {editingSaved ? (
                <form onSubmit={handleSaveCurrentSaved} className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={savedInput}
                    onChange={(e) => setSavedInput(e.target.value)}
                    className="w-28 px-2.5 py-1 bg-slate-900 border border-emerald-500 rounded-lg text-xs text-white font-bold"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
                  >
                    Salvar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSavedInput(String(goal.current_saved));
                    setEditingSaved(true);
                  }}
                  className="text-base font-bold text-emerald-400 hover:underline"
                  title="Clique para editar quanto já guardaram"
                >
                  {formatBRL(goal.current_saved)} ({progressPct}%)
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 1. CÁLCULO À VISTA (Em Destaque no Card) */}
      <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Banknote className="w-4 h-4" />
            Plano de Compra À Vista
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">
            {simulation.monthsUntilDeadline}x aportes até o prazo
          </span>
        </div>

        <p className="text-sm font-bold text-white leading-snug">
          Para pagar à vista, o casal precisa poupar{' '}
          <span className="text-emerald-400 text-base font-extrabold underline decoration-emerald-500/50">
            {formatBRL(simulation.cashPlan.monthlySavingsCouple)}
          </span>{' '}
          por mês
        </p>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-1">
          <span>
            🤝 Divisão 50/50:{' '}
            <strong className="text-emerald-300">
              {formatBRL(simulation.cashPlan.monthlySavingsPerPartner)}
            </strong>{' '}
            para Yan e{' '}
            <strong className="text-purple-300">
              {formatBRL(simulation.cashPlan.monthlySavingsPerPartner)}
            </strong>{' '}
            para Larissa
          </span>
        </div>
      </div>

      {/* 2. BOTÃO "SIMULAR PARCELAMENTO" (10x ou 12x + Alerta de Impacto) */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowInstallmentSim((prev) => !prev)}
          className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
            showInstallmentSim
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
              : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Simular Parcelamento
          </span>
          {showInstallmentSim ? (
            <ChevronUp className="w-4 h-4 text-purple-300" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showInstallmentSim && (
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedInstallments(10)}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedInstallments === 10
                    ? 'bg-purple-500/20 border-purple-400 text-white'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider text-purple-300 font-bold block">
                  Opção 10x no Cartão
                </span>
                <strong className="text-base font-extrabold text-white block mt-0.5">
                  10x de {formatBRL(sim10x.installmentPlan.monthlyInstallmentCouple)}
                </strong>
                <span className="text-[11px] text-slate-400">
                  ({formatBRL(sim10x.installmentPlan.monthlyInstallmentPerPartner)} p/ cada)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedInstallments(12)}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedInstallments === 12
                    ? 'bg-purple-500/20 border-purple-400 text-white'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider text-purple-300 font-bold block">
                  Opção 12x no Cartão
                </span>
                <strong className="text-base font-extrabold text-white block mt-0.5">
                  12x de {formatBRL(sim12x.installmentPlan.monthlyInstallmentCouple)}
                </strong>
                <span className="text-[11px] text-slate-400">
                  ({formatBRL(sim12x.installmentPlan.monthlyInstallmentPerPartner)} p/ cada)
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-slate-400">Taxa de juros mensal (% a.m.):</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right font-bold text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                simulation.installmentPlan.fitsInCurrentBalance
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-white">
                  Alerta de Impacto no Orçamento Mensal ({selectedInstallments}x de{' '}
                  {formatBRL(simulation.installmentPlan.monthlyInstallmentCouple)})
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Comprometerá{' '}
                  <strong className="text-amber-300">
                    {simulation.installmentPlan.percentageOfAvailableBalance}%
                  </strong>{' '}
                  do Saldo Disponível do casal, deixando{' '}
                  <strong className="text-emerald-300">
                    {formatBRL(simulation.installmentPlan.projectedFutureMonthlyBalance)}/mês
                  </strong>{' '}
                  livres.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. PASSO 5: CAMPO DE LINK DA LOJA + BOTÃO "ATUALIZAR PREÇO" + GRÁFICO DE LINHA EMBUTIDO */}
      <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-500/30 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" />
            Monitoramento & Histórico de Preços (Cheerio + Recharts)
          </span>
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
              isBelowOrAtTarget
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            Último: {formatBRL(latestPrice)}{' '}
            {isBelowOrAtTarget ? '(Abaixo do Alvo!)' : '(Acima do Alvo)'}
          </span>
        </div>

        {/* Campo para inserir o Link da Loja e botão "Atualizar Preço" */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleSaveUrl}
              placeholder="Cole aqui o link da loja (Amazon, KaBuM, Mercado Livre...)"
              className="w-full pl-8 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
            {urlSaved && (
              <Check className="w-3.5 h-3.5 text-emerald-400 absolute right-2.5 top-2.5" />
            )}
          </div>

          <button
            type="button"
            onClick={handleUpdatePriceNow}
            disabled={updatingPrice}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0 shadow-md shadow-sky-500/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${updatingPrice ? 'animate-spin' : ''}`} />
            {updatingPrice ? 'Extraindo...' : 'Atualizar Preço'}
          </button>
        </div>

        {/* Gráfico de Linha Pequeno (Recharts) dentro do Card */}
        <div className="w-full h-[175px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 14, left: 4, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `R$${v}`}
                width={58}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
                formatter={(value: number) => [formatBRL(value), 'Preço Extraído']}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return `${label} • ${payload[0].payload.store}`;
                  }
                  return String(label);
                }}
              />
              <ReferenceLine
                y={goal.target_price}
                stroke="#10b981"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value: `Alvo: ${formatBRL(goal.target_price)}`,
                  position: 'insideTopRight',
                  fill: '#34d399',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#38bdf8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <span>
            Linha tracejada verde = Preço Alvo ({formatBRL(goal.target_price)})
          </span>
          <Link
            href={`/metas/${goal.id}`}
            className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            Tela cheia
          </Link>
        </div>
      </div>
    </div>
  );
}
