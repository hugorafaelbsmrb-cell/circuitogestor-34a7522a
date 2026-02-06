import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';

interface UseAdminGuardOptions {
  redirectTo?: string;
  showToast?: boolean;
}

/**
 * Hook to protect admin-only pages
 * Redirects non-admin users away from admin pages
 */
export function useAdminGuard(options: UseAdminGuardOptions = {}) {
  const { redirectTo = '/', showToast = true } = options;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const isLoading = authLoading || roleLoading;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isAdmin) {
      if (showToast) {
        toast({
          title: 'Acesso negado',
          description: 'Você não tem permissão para acessar esta página.',
          variant: 'destructive',
        });
      }
      navigate(redirectTo, { replace: true });
    }
  }, [isLoading, isAuthenticated, isAdmin, navigate, redirectTo, showToast, toast]);

  return {
    isAdmin,
    isLoading,
    isAuthorized: !isLoading && isAuthenticated && isAdmin,
  };
}
