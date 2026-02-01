import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Phone, Send, Loader2, Image, FileText, Paperclip, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileQuickReplies } from './MobileQuickReplies';
import { ConversationData } from './MobileConversationItem';
import { supabase } from '@/integrations/supabase/client';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useWapiAdvanced } from '@/hooks/useWapiAdvanced';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface MobileChatViewProps {
  conversation: ConversationData;
  onBack: () => void;
}

export function MobileChatView({ conversation, onBack }: MobileChatViewProps) {
  const { toast } = useToast();
  const { sendMessage, checkConfig } = useWapiMessage();
  const { markAsRead } = useWapiAdvanced();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    loadMessages();
    markAsRead(conversation.phone);

    // Subscribe to new messages
    const cleanPhone = conversation.phone.replace(/\D/g, '');
    const channel = supabase
      .channel(`mobile-chat-${cleanPhone}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          const newMsg = payload.new as WhatsAppMessage;
          const msgPhone = newMsg.phone.replace(/\D/g, '');
          // Check if message belongs to this conversation
          if (msgPhone.slice(-8) === cleanPhone.slice(-8)) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.phone]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const cleanPhone = conversation.phone.replace(/\D/g, '');
      
      // Generate phone variants for matching
      const phoneVariantsSet = new Set<string>();
      phoneVariantsSet.add(cleanPhone);
      
      if (cleanPhone.startsWith('55')) {
        phoneVariantsSet.add(cleanPhone.slice(2));
      } else {
        phoneVariantsSet.add(`55${cleanPhone}`);
      }
      
      const withoutCountry = cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone;
      if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
        const withoutExtra9 = withoutCountry.slice(0, 2) + withoutCountry.slice(3);
        phoneVariantsSet.add(withoutExtra9);
        phoneVariantsSet.add(`55${withoutExtra9}`);
      } else if (withoutCountry.length === 10) {
        const withExtra9 = withoutCountry.slice(0, 2) + '9' + withoutCountry.slice(2);
        phoneVariantsSet.add(withExtra9);
        phoneVariantsSet.add(`55${withExtra9}`);
      }
      
      const phoneVariants = Array.from(phoneVariantsSet);
      const filterConditions = phoneVariants.map(p => `phone.eq.${p}`);
      
      if (conversation.id && conversation.isRegistered) {
        filterConditions.unshift(`guardian_id.eq.${conversation.id}`);
      }

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(filterConditions.join(','))
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages((data || []) as WhatsAppMessage[]);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Erro ao carregar mensagens',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API nas configurações.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      let mediaUrl: string | undefined;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `whatsapp-media/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('system-branding')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('system-branding')
          .getPublicUrl(filePath);

        mediaUrl = urlData.publicUrl;
      }

      const success = await sendMessage({
        phone: conversation.phone,
        message: newMessage.trim() || (selectedFile?.name || ''),
        mediaUrl,
        mediaType: selectedFile ? (selectedFile.type.startsWith('image/') ? 'image' : 'document') : undefined,
        fileName: selectedFile?.name,
        caption: newMessage.trim() || undefined,
      });

      if (success) {
        setNewMessage('');
        setSelectedFile(null);
        await loadMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = (message: string) => {
    setNewMessage(message);
    textareaRef.current?.focus();
  };

  const openWhatsApp = () => {
    const cleanPhone = conversation.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const getInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const groupMessagesByDate = (msgs: WhatsAppMessage[]) => {
    const groups: { date: string; messages: WhatsAppMessage[] }[] = [];
    let currentDate = '';
    
    msgs.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'dd/MM/yyyy');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    
    return groups;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-2 py-3 bg-background/95 backdrop-blur-sm border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.avatarUrl || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(conversation.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate">{conversation.name}</h2>
          {conversation.studentNames.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {conversation.studentNames.join(', ')}
            </p>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={openWhatsApp} className="h-10 w-10">
          <Phone className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-center">
              Nenhuma mensagem ainda.<br />
              Envie a primeira mensagem!
            </p>
          </div>
        ) : (
          <>
            {groupMessagesByDate(messages).map((group) => (
              <div key={group.date}>
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direction === 'outgoing' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] px-3 py-2 rounded-2xl",
                          msg.direction === 'outgoing'
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {msg.media_url && msg.media_type === 'image' && (
                          <img 
                            src={msg.media_url} 
                            alt="Imagem" 
                            className="max-w-full rounded-lg mb-1"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <p className={cn(
                          "text-[10px] text-right mt-0.5",
                          msg.direction === 'outgoing' 
                            ? "text-primary-foreground/70" 
                            : "text-muted-foreground"
                        )}>
                          {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Replies */}
      <MobileQuickReplies 
        onSelect={handleQuickReply}
        studentName={conversation.studentNames[0]}
      />

      {/* File Preview */}
      {selectedFile && previewUrl && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <div className="relative inline-block">
            {selectedFile.type.startsWith('image/') ? (
              <img src={previewUrl} alt="Preview" className="h-20 rounded-lg" />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <FileText className="h-5 w-5" />
                <span className="text-sm truncate max-w-32">{selectedFile.name}</span>
              </div>
            )}
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="sticky bottom-0 flex items-end gap-2 p-3 border-t bg-background">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setSelectedFile(file);
            e.target.value = '';
          }}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="h-10 w-10 flex-shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="min-h-10 max-h-32 resize-none py-2.5"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />

        <Button
          onClick={handleSendMessage}
          disabled={isSending || (!newMessage.trim() && !selectedFile)}
          size="icon"
          className="h-10 w-10 flex-shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
