'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { FamilyGroup, Profile } from '@/lib/types/database.types';

interface CoupleAuthContextValue {
  currentUser: Profile | null;
  partnerUser: Profile | null;
  familyGroup: FamilyGroup | null;
  loading: boolean;
  isSupabaseReady: boolean;
  /** Persona ativa no seletor do cabeçalho ('USER_A' = Yan, 'USER_B' = Larissa) */
  activeRole: 'USER_A' | 'USER_B';
  switchActiveRole: (role: 'USER_A' | 'USER_B') => void;
  signUpOrSignIn: (params: {
    email: string;
    password?: string;
    fullName: string;
    roleLabel: string;
    mode: 'login' | 'register';
  }) => Promise<{ error?: string }>;
  createFamilyGroup: (
    groupName: string,
    roleLabel: string
  ) => Promise<{ error?: string; group?: FamilyGroup }>;
  joinFamilyGroupByCode: (
    inviteCode: string,
    roleLabel: string
  ) => Promise<{ error?: string; group?: FamilyGroup }>;
  signOut: () => Promise<void>;
  refreshCoupleData: () => Promise<void>;
}

const CoupleAuthContext = createContext<CoupleAuthContextValue | undefined>(undefined);

const STORAGE_KEY_STATE = 'marcal_contas_couple_state_v3';
const STORAGE_KEY_ACTIVE_ROLE = 'marcal_contas_active_role_v3';

export const DEFAULT_GROUP_ID = '11111111-1111-1111-1111-111111111111';
export const YAN_DEFAULT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const LARISSA_DEFAULT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

interface LocalDemoState {
  familyGroup: FamilyGroup;
  userA: Profile;
  userB: Profile;
  activeRole: 'USER_A' | 'USER_B';
  isLoggedIn: boolean;
}

const DEFAULT_DEMO_STATE: LocalDemoState = {
  familyGroup: {
    id: DEFAULT_GROUP_ID,
    name: 'Família Marçal (Yan & Larissa)',
    invite_code: 'MARCAL-26',
    created_by: YAN_DEFAULT_ID,
    created_at: new Date().toISOString(),
  },
  userA: {
    id: YAN_DEFAULT_ID,
    family_group_id: DEFAULT_GROUP_ID,
    full_name: 'Yan',
    role_label: 'Yan',
    email: 'yan@marcalcontas.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  userB: {
    id: LARISSA_DEFAULT_ID,
    family_group_id: DEFAULT_GROUP_ID,
    full_name: 'Larissa',
    role_label: 'Larissa',
    email: 'larissa@marcalcontas.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  activeRole: 'USER_A',
  isLoggedIn: true,
};

export function CoupleAuthProvider({ children }: { children: React.ReactNode }) {
  const [authProfileA, setAuthProfileA] = useState<Profile>(DEFAULT_DEMO_STATE.userA);
  const [authProfileB, setAuthProfileB] = useState<Profile>(DEFAULT_DEMO_STATE.userB);
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(
    DEFAULT_DEMO_STATE.familyGroup
  );
  const [activeRole, setActiveRole] = useState<'USER_A' | 'USER_B'>('USER_A');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const supabaseReady = isSupabaseConfigured();

  const loadFromSupabase = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Se não houver usuário autenticado via Supabase Auth ainda, mantém o casal padrão
      // para que a aplicação continue funcional sem bloquear a navegação
      const savedRole =
        (localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) as 'USER_A' | 'USER_B') || 'USER_A';
      setActiveRole(savedRole);
      setAuthProfileA(DEFAULT_DEMO_STATE.userA);
      setAuthProfileB(DEFAULT_DEMO_STATE.userB);
      setFamilyGroup(DEFAULT_DEMO_STATE.familyGroup);
      setIsLoggedIn(true);
      setLoading(false);
      return;
    }

    setIsLoggedIn(true);

    // Busca ou cria automaticamente o perfil do usuário autenticado
    let { data: myProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!myProfile) {
      const fallbackName =
        user.user_metadata?.full_name || user.email?.split('@')[0] || 'Yan';
      const fallbackRole = user.user_metadata?.role_label || 'Yan';
      const { data: insertedProfile } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fallbackName,
          role_label: fallbackRole,
          email: user.email,
        })
        .select('*')
        .maybeSingle();
      myProfile = insertedProfile;
    }

    if (myProfile) {
      const isLarissaUser =
        myProfile.role_label?.toLowerCase().includes('larissa') ||
        myProfile.role_label?.toLowerCase().includes('esposa') ||
        myProfile.full_name?.toLowerCase().includes('larissa');

      if (isLarissaUser) {
        setAuthProfileB(myProfile as Profile);
      } else {
        setAuthProfileA(myProfile as Profile);
      }

      const savedRole = localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) as
        | 'USER_A'
        | 'USER_B'
        | null;
      setActiveRole(savedRole || (isLarissaUser ? 'USER_B' : 'USER_A'));

      if (myProfile.family_group_id) {
        const { data: groupData } = await supabase
          .from('family_groups')
          .select('*')
          .eq('id', myProfile.family_group_id)
          .maybeSingle();

        if (groupData) {
          setFamilyGroup(groupData as FamilyGroup);
        }

        const { data: members } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_group_id', myProfile.family_group_id)
          .neq('id', user.id);

        if (members && members.length > 0) {
          const partner = members[0] as Profile;
          if (isLarissaUser) {
            setAuthProfileA(partner);
          } else {
            setAuthProfileB(partner);
          }
        }
      }
    }

    setLoading(false);
  }, []);

  const refreshCoupleData = useCallback(async () => {
    if (supabaseReady) {
      await loadFromSupabase();
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_STATE);
      const parsed: LocalDemoState = raw ? JSON.parse(raw) : DEFAULT_DEMO_STATE;
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(DEFAULT_DEMO_STATE));
      }
      setFamilyGroup(parsed.familyGroup);
      setAuthProfileA(parsed.userA);
      setAuthProfileB(parsed.userB);
      setActiveRole(parsed.activeRole);
      setIsLoggedIn(parsed.isLoggedIn);
      setLoading(false);
    }
  }, [supabaseReady, loadFromSupabase]);

  useEffect(() => {
    refreshCoupleData();

    if (supabaseReady) {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        loadFromSupabase();
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [supabaseReady, refreshCoupleData, loadFromSupabase]);

  // Troca fluida e instantânea de utilizador ativo no cabeçalho (funciona tanto com Supabase quanto Local)
  const switchActiveRole = (role: 'USER_A' | 'USER_B') => {
    setActiveRole(role);
    localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, role);

    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    parsed.activeRole = role;
    parsed.isLoggedIn = true;
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
  };

  const signUpOrSignIn: CoupleAuthContextValue['signUpOrSignIn'] = async ({
    email,
    password,
    fullName,
    roleLabel,
    mode,
  }) => {
    const targetRole: 'USER_A' | 'USER_B' =
      roleLabel === 'Larissa' || roleLabel === 'Esposa' ? 'USER_B' : 'USER_A';
    localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, targetRole);
    setActiveRole(targetRole);

    if (supabaseReady) {
      const supabase = createClient();
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password: password || 'Marcal123!',
          options: {
            data: {
              full_name: fullName,
              role_label: roleLabel,
            },
          },
        });
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: password || 'Marcal123!',
        });
        if (error) return { error: error.message };
      }
      await loadFromSupabase();
      return {};
    }

    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    parsed.isLoggedIn = true;
    parsed.activeRole = targetRole;

    if (targetRole === 'USER_B') {
      parsed.userB = {
        ...parsed.userB,
        full_name: fullName || 'Larissa',
        role_label: 'Larissa',
        email,
      };
    } else {
      parsed.userA = {
        ...parsed.userA,
        full_name: fullName || 'Yan',
        role_label: 'Yan',
        email,
      };
    }

    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    await refreshCoupleData();
    return {};
  };

  const createFamilyGroup = async (groupName: string, roleLabel: string) => {
    if (supabaseReady) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_family_group_and_join', {
        group_name: groupName,
        user_role_label: roleLabel,
      });

      if (!error && data) {
        await loadFromSupabase();
        return { group: data as FamilyGroup };
      }

      // Fallback direto caso a RPC ainda não esteja no cache
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: insertedGroup, error: groupErr } = await supabase
          .from('family_groups')
          .insert({ name: groupName, created_by: user.id })
          .select('*')
          .single();

        if (groupErr) return { error: groupErr.message };

        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            family_group_id: insertedGroup.id,
            full_name: roleLabel || 'Yan',
            role_label: roleLabel || 'Yan',
            email: user.email,
          });

        await loadFromSupabase();
        return { group: insertedGroup as FamilyGroup };
      }

      if (error) return { error: error.message };
    }

    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    const code =
      groupName
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 6)
        .toUpperCase() +
      '-' +
      Math.floor(10 + Math.random() * 89);

    const newGroup: FamilyGroup = {
      id: DEFAULT_GROUP_ID,
      name: groupName,
      invite_code: code,
      created_by: parsed.userA.id,
      created_at: new Date().toISOString(),
    };

    parsed.familyGroup = newGroup;
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    await refreshCoupleData();
    return { group: newGroup };
  };

  const joinFamilyGroupByCode = async (inviteCode: string, roleLabel: string) => {
    if (supabaseReady) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('join_family_group_by_code', {
        code: inviteCode,
        user_role_label: roleLabel,
      });
      if (error) return { error: error.message };
      await loadFromSupabase();
      return { group: data as FamilyGroup };
    }

    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    return { group: parsed.familyGroup };
  };

  const signOut = async () => {
    if (supabaseReady) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setIsLoggedIn(false);
  };

  const currentUser = !isLoggedIn
    ? null
    : activeRole === 'USER_A'
    ? authProfileA
    : authProfileB;

  const partnerUser = !isLoggedIn
    ? null
    : activeRole === 'USER_A'
    ? authProfileB
    : authProfileA;

  return (
    <CoupleAuthContext.Provider
      value={{
        currentUser,
        partnerUser,
        familyGroup,
        loading,
        isSupabaseReady: supabaseReady,
        activeRole,
        switchActiveRole,
        signUpOrSignIn,
        createFamilyGroup,
        joinFamilyGroupByCode,
        signOut,
        refreshCoupleData,
      }}
    >
      {children}
    </CoupleAuthContext.Provider>
  );
}

export function useCoupleAuth() {
  const ctx = useContext(CoupleAuthContext);
  if (!ctx) {
    throw new Error('useCoupleAuth deve ser usado dentro de um CoupleAuthProvider');
  }
  return ctx;
}
