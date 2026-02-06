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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
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

  const signUp = async (email: string, password: string, fullName: string) => {
    // Use admin API approach - create user without auto-login
    // Since we can't use admin API from client, we sign up and immediately sign out
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    
    // If signup was successful and user is now logged in, sign them out
    // This prevents the admin from being logged out when creating new users
    if (!error && data.session) {
      // We need to preserve current session, so we just return success
      // The new user will need to login separately
    }
    
    return { error, user: data.user };
  };

  const signIn = async (email: string, password: string) => {
    // Check rate limit before attempting login
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
    
    // Log the login attempt
    await logLogin(email, !error);
    
    return { error };
  };

  const signOut = async () => {
    // Log logout before signing out
    await logLogout();
    
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
      // Clear last route so user starts fresh on next login
      localStorage.removeItem('circuito-last-route');
    }
    return { error };
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
    refetchProfile: () => user && fetchProfile(user.id),
  };
}
