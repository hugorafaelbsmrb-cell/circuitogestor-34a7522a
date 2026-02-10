import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLogin, logLogout } from '@/utils/auditLog';
import { checkRateLimit, formatResetTime } from '@/utils/rateLimiter';

export interface UserPermissions {
  dashboard?: boolean;
  enrollment?: boolean;
  students?: boolean;
  leads?: boolean;
  classes?: boolean;
  courses?: boolean;
  schedules?: boolean;
  financial?: boolean;
  carnes?: boolean;
  contracts?: boolean;
  discounts?: boolean;
  reports?: boolean;
  contract_config?: boolean;
  users?: boolean;
  settings?: boolean;
  [key: string]: boolean | undefined;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  permissions: UserPermissions | null;
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (!error && data && isMounted) {
          setProfile({
            ...data,
            permissions: data.permissions as UserPermissions | null,
          });
        }
      } catch {
        // Profile fetch failed silently
      }
    };

    // Listener for ONGOING auth changes (does NOT control isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fire and forget - don't await, don't set loading
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    // INITIAL load (controls isLoading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // Fetch profile BEFORE setting loading false
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    
    return { error, user: data.user };
  };

  const signIn = async (email: string, password: string) => {
    const rateCheck = checkRateLimit(email, 'login');
    if (!rateCheck.allowed) {
      const resetTime = formatResetTime(rateCheck.resetIn);
      return { 
        error: { 
          message: `Muitas tentativas de login. Tente novamente em ${resetTime}.`,
          name: 'RateLimitError'
        } as Error 
      };
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    await logLogin(email, !error);
    
    return { error };
  };

  const signOut = async () => {
    await logLogout();
    
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
      localStorage.removeItem('circuito-last-route');
    }
    return { error };
  };

  const fetchProfilePublic = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setProfile({
        ...data,
        permissions: data.permissions as UserPermissions | null,
      });
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    return { error };
  };

  return {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refetchProfile: () => user && fetchProfilePublic(user.id),
  };
}
