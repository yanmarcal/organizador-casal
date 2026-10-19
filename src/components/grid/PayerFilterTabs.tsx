'use client';

import React from 'react';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import { Users, User, Heart } from 'lucide-react';

export type ExpenseTabFilter = 'ALL_SHARED' | 'MINE_YAN' | 'HERS_LARISSA';

interface PayerFilterTabsProps {
  activeTab: ExpenseTabFilter;
  onSelectTab: (tab: ExpenseTabFilter) => void;
  counts: {
    allShared: number;
    yan: number;
    larissa: number;
  };
  totals: {
    allShared: number;
    yan: number;
    larissa: number;
  };
}

export default function PayerFilterTabs({
  activeTab,
  onSelectTab,
  counts,
  totals,
}: PayerFilterTabsProps) {
  const tabs: {
    id: ExpenseTabFilter;
    label: string;
    subtitle: string;
    count: number;
    total: number;
    icon: React.ReactNode;
    activeClass: string;
  }[] = [
    {
      id: 'ALL_SHARED',
      label: 'Todos / Compartilhados',
      subtitle: 'Despesas do Casal',
      count: counts.allShared,
      total: totals.allShared,
      icon: <Users className="w-4 h-4 text-sky-400" />,
      activeClass: 'bg-sky-500/15 border-sky-500/50 text-sky-200 shadow-md',
    },
    {
      id: 'MINE_YAN',
      label: 'Meus Gastos (Yan)',
      subtitle: 'Pagos por Yan',
      count: counts.yan,
      total: totals.yan,
      icon: <User className="w-4 h-4 text-emerald-400" />,
      activeClass: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 shadow-md',
    },
    {
      id: 'HERS_LARISSA',
      label: 'Gastos Dela (Larissa)',
      subtitle: 'Pagos por Larissa',
      count: counts.larissa,
      total: totals.larissa,
      icon: <Heart className="w-4 h-4 text-purple-400" />,
      activeClass: 'bg-purple-500/15 border-purple-500/50 text-purple-200 shadow-md',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
              isActive
                ? tab.activeClass
                : 'bg-slate-900/70 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                {tab.icon}
                <span>{tab.label}</span>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 font-mono">
                {tab.count} {tab.count === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <div className="flex items-baseline justify-between w-full">
              <span className="text-[11px] text-slate-400">{tab.subtitle}</span>
              <span className="text-base font-extrabold text-white">{formatBRL(tab.total)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
