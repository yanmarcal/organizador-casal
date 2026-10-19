'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCoupleAuth } from '@/lib/context/CoupleAuthContext';
import { HeartHandshake, User, Mail, Lock, Users, KeyRound, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const { signUpOrSignIn, createFamilyGroup, joinFamilyGroupByCode } = useCoupleAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleLabel, setRoleLabel] = useState<'Eu' | 'Esposa'>('Eu');
  const [groupAction, setGroupAction] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('Família Marçal');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const authRes = await signUpOrSignIn({
      email,
      password,
      fullName: fullName || roleLabel,
      roleLabel,
      mode: 'register',
    });

    if (authRes.error) {
      setError(authRes.error);
      setSubmitting(false);
      return;
    }

    if (groupAction === 'create') {
      const groupRes = await createFamilyGroup(groupName || 'Família Marçal', roleLabel);
      if (groupRes.error) {
        setError(groupRes.error);
        setSubmitting(false);
        return;
      }
    } else {
      const joinRes = await joinFamilyGroupByCode(inviteCode, roleLabel);
      if (joinRes.error) {
        setError(joinRes.error);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-slate-950 to-slate-950">
      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Cadastro do Casal</h1>
            <p className="text-xs text-slate-400">
              Passo 1: Identificação individual + Vínculo ao Grupo Familiar (`FamilyGroup`)
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Seu Nome</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Yan Marçal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Papel no Orçamento
              </label>
              <select
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value as 'Eu' | 'Esposa')}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Eu">Eu (Parceiro 1)</option>
                <option value="Esposa">Esposa (Parceiro 2)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="voce@email.com"
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Configuração do Grupo Familiar (`FamilyGroup`)
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setGroupAction('create')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  groupAction === 'create'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Users className="w-4 h-4" />
                Criar Novo Grupo
              </button>
              <button
                type="button"
                onClick={() => setGroupAction('join')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  groupAction === 'join'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Tenho Código do Par
              </button>
            </div>

            {groupAction === 'create' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nome do Grupo Familiar
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Família Marçal"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Um código único de convite será gerado para você enviar à sua esposa.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Código de Convite do Casal
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono uppercase tracking-wider text-purple-300 focus:outline-none focus:border-purple-500"
                  placeholder="Ex: MARCAL-26"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ao inserir o código, sua conta compartilhará o mesmo orçamento do grupo.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
          >
            {submitting ? 'Configurando Grupo Familiar...' : 'Concluir Cadastro e Vincular Casal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Já possui cadastro?{' '}
          <Link href="/login" className="text-emerald-400 hover:underline font-medium">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
