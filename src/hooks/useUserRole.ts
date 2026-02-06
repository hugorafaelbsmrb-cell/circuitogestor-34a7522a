import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UserRoleResult {
  roles: AppRole[];
  isAdmin: boolean;
  isModerator: boolean;
  hasRole: (role: AppRole) => boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useUserRole(): UserRoleResult {
  const { user } = useAuthContext();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    if (!user?.id) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
      } else {
        // Cast the role strings to AppRole type
        const userRoles = (data || []).map(r => r.role as AppRole);
        setRoles(userRoles);
      }
    } catch (err) {
      console.error('Error in useUserRole:', err);
      setRoles([]);
    }

    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const hasRole = useCallback((role: AppRole): boolean => {
    return roles.includes(role);
  }, [roles]);

  return {
    roles,
    isAdmin: roles.includes('admin'),
    isModerator: roles.includes('moderator'),
    hasRole,
    isLoading,
    refetch: fetchRoles,
  };
}

// Server-side role check via edge function (for critical operations)
export async function checkAdminRole(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-admin-role`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return false;
    
    const data = await response.json();
    return data.isAdmin === true;
  } catch {
    return false;
  }
}
