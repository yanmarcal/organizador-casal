'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import {
  HeartHandshake,
  Table2,
  Target,
  LogOut,
  Users,
} from 'lucide-react';

export default function AppHeader() {
  const pathname = usePathname();
  const {
    currentUser,
    familyGroup,
    activeRole,
    switchActiveRole,
    signOut,
  } = useCoupleAuth();

  const isDashboardActive = pathname === '/';
  const isMetasActive = pathname.startsWith('/metas');

  return (
    <header className="border-b border-slate-800/90 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Marca + Identificação do Grupo Familiar */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 transition">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight block">
                Marçal Contas
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-400" />
                {familyGroup ? familyGroup.name : 'Família Marçal'}
                {familyGroup?.invite_code && (
                  <code className="text-emerald-400 font-mono ml-1">
                    ({familyGroup.invite_code})
                  </code>
                )}
              </span>
            </div>
          </Link>

          {/* Navegação Clara entre Páginas: Planilha (/) vs Metas Financeiras (/metas) */}
          <nav className="flex items-center gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                isDashboardActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Table2 className="w-4 h-4" />
              Gastos & Splitwise
            </Link>

            <Link
              href="/metas"
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                isMetasActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Target className="w-4 h-4" />
              Metas Financeiras
            </Link>
          </nav>
        </div>

        {/* Seletor Fluido de Utilizador Ativo (Yan vs Larissa) + Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Utilizador Ativo:
            </span>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => switchActiveRole('USER_A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeRole === 'USER_A'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👤 Yan
              </button>
              <button
                type="button"
                onClick={() => switchActiveRole('USER_B')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeRole === 'USER_B'
                    ? 'bg-purple-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👩‍❤️‍👨 Larissa
              </button>
            </div>
          </div>

          {currentUser && (
            <Link
              href="/login"
              onClick={() => signOut()}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
              title="Trocar conta / Sair"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
