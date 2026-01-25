import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, MessageSquare, Image, FileText, Video, Paperclip, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type MediaType = 'image' | 'document' | 'video' | 'audio';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Media attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  // Clean up preview URL when file changes
  useEffect(() => {
    if (selectedFile && (selectedMediaType === 'image' || selectedMediaType === 'video')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, selectedMediaType]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      // Get messages by guardian_id or phone
      const cleanPhone = guardianPhone.replace(/\D/g, '');
      const phoneVariants = [
        cleanPhone,
        cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`,
        // Add more common formats
        cleanPhone.length === 11 && cleanPhone.startsWith('9') ? `55${cleanPhone}` : null,
        cleanPhone.length === 13 ? cleanPhone : null,
      ].filter(Boolean) as string[];

      // Build filter conditions - use separate queries for reliability
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(
          [
            `guardian_id.eq.${guardianId}`,
            ...phoneVariants.map(p => `phone.eq.${p}`)
          ].join(',')
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log('Loaded messages:', data?.length || 0, 'for phone variants:', phoneVariants);
      setMessages((data || []) as WhatsAppMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Erro ao carregar mensagens',
        description: 'Não foi possível carregar o histórico.',
        variant: 'destructive',
      });
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

  const handleFileSelect = (type: MediaType) => {
    setSelectedMediaType(type);
    
    if (fileInputRef.current) {
      switch (type) {
        case 'image':
          fileInputRef.current.accept = 'image/jpeg,image/png,image/webp';
          break;
        case 'video':
          fileInputRef.current.accept = 'video/mp4,video/3gpp';
          break;
        case 'document':
          fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
          break;
        case 'audio':
          fileInputRef.current.accept = 'audio/mpeg,audio/aac,audio/ogg,audio/mp4';
          break;
      }
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size
      const maxSize = selectedMediaType === 'document' ? 100 * 1024 * 1024 : 
                      selectedMediaType === 'image' ? 5 * 1024 * 1024 : 
                      16 * 1024 * 1024;
      
      if (file.size > maxSize) {
        const sizeMB = Math.round(maxSize / 1024 / 1024);
        toast({
          title: 'Arquivo muito grande',
          description: `O tamanho máximo permitido é ${sizeMB}MB.`,
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setSelectedMediaType(null);
    setPreviewUrl(null);
  };

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `whatsapp-media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('system-branding')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('system-branding')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

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
      let mediaUrl: string | undefined;
      
      // Upload file if selected
      if (selectedFile && selectedMediaType) {
        setIsUploading(true);
        mediaUrl = (await uploadFileToStorage(selectedFile)) || undefined;
        setIsUploading(false);
        
        if (!mediaUrl) {
          throw new Error('Falha ao fazer upload do arquivo');
        }
      }

      const success = await sendMessage({
        phone: guardianPhone,
        message: newMessage.trim() || (selectedFile?.name || ''),
        mediaUrl,
        mediaType: selectedMediaType || undefined,
        fileName: selectedFile?.name,
        caption: newMessage.trim() || undefined,
      });

      if (success) {
        setNewMessage('');
        clearSelectedFile();
        // Reload messages to show the new one
        await loadMessages();
      } else {
        throw new Error('Falha no envio');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMediaPreview = (msg: WhatsAppMessage) => {
    if (!msg.media_url) return null;

    switch (msg.media_type) {
      case 'image':
        return (
          <img
            src={msg.media_url}
            alt="Imagem"
            className="max-w-full rounded mb-2 cursor-pointer hover:opacity-90"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
        );
      case 'video':
        return (
          <video
            src={msg.media_url}
            controls
            className="max-w-full rounded mb-2"
          />
        );
      case 'document':
        return (
          <a
            href={msg.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-black/10 rounded mb-2 hover:bg-black/20"
          >
            <FileText className="h-5 w-5" />
            <span className="text-sm underline">Abrir documento</span>
          </a>
        );
      case 'audio':
        return (
          <audio
            src={msg.media_url}
            controls
            className="max-w-full mb-2"
          />
        );
      default:
        return null;
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

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

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
                      {renderMediaPreview(msg)}
                      {msg.message && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      )}
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

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="px-4 py-2 bg-muted/50 border-t flex items-center gap-3">
            {previewUrl && selectedMediaType === 'image' && (
              <img src={previewUrl} alt="Preview" className="h-12 w-12 object-cover rounded" />
            )}
            {previewUrl && selectedMediaType === 'video' && (
              <video src={previewUrl} className="h-12 w-12 object-cover rounded" />
            )}
            {selectedMediaType === 'document' && (
              <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            {selectedMediaType === 'audio' && (
              <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                🎵
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelectedFile}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            {/* Attachment Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleFileSelect('image')}>
                  <Image className="h-4 w-4 mr-2 text-blue-500" />
                  Imagem
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFileSelect('video')}>
                  <Video className="h-4 w-4 mr-2 text-purple-500" />
                  Vídeo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFileSelect('document')}>
                  <FileText className="h-4 w-4 mr-2 text-orange-500" />
                  Documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedFile ? "Adicione uma legenda (opcional)..." : "Digite sua mensagem..."}
              className="resize-none min-h-[60px]"
              rows={2}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || isUploading || (!newMessage.trim() && !selectedFile)}
              className="h-auto bg-green-600 hover:bg-green-700"
            >
              {isSending || isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            📎 Anexar mídia • Enter para enviar • Shift+Enter para nova linha
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}