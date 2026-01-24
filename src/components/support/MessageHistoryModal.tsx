import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppMessage {
  id: string;
  guardian_id: string | null;
  phone: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
}

interface MessageHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
}

export function MessageHistoryModal({
  open,
  onOpenChange,
  guardianId,
  guardianName,
  guardianPhone,
}: MessageHistoryModalProps) {
  const { toast } = useToast();
  const { sendMessage, checkConfig } = useWapiMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open && guardianId) {
      loadMessages();
      subscribeToMessages();
    }
    
    return () => {
      supabase.removeChannel(supabase.channel(`messages-${guardianId}`));
    };
  }, [open, guardianId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      // Get messages by guardian_id or phone
      const cleanPhone = guardianPhone.replace(/\D/g, '');
      const phoneVariants = [
        cleanPhone,
        cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`,
      ];

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`guardian_id.eq.${guardianId},phone.in.(${phoneVariants.join(',')})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as WhatsAppMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages-${guardianId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `guardian_id=eq.${guardianId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API em Configurações > WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const success = await sendMessage({
        phone: guardianPhone,
        message: newMessage.trim(),
      });

      if (success) {
        // Store the outgoing message
        await supabase.from('whatsapp_messages').insert({
          guardian_id: guardianId,
          phone: guardianPhone.replace(/\D/g, ''),
          message: newMessage.trim(),
          direction: 'outgoing',
          status: 'sent',
        });

        setNewMessage('');
        toast({
          title: 'Mensagem enviada',
          description: 'A mensagem foi enviada com sucesso.',
        });
      } else {
        throw new Error('Falha no envio');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <span>Conversa com {guardianName}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{guardianPhone}</p>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Envie uma mensagem para iniciar a conversa</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.direction === 'outgoing'
                          ? 'bg-green-600 text-white rounded-br-none'
                          : 'bg-muted text-foreground rounded-bl-none'
                      }`}
                    >
                      {msg.media_url && msg.media_type === 'image' && (
                        <img
                          src={msg.media_url}
                          alt="Media"
                          className="max-w-full rounded mb-2"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <div
                        className={`text-xs mt-1 ${
                          msg.direction === 'outgoing' ? 'text-green-200' : 'text-muted-foreground'
                        }`}
                      >
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="resize-none min-h-[60px]"
              rows={2}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !newMessage.trim()}
              className="h-auto bg-green-600 hover:bg-green-700"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Pressione Enter para enviar, Shift+Enter para nova linha
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
