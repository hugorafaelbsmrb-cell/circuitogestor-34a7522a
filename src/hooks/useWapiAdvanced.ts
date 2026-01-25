import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';

interface ButtonOption {
  id: string;
  text: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface SendButtonsParams {
  phone: string;
  title?: string;
  message: string;
  footer?: string;
  buttons: ButtonOption[];
}

interface SendListParams {
  phone: string;
  title?: string;
  message: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
}

interface SendLinkParams {
  phone: string;
  url: string;
  title?: string;
  description?: string;
  previewImage?: string;
}

interface SendStickerParams {
  phone: string;
  stickerUrl: string;
}

interface SendLocationParams {
  phone: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface SendContactParams {
  phone: string;
  contactName: string;
  contactPhone: string;
}

export function useWapiAdvanced() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isEnabled } = useAutomationSettings();

  const sendTypingIndicator = useCallback(async (phone: string, duration = 2500): Promise<boolean> => {
    if (!isEnabled('wapi_feature_typing')) {
      return true; // Skip if feature is disabled
    }

    try {
      const response = await supabase.functions.invoke('wapi-typing', {
        body: { phone, duration },
      });

      return !response.error;
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      return false;
    }
  }, [isEnabled]);

  const reactToMessage = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
    if (!isEnabled('wapi_feature_reactions')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Reações com Emojis" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('wapi-react', {
        body: { messageId, emoji },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Reação enviada',
        description: `Você reagiu com ${emoji}`,
      });
      return true;
    } catch (error) {
      console.error('Error reacting to message:', error);
      toast({
        title: 'Erro ao reagir',
        description: 'Não foi possível enviar a reação.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, toast]);

  const markAsRead = useCallback(async (phone: string): Promise<boolean> => {
    if (!isEnabled('wapi_feature_mark_read')) {
      return true; // Skip if feature is disabled
    }

    try {
      const response = await supabase.functions.invoke('wapi-mark-read', {
        body: { phone },
      });

      return !response.error;
    } catch (error) {
      console.error('Error marking as read:', error);
      return false;
    }
  }, [isEnabled]);

  const sendButtons = useCallback(async (params: SendButtonsParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_buttons')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Botões de Resposta" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      // Send typing indicator first if enabled
      await sendTypingIndicator(params.phone);

      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'buttons',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Mensagem enviada',
        description: 'Mensagem com botões enviada com sucesso.',
      });
      return true;
    } catch (error) {
      console.error('Error sending buttons:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem com botões.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, sendTypingIndicator, toast]);

  const sendList = useCallback(async (params: SendListParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_lists')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Listas de Opções" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      await sendTypingIndicator(params.phone);

      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'list',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Lista enviada',
        description: 'Lista de opções enviada com sucesso.',
      });
      return true;
    } catch (error) {
      console.error('Error sending list:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a lista.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, sendTypingIndicator, toast]);

  const sendLink = useCallback(async (params: SendLinkParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_link_preview')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Preview de Links" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      await sendTypingIndicator(params.phone);

      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'link',
          linkTitle: params.title,
          linkDescription: params.description,
          linkPreviewImage: params.previewImage,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Link enviado',
        description: 'Link com preview enviado com sucesso.',
      });
      return true;
    } catch (error) {
      console.error('Error sending link:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o link.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, sendTypingIndicator, toast]);

  const sendSticker = useCallback(async (params: SendStickerParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_stickers')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Stickers" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'sticker',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Sticker enviado',
      });
      return true;
    } catch (error) {
      console.error('Error sending sticker:', error);
      toast({
        title: 'Erro ao enviar sticker',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, toast]);

  const sendLocation = useCallback(async (params: SendLocationParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_location')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Localização" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      await sendTypingIndicator(params.phone);

      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'location',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Localização enviada',
      });
      return true;
    } catch (error) {
      console.error('Error sending location:', error);
      toast({
        title: 'Erro ao enviar localização',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, sendTypingIndicator, toast]);

  const sendContact = useCallback(async (params: SendContactParams): Promise<boolean> => {
    if (!isEnabled('wapi_feature_vcard')) {
      toast({
        title: 'Recurso desativado',
        description: 'Ative "Compartilhar Contatos" nas configurações.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      await sendTypingIndicator(params.phone);

      const response = await supabase.functions.invoke('wapi-send-advanced', {
        body: {
          ...params,
          messageType: 'contact',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Contato enviado',
      });
      return true;
    } catch (error) {
      console.error('Error sending contact:', error);
      toast({
        title: 'Erro ao enviar contato',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, sendTypingIndicator, toast]);

  return {
    isLoading,
    sendTypingIndicator,
    reactToMessage,
    markAsRead,
    sendButtons,
    sendList,
    sendLink,
    sendSticker,
    sendLocation,
    sendContact,
    // Feature check helpers
    isButtonsEnabled: () => isEnabled('wapi_feature_buttons'),
    isListsEnabled: () => isEnabled('wapi_feature_lists'),
    isReactionsEnabled: () => isEnabled('wapi_feature_reactions'),
    isTypingEnabled: () => isEnabled('wapi_feature_typing'),
    isMarkReadEnabled: () => isEnabled('wapi_feature_mark_read'),
    isLinkPreviewEnabled: () => isEnabled('wapi_feature_link_preview'),
    isStickersEnabled: () => isEnabled('wapi_feature_stickers'),
    isLocationEnabled: () => isEnabled('wapi_feature_location'),
    isVcardEnabled: () => isEnabled('wapi_feature_vcard'),
  };
}
