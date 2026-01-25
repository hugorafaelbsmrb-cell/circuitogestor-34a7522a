import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemBranding {
  name: string;
  logo: string | null;
  favicon: string | null;
  browserTitle: string | null;
}

const DEFAULT_NAME = 'Circuito Kids';
const DEFAULT_BROWSER_TITLE = 'Circuito Kids';
const DEFAULT_FAVICON = '/favicon.png';

export function useSystemBranding() {
  const [branding, setBranding] = useState<SystemBranding>({
    name: DEFAULT_NAME,
    logo: null,
    favicon: null,
    browserTitle: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBranding();
  }, []);

  // Apply favicon and browser title when branding changes
  useEffect(() => {
    // Update browser title
    const title = branding.browserTitle || branding.name || DEFAULT_BROWSER_TITLE;
    document.title = title;

    // Update favicon - always set one
    const faviconUrl = branding.favicon || DEFAULT_FAVICON;
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = faviconUrl;
  }, [branding.favicon, branding.browserTitle, branding.name]);

  const fetchBranding = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['system_name', 'system_logo', 'system_favicon', 'system_browser_title']);

      if (data) {
        const nameEntry = data.find(d => d.key === 'system_name');
        const logoEntry = data.find(d => d.key === 'system_logo');
        const faviconEntry = data.find(d => d.key === 'system_favicon');
        const browserTitleEntry = data.find(d => d.key === 'system_browser_title');
        
        setBranding({
          name: nameEntry?.value || DEFAULT_NAME,
          logo: logoEntry?.value || null,
          favicon: faviconEntry?.value || null,
          browserTitle: browserTitleEntry?.value || null,
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

    if (newBranding.favicon !== undefined) {
      updates.push(upsertSetting('system_favicon', newBranding.favicon, 'Favicon do sistema'));
    }

    if (newBranding.browserTitle !== undefined) {
      updates.push(upsertSetting('system_browser_title', newBranding.browserTitle, 'Título na aba do navegador'));
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
