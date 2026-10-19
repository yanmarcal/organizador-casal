'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import { HeartHandshake, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { signUpOrSignIn, isSupabaseReady } = useCoupleAuth();
  const router = useRouter();
  const [email, setEmail] = useState('yan@marcalcontas.com');
  const [password, setPassword] = useState('Marcal123!');
  const [roleLabel, setRoleLabel] = useState<'Yan' | 'Larissa'>('Yan');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signUpOrSignIn({
      email,
      password,
      fullName: roleLabel,
      roleLabel,
      mode: 'login',
    });

    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-slate-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Marçal Contas</h1>
            <p className="text-xs text-slate-400">Finanças compartilhadas (Yan & Larissa)</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-slate-100 mb-1">Entrar na conta</h2>
        <p className="text-sm text-slate-400 mb-6">
          Acesse o orçamento compartilhado do seu Grupo Familiar (`family_groups`).
        </p>

        {!isSupabaseReady && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-amber-300">
                Seed Carregado: Yan & Larissa
              </span>
              Selecione <strong>Yan</strong> ou <strong>Larissa</strong> abaixo para testar o login
              ou preencha as chaves no arquivo <code>.env.local</code>.
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Usuários do Seed (`family_groups`)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoleLabel('Yan');
                  setEmail('yan@marcalcontas.com');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition ${
                  roleLabel === 'Yan'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                👤 Yan
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleLabel('Larissa');
                  setEmail('larissa@marcalcontas.com');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition ${
                  roleLabel === 'Larissa'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                👩‍❤️‍👨 Larissa
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
          >
            {submitting ? 'Autenticando...' : `Entrar como ${roleLabel}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Ainda não tem conta ou quer vincular seu par?{' '}
          <Link href="/register" className="text-emerald-400 hover:underline font-medium">
            Criar conta de casal
          </Link>
        </div>
      </div>
    </div>
  );
}
