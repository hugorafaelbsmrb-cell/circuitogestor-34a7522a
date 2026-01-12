import { useEffect, useCallback, useRef } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // Show warning 2 minutes before timeout

export function useInactivityTimeout() {
  const { signOut, isAuthenticated } = useAuthContext();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    warningShownRef.current = false;
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    toast({
      title: 'Sessão expirada',
      description: 'Você foi desconectado por inatividade.',
      variant: 'destructive',
    });
    await signOut();
  }, [signOut, toast, clearAllTimers]);

  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast({
        title: 'Aviso de inatividade',
        description: 'Sua sessão expirará em 2 minutos por inatividade. Mova o mouse ou pressione uma tecla para continuar.',
      });
    }
  }, [toast]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    clearAllTimers();
    warningShownRef.current = false;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, handleLogout, showWarning, clearAllTimers]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      return;
    }

    // Events to track for activity
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle reset to avoid excessive timer resets
    let lastResetTime = Date.now();
    const throttleMs = 1000; // Only reset timer at most once per second

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > throttleMs) {
        lastResetTime = now;
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [isAuthenticated, resetTimer, clearAllTimers]);

  return { resetTimer };
}
