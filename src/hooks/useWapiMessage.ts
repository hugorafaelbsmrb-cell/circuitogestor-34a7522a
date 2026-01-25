import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendMessageParams {
  phone: string;
  message: string;
  isGroup?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  fileName?: string;
  caption?: string;
}

interface WapiConfig {
  url: string | null;
  token: string | null;
  session: string | null;
  isConfigured: boolean;
}

export function useWapiMessage() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendMessage = async ({ 
    phone, 
    message, 
    isGroup = false,
    mediaUrl,
    mediaType,
    fileName,
    caption,
  }: SendMessageParams): Promise<boolean> => {
    setIsSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        toast({
          title: 'Erro de autenticação',
          description: 'Você precisa estar logado para enviar mensagens.',
          variant: 'destructive',
        });
        setIsSending(false);
        return false;
      }

      const response = await supabase.functions.invoke('wapi-send-message', {
        body: { phone, message, isGroup, mediaUrl, mediaType, fileName, caption },
      });

      if (response.error) {
        const errorData = response.error.message ? JSON.parse(response.error.message) : { error: 'Erro desconhecido' };
        
        if (errorData.missing) {
          toast({
            title: 'Configuração incompleta',
            description: 'Configure a API W-API nas configurações do sistema.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao enviar',
            description: errorData.error || 'Não foi possível enviar a mensagem.',
            variant: 'destructive',
          });
        }
        setIsSending(false);
        return false;
      }

      const mediaTypeLabel = mediaType === 'image' ? 'Imagem' : 
                            mediaType === 'document' ? 'Documento' : 
                            mediaType === 'video' ? 'Vídeo' :
                            mediaType === 'audio' ? 'Áudio' : 'Mensagem';

      toast({
        title: `${mediaTypeLabel} enviado(a)`,
        description: mediaType ? `${mediaTypeLabel} enviado(a) com sucesso.` : 'A mensagem foi enviada com sucesso via WhatsApp.',
      });
      
      setIsSending(false);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro ao enviar a mensagem.',
        variant: 'destructive',
      });
      setIsSending(false);
      return false;
    }
  };

  const checkConfig = async (): Promise<WapiConfig> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['W_API_URL', 'W_API_TOKEN', 'W_API_SESSION']);

      if (error) throw error;

      const config: WapiConfig = {
        url: null,
        token: null,
        session: null,
        isConfigured: false,
      };

      data?.forEach(s => {
        if (s.key === 'W_API_URL') config.url = s.value;
        if (s.key === 'W_API_TOKEN') config.token = s.value;
        if (s.key === 'W_API_SESSION') config.session = s.value;
      });

      config.isConfigured = !!(config.url && config.token && config.session);
      
      return config;
    } catch (error) {
      console.error('Error checking W-API config:', error);
      return { url: null, token: null, session: null, isConfigured: false };
    }
  };

  return {
    sendMessage,
    checkConfig,
    isSending,
  };
}
