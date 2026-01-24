import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AutomationSetting {
  id: string;
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  description: string | null;
}

export function useAutomationSettings() {
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('automation_settings')
      .select('*');
    
    if (!error && data) {
      setSettings(data.map(s => ({
        ...s,
        config: typeof s.config === 'string' ? JSON.parse(s.config) : (s.config || {}),
      })));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isEnabled = useCallback((key: string): boolean => {
    const setting = settings.find(s => s.key === key);
    return setting?.enabled || false;
  }, [settings]);

  const getConfig = useCallback((key: string): Record<string, any> | null => {
    const setting = settings.find(s => s.key === key);
    return setting?.config || null;
  }, [settings]);

  return {
    settings,
    isLoading,
    isEnabled,
    getConfig,
    refetch: fetchSettings,
  };
}