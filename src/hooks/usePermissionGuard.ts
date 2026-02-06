import { useEffect, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';

interface UsePermissionGuardOptions {
  requiredRole?: AppRole;
  requiredPermission?: string;
  adminBypass?: boolean;
}

/**
 * Hook to check if the current user has the required permissions
 */
export function usePermissionGuard(options: UsePermissionGuardOptions = {}) {
  const { requiredRole, requiredPermission, adminBypass = true } = options;
  const { profile, isLoading: authLoading } = useAuthContext();
  const { isAdmin, hasRole, isLoading: roleLoading } = useUserRole();

  const isLoading = authLoading || roleLoading;

  const hasPermission = useCallback((): boolean => {
    if (isLoading) return false;

    // Admins bypass permission checks
    if (adminBypass && isAdmin) return true;

    // Check required role
    if (requiredRole && !hasRole(requiredRole)) {
      return false;
    }

    // Check required permission from profile
    if (requiredPermission && profile?.permissions) {
      const permissions = profile.permissions as Record<string, boolean | undefined>;
      if (permissions[requiredPermission] === false) {
        return false;
      }
    }

    return true;
  }, [isLoading, adminBypass, isAdmin, requiredRole, hasRole, requiredPermission, profile?.permissions]);

  return {
    hasPermission: hasPermission(),
    isLoading,
    isAdmin,
    profile,
  };
}
