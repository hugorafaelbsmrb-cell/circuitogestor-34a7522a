import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemBranding {
  name: string;
  logo: string | null;
}

const DEFAULT_NAME = 'EduGestor';

export function useSystemBranding() {
  const [branding, setBranding] = useState<SystemBranding>({
    name: DEFAULT_NAME,
    logo: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['system_name', 'system_logo']);

      if (data) {
        const nameEntry = data.find(d => d.key === 'system_name');
        const logoEntry = data.find(d => d.key === 'system_logo');
        
        setBranding({
          name: nameEntry?.value || DEFAULT_NAME,
          logo: logoEntry?.value || null,
        });
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    }
    setIsLoading(false);
  };

  const updateBranding = async (newBranding: Partial<SystemBranding>) => {
    const updates = [];
    
    if (newBranding.name !== undefined) {
      updates.push(upsertSetting('system_name', newBranding.name, 'Nome do sistema'));
    }
    
    if (newBranding.logo !== undefined) {
      updates.push(upsertSetting('system_logo', newBranding.logo, 'Logo do sistema'));
    }

    await Promise.all(updates);
    await fetchBranding();
  };

  const upsertSetting = async (key: string, value: string | null, description: string) => {
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', key);
    } else {
      await supabase
        .from('app_settings')
        .insert({
          key,
          value,
          description,
          is_secret: false,
        });
    }
  };

  return {
    branding,
    isLoading,
    updateBranding,
    refetch: fetchBranding,
  };
}
