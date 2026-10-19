'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { FamilyGroup, Profile } from '@/lib/types/database.types';

interface CoupleAuthContextValue {
  currentUser: Profile | null;
  partnerUser: Profile | null;
  familyGroup: FamilyGroup | null;
  loading: boolean;
  isSupabaseReady: boolean;
  activeDemoRole: 'USER_A' | 'USER_B';
  switchDemoRole: (role: 'USER_A' | 'USER_B') => void;
  signUpOrSignIn: (params: {
    email: string;
    password?: string;
    fullName: string;
    roleLabel: string;
    mode: 'login' | 'register';
  }) => Promise<{ error?: string }>;
  createFamilyGroup: (groupName: string, roleLabel: string) => Promise<{ error?: string; group?: FamilyGroup }>;
  joinFamilyGroupByCode: (inviteCode: string, roleLabel: string) => Promise<{ error?: string; group?: FamilyGroup }>;
  signOut: () => Promise<void>;
  refreshCoupleData: () => Promise<void>;
}

const CoupleAuthContext = createContext<CoupleAuthContextValue | undefined>(undefined);

const STORAGE_KEY_STATE = 'marcal_contas_couple_state_v2';

interface LocalDemoState {
  familyGroup: FamilyGroup | null;
  userA: Profile;
  userB: Profile | null;
  activeRole: 'USER_A' | 'USER_B';
  isLoggedIn: boolean;
}

const DEFAULT_DEMO_STATE: LocalDemoState = {
  familyGroup: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Família Marçal (Yan & Larissa)',
    invite_code: 'MARCAL-26',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    created_at: new Date().toISOString(),
  },
  userA: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    family_group_id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Yan',
    role_label: 'Yan',
    email: 'yan@marcalcontas.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  userB: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    family_group_id: '11111111-1111-1111-1111-111111111111',
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
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [partnerUser, setPartnerUser] = useState<Profile | null>(null);
  const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDemoRole, setActiveDemoRole] = useState<'USER_A' | 'USER_B'>('USER_A');
  const supabaseReady = isSupabaseConfigured();

  const applyLocalState = (state: LocalDemoState) => {
    setActiveDemoRole(state.activeRole);
    if (!state.isLoggedIn) {
      setCurrentUser(null);
      setPartnerUser(null);
      setFamilyGroup(null);
      return;
    }
    setFamilyGroup(state.familyGroup);
    if (state.activeRole === 'USER_A') {
      setCurrentUser(state.userA);
      setPartnerUser(state.userB);
    } else {
      setCurrentUser(
        state.userB || {
          id: 'user-b-002',
          family_group_id: state.familyGroup?.id || null,
          full_name: 'Esposa',
          role_label: 'Esposa',
          email: 'esposa@marcalcontas.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
      setPartnerUser(state.userA);
    }
  };

  const loadFromSupabase = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUser(null);
      setPartnerUser(null);
      setFamilyGroup(null);
      setLoading(false);
      return;
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!myProfile) {
      setLoading(false);
      return;
    }

    setCurrentUser(myProfile as Profile);

    if (myProfile.family_group_id) {
      const { data: groupData } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', myProfile.family_group_id)
        .single();

      if (groupData) {
        setFamilyGroup(groupData as FamilyGroup);
      }

      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_group_id', myProfile.family_group_id)
        .neq('id', user.id);

      if (members && members.length > 0) {
        setPartnerUser(members[0] as Profile);
      } else {
        setPartnerUser(null);
      }
    } else {
      setFamilyGroup(null);
      setPartnerUser(null);
    }

    setLoading(false);
  };

  const refreshCoupleData = async () => {
    if (supabaseReady) {
      await loadFromSupabase();
    } else {
      const raw = localStorage.getItem(STORAGE_KEY_STATE);
      const parsed: LocalDemoState = raw ? JSON.parse(raw) : DEFAULT_DEMO_STATE;
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(DEFAULT_DEMO_STATE));
      }
      applyLocalState(parsed);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCoupleData();
  }, []);

  const switchDemoRole = (role: 'USER_A' | 'USER_B') => {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : DEFAULT_DEMO_STATE;
    parsed.activeRole = role;
    parsed.isLoggedIn = true;
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    applyLocalState(parsed);
  };

  const signUpOrSignIn: CoupleAuthContextValue['signUpOrSignIn'] = async ({
    email,
    password,
    fullName,
    roleLabel,
    mode,
  }) => {
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

    // Modo Local / Sandbox sincronizado
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    parsed.isLoggedIn = true;

    if (roleLabel === 'Esposa' || roleLabel === 'Larissa') {
      parsed.activeRole = 'USER_B';
      parsed.userB = {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        family_group_id: parsed.familyGroup?.id || null,
        full_name: fullName || 'Larissa',
        role_label: 'Larissa',
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      parsed.activeRole = 'USER_A';
      parsed.userA = {
        ...parsed.userA,
        full_name: fullName || parsed.userA.full_name,
        role_label: roleLabel || 'Yan',
        email,
      };
    }

    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    applyLocalState(parsed);
    return {};
  };

  const createFamilyGroup = async (groupName: string, roleLabel: string) => {
    if (supabaseReady) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_family_group_and_join', {
        group_name: groupName,
        user_role_label: roleLabel,
      });
      if (error) return { error: error.message };
      await loadFromSupabase();
      return { group: data as FamilyGroup };
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
      id: 'fg-' + Date.now(),
      name: groupName,
      invite_code: code,
      created_by: parsed.userA.id,
      created_at: new Date().toISOString(),
    };

    parsed.familyGroup = newGroup;
    parsed.userA.family_group_id = newGroup.id;
    parsed.userA.role_label = roleLabel || 'Eu';
    if (parsed.userB) {
      parsed.userB.family_group_id = newGroup.id;
    }
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    applyLocalState(parsed);
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

    if (
      parsed.familyGroup &&
      parsed.familyGroup.invite_code.toUpperCase() !== inviteCode.trim().toUpperCase()
    ) {
      return {
        error: `Código "${inviteCode}" não encontrado. O código ativo atual é ${parsed.familyGroup.invite_code}.`,
      };
    }

    const group = parsed.familyGroup || DEFAULT_DEMO_STATE.familyGroup!;
    parsed.familyGroup = group;
    if (parsed.activeRole === 'USER_B') {
      parsed.userB = {
        ...(parsed.userB || DEFAULT_DEMO_STATE.userB!),
        family_group_id: group.id,
        role_label: roleLabel || 'Esposa',
      };
    } else {
      parsed.userA.family_group_id = group.id;
      parsed.userA.role_label = roleLabel || 'Eu';
    }

    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    applyLocalState(parsed);
    return { group };
  };

  const signOut = async () => {
    if (supabaseReady) {
      const supabase = createClient();
      await supabase.auth.signOut();
      await loadFromSupabase();
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    const parsed: LocalDemoState = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_STATE };
    parsed.isLoggedIn = false;
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(parsed));
    applyLocalState(parsed);
  };

  return (
    <CoupleAuthContext.Provider
      value={{
        currentUser,
        partnerUser,
        familyGroup,
        loading,
        isSupabaseReady: supabaseReady,
        activeDemoRole,
        switchDemoRole,
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
