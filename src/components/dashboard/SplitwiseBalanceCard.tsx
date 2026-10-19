'use client';

import React from 'react';
import type { SplitwiseSummary } from '@/lib/calculations/splitwise';
import { formatBRL } from '@/components/dashboard/SummaryHeader';
import { Scale, ArrowRightLeft, CheckCircle2, Info } from 'lucide-react';

interface SplitwiseBalanceCardProps {
  summary: SplitwiseSummary;
  userAName?: string;
  userBName?: string;
}

export default function SplitwiseBalanceCard({
  summary,
  userAName = 'Eu',
  userBName = 'Esposa',
}: SplitwiseBalanceCardProps) {
  const {
    sharedHouseholdTotal,
    fairSharePerPartner,
    sharedPaidByUserA,
    sharedPaidByUserB,
    settlementStatus,
    settlementAmount,
  } = summary;

  return (
    <section className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-sky-500/30 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Coluna 1: Explicação e Título do Balanço Splitwise */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
            <Scale className="w-4 h-4" />
            Balanço do Casal & Acerto de Contas (Estilo Splitwise)
          </div>
          <h3 className="text-base font-bold text-white">
            Rateio 50/50 das Despesas Compartilhadas da Casa
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <span>
              Compara quanto cada um desembolsou nos gastos marcados como{' '}
              <strong className="text-sky-300">Dividido</strong> ({formatBRL(sharedHouseholdTotal)}{' '}
              no total, quota justa de{' '}
              <strong className="text-slate-200">{formatBRL(fairSharePerPartner)}</strong> para cada
              um).
            </span>
          </p>
        </div>

        {/* Coluna 2: Quem Desembolsou Quanto na Casa */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="px-4 py-3 rounded-xl bg-slate-950/90 border border-emerald-500/30">
            <span className="text-[11px] text-slate-400 block">
              👤 Pago por {userAName} (na Casa)
            </span>
            <strong className="text-base font-bold text-emerald-400">
              {formatBRL(sharedPaidByUserA)}
            </strong>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              Quota ideal: {formatBRL(fairSharePerPartner)}
            </span>
          </div>

          <div className="px-4 py-3 rounded-xl bg-slate-950/90 border border-purple-500/30">
            <span className="text-[11px] text-slate-400 block">
              👩‍❤️‍👨 Pago por {userBName} (na Casa)
            </span>
            <strong className="text-base font-bold text-purple-400">
              {formatBRL(sharedPaidByUserB)}
            </strong>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              Quota ideal: {formatBRL(fairSharePerPartner)}
            </span>
          </div>
        </div>

        {/* Coluna 3: Resultado do Repasse (Quem deve para quem) */}
        <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 min-w-[260px] flex items-center gap-3">
          {settlementStatus === 'SETTLED' ? (
            <>
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block">
                  Contas Quites!
                </span>
                <p className="text-xs text-slate-300">
                  Ambos pagaram exatamente a mesma proporção das despesas da casa.
                </p>
              </div>
            </>
          ) : settlementStatus === 'USER_B_OWES_USER_A' ? (
            <>
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold block">
                  {userAName} pagou mais despesas da casa
                </span>
                <p className="text-xs text-slate-200 mt-0.5">
                  <strong className="text-purple-300">{userBName}</strong> deve repassar{' '}
                  <strong className="text-emerald-400 text-sm">
                    {formatBRL(settlementAmount)}
                  </strong>{' '}
                  para <strong className="text-emerald-300">{userAName}</strong>.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold block">
                  {userBName} pagou mais despesas da casa
                </span>
                <p className="text-xs text-slate-200 mt-0.5">
                  <strong className="text-emerald-300">{userAName}</strong> deve repassar{' '}
                  <strong className="text-purple-400 text-sm">
                    {formatBRL(settlementAmount)}
                  </strong>{' '}
                  para <strong className="text-purple-300">{userBName}</strong>.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
