import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY_API = 'external_api_key';
const STORAGE_KEY_URL = 'external_api_base_url';
const DEFAULT_BASE_URL = 'https://qdfpgpoesihluwlatrlz.supabase.co/functions/v1';

export function useExternalApiConfig() {
  const { toast } = useToast();
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(STORAGE_KEY_API) || '');
  const [baseUrl, setBaseUrlState] = useState(() => localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_BASE_URL);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const setApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY_API, key);
    setApiKeyState(key);
    setConnectionStatus('idle');
  };

  const setBaseUrl = (url: string) => {
    localStorage.setItem(STORAGE_KEY_URL, url);
    setBaseUrlState(url);
    setConnectionStatus('idle');
  };

  const isConfigured = !!apiKey && !!baseUrl;

  const testConnection = async () => {
    if (!isConfigured) return;
    
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const response = await fetch(`${baseUrl}/api-categories`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: 'Conexão bem-sucedida',
          description: 'A API está respondendo corretamente',
        });
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: 'Falha na conexão',
        description: 'Verifique a URL e a chave de API',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return {
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    isConfigured,
    testConnection,
    isTestingConnection,
    connectionStatus,
  };
}
