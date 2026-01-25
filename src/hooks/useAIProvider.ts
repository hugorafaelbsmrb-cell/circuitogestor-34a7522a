import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AIProvider = 'lovable' | 'huggingface';

export function useAIProvider() {
  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProvider();
  }, []);

  const fetchProvider = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'AI_PROVIDER')
        .maybeSingle();

      if (!error && data?.value) {
        setProvider(data.value as AIProvider);
      }
    } catch (error) {
      console.error('Error fetching AI provider:', error);
    }
    setIsLoading(false);
  };

  const updateProvider = async (newProvider: AIProvider) => {
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'AI_PROVIDER')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: newProvider })
          .eq('key', 'AI_PROVIDER');
      } else {
        await supabase
          .from('app_settings')
          .insert({
            key: 'AI_PROVIDER',
            value: newProvider,
            description: 'Provedor de IA para análise de mensagens',
            is_secret: false,
          });
      }

      setProvider(newProvider);
      return true;
    } catch (error) {
      console.error('Error updating AI provider:', error);
      return false;
    }
  };

  const getAnalyzeFunctionName = () => {
    return provider === 'huggingface' 
      ? 'huggingface-analyze-messages' 
      : 'analyze-messages';
  };

  const getGenerateFunctionName = () => {
    return provider === 'huggingface' 
      ? 'huggingface-generate-message' 
      : 'generate-message';
  };

  return {
    provider,
    isLoading,
    updateProvider,
    getAnalyzeFunctionName,
    getGenerateFunctionName,
    refetch: fetchProvider,
  };
}
