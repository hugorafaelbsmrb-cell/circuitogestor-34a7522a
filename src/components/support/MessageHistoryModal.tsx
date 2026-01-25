import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, MessageSquare, Image, FileText, Video, Paperclip, X, Smile, MapPin, Contact, MousePointerClick, List, Zap, Link2, Receipt, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useWapiAdvanced } from '@/hooks/useWapiAdvanced';
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
  wapi_message_id?: string | null;
}

interface MessageHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  studentNames?: string[];
}

type MediaType = 'image' | 'document' | 'video' | 'audio';

const REACTION_EMOJIS = ['👍', '❤️', '✅', '🙏', '👏', '🔥'];

const MESSAGE_EMOJIS = ['😀', '😊', '🙂', '😄', '😁', '😆', '🥰', '😍', '🤗', '👋', '👍', '👏', '🙌', '🎉', '✨', '💪', '🙏', '❤️', '💙', '💚', '✅', '⭐', '🎯', '📚', '📝', '🎓', '🏆', '🥇', '👨‍🏫', '👩‍🎓'];

interface QuickReplyTemplate {
  id: string;
  label: string;
  message: string;
  sort_order: number;
  is_active: boolean;
}

export function MessageHistoryModal({
  open,
  onOpenChange,
  guardianId,
  guardianName,
  guardianPhone,
  studentNames = [],
}: MessageHistoryModalProps) {
  const { toast } = useToast();
  const { sendMessage, checkConfig } = useWapiMessage();
  const { 
    reactToMessage, 
    markAsRead, 
    sendButtons, 
    sendList, 
    sendLocation,
    sendContact,
    sendTypingIndicator,
    isReactionsEnabled,
    isButtonsEnabled,
    isListsEnabled,
    isLocationEnabled,
    isVcardEnabled,
    isTypingEnabled,
    isLinkPreviewEnabled,
    sendLink,
  } = useWapiAdvanced();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);
  // Media attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Advanced message modals
  const [showButtonsModal, setShowButtonsModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBoletoModal, setShowBoletoModal] = useState(false);

  // Boleto selection state
  interface PendingPayment {
    id: string;
    description: string;
    due_date: string;
    value: number;
    bank_slip_url: string | null;
    invoice_url: string | null;
    status: string;
    installment_number: number | null;
  }
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [boletoMessage, setBoletoMessage] = useState('');

  // Buttons form state
  const [buttonsForm, setButtonsForm] = useState({
    message: '',
    buttons: [{ id: '1', text: '' }, { id: '2', text: '' }, { id: '3', text: '' }],
  });

  // List form state
  const [listForm, setListForm] = useState({
    message: '',
    buttonText: 'Ver opções',
    sections: [{ title: 'Opções', rows: [{ id: '1', title: '', description: '' }] }],
  });

  // Location form state
  const [locationForm, setLocationForm] = useState({
    latitude: -23.5505,
    longitude: -46.6333,
    name: '',
    address: '',
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    contactName: '',
    contactPhone: '',
  });

  // Load quick replies on mount
  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const { data, error } = await supabase
          .from('quick_reply_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data) {
          setQuickReplies(data);
        }
      } catch (error) {
        console.error('Error loading quick replies:', error);
      }
    };
    
    loadQuickReplies();
  }, []);

  useEffect(() => {
    if (open && (guardianId || guardianPhone)) {
      loadMessages();
      subscribeToMessages();
      // Mark as read when opening
      if (guardianPhone) {
        markAsRead(guardianPhone);
      }
    }
    
    return () => {
      const channelId = guardianId || guardianPhone.replace(/\D/g, '');
      supabase.removeChannel(supabase.channel(`messages-${channelId}`));
    };
  }, [open, guardianId, guardianPhone]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
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

      // Build filter conditions - only include guardian_id if it's not empty
      const filterConditions = [
        ...phoneVariants.map(p => `phone.eq.${p}`)
      ];
      
      // Only add guardian_id filter if it's a valid UUID
      if (guardianId && guardianId.length > 0) {
        filterConditions.unshift(`guardian_id.eq.${guardianId}`);
      }

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(filterConditions.join(','))
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log('Loaded messages:', data?.length || 0, 'for phone variants:', phoneVariants);
      setMessages((data || []) as WhatsAppMessage[]);
      // Scroll to bottom after loading
      setTimeout(scrollToBottom, 100);
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

  const handleReaction = async (msg: WhatsAppMessage, emoji: string) => {
    if (!msg.wapi_message_id) {
      toast({
        title: 'Não é possível reagir',
        description: 'Esta mensagem não possui ID para reação.',
        variant: 'destructive',
      });
      return;
    }
    await reactToMessage(msg.wapi_message_id, emoji);
  };

  const handleSendButtons = async () => {
    const validButtons = buttonsForm.buttons.filter(b => b.text.trim());
    if (!buttonsForm.message.trim() || validButtons.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha a mensagem e pelo menos um botão.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    const success = await sendButtons({
      phone: guardianPhone,
      message: buttonsForm.message,
      buttons: validButtons,
    });

    if (success) {
      setShowButtonsModal(false);
      setButtonsForm({ message: '', buttons: [{ id: '1', text: '' }, { id: '2', text: '' }, { id: '3', text: '' }] });
      await loadMessages();
    }
    setIsSending(false);
  };

  const handleSendList = async () => {
    const validRows = listForm.sections[0].rows.filter(r => r.title.trim());
    if (!listForm.message.trim() || validRows.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha a mensagem e pelo menos uma opção.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    const success = await sendList({
      phone: guardianPhone,
      message: listForm.message,
      buttonText: listForm.buttonText,
      sections: [{ title: listForm.sections[0].title, rows: validRows }],
    });

    if (success) {
      setShowListModal(false);
      setListForm({ message: '', buttonText: 'Ver opções', sections: [{ title: 'Opções', rows: [{ id: '1', title: '', description: '' }] }] });
      await loadMessages();
    }
    setIsSending(false);
  };

  const handleSendLocation = async () => {
    setIsSending(true);
    const success = await sendLocation({
      phone: guardianPhone,
      latitude: locationForm.latitude,
      longitude: locationForm.longitude,
      name: locationForm.name,
      address: locationForm.address,
    });

    if (success) {
      setShowLocationModal(false);
      await loadMessages();
    }
    setIsSending(false);
  };

  const handleSendContact = async () => {
    if (!contactForm.contactName.trim() || !contactForm.contactPhone.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha o nome e telefone do contato.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    const success = await sendContact({
      phone: guardianPhone,
      contactName: contactForm.contactName,
      contactPhone: contactForm.contactPhone,
    });

    if (success) {
      setShowContactModal(false);
      setContactForm({ contactName: '', contactPhone: '' });
      await loadMessages();
    }
    setIsSending(false);
  };

  // Load pending payments for the guardian
  const loadPendingPayments = async () => {
    if (!guardianId) return;
    
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, description, due_date, value, bank_slip_url, invoice_url, status, installment_number')
        .eq('guardian_id', guardianId)
        .in('status', ['PENDING', 'OVERDUE'])
        .not('bank_slip_url', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      setPendingPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: 'Erro ao carregar boletos',
        description: 'Não foi possível buscar os boletos pendentes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleOpenBoletoModal = async () => {
    setShowBoletoModal(true);
    await loadPendingPayments();
  };

  const handleSendBoleto = async () => {
    const selectedPayment = pendingPayments.find(p => p.id === selectedPaymentId);
    if (!selectedPayment) {
      toast({
        title: 'Selecione um boleto',
        description: 'Escolha um boleto para enviar.',
        variant: 'destructive',
      });
      return;
    }

    const boletoUrl = selectedPayment.bank_slip_url || selectedPayment.invoice_url;
    if (!boletoUrl) {
      toast({
        title: 'Link não disponível',
        description: 'Este boleto não possui um link para envio.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    
    // Get school name from config for the title
    const { data: configData } = await supabase
      .from('contract_config')
      .select('school_name')
      .single();
    
    const schoolName = configData?.school_name || 'Escola';
    const formattedValue = `R$ ${selectedPayment.value.toFixed(2).replace('.', ',')}`;
    const formattedDate = format(new Date(selectedPayment.due_date), 'dd/MM/yyyy', { locale: ptBR });
    
    const messageText = boletoMessage.trim() || 
      `Olá! Segue o boleto de ${selectedPayment.description || 'mensalidade'} no valor de ${formattedValue} com vencimento em ${formattedDate}.`;

    const success = await sendLink({
      phone: guardianPhone,
      url: boletoUrl,
      title: `📄 Boleto ${schoolName}`,
      description: messageText,
    });

    if (success) {
      setShowBoletoModal(false);
      setSelectedPaymentId(null);
      setBoletoMessage('');
      await loadMessages();
    }
    setIsSending(false);
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

  const addListRow = () => {
    const currentRows = listForm.sections[0].rows;
    if (currentRows.length >= 10) return;
    setListForm(prev => ({
      ...prev,
      sections: [{
        ...prev.sections[0],
        rows: [...currentRows, { id: String(currentRows.length + 1), title: '', description: '' }]
      }]
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg h-[600px] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              <span>Conversa com {guardianName}</span>
            </DialogTitle>
            {studentNames.length > 0 && (
              <p className="text-sm font-medium text-foreground">
                {studentNames.length === 1 ? 'Aluno: ' : 'Alunos: '}
                {studentNames.join(', ')}
              </p>
            )}
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
            <ScrollArea className="h-full">
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
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'} group`}
                    >
                      <div className="relative">
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
                        
                        {/* Reaction button for incoming messages */}
                        {msg.direction === 'incoming' && isReactionsEnabled() && msg.wapi_message_id && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Smile className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" side="right">
                              <div className="flex gap-1">
                                {REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(msg, emoji)}
                                    className="text-xl hover:scale-125 transition-transform p-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
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
          <div className="p-4 border-t bg-muted/30 space-y-2">
            {/* Quick Replies Row */}
            {quickReplies.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Rápidas:
                </span>
                {quickReplies.map((reply) => (
                  <Button
                    key={reply.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => setNewMessage(reply.message)}
                  >
                    {reply.label}
                  </Button>
                ))}
              </div>
            )}

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
                  
                  {/* Advanced features */}
                  <DropdownMenuSeparator />
                  {/* Boleto Link - Always show if guardian has payments */}
                  {isLinkPreviewEnabled() && (
                    <DropdownMenuItem onClick={handleOpenBoletoModal}>
                      <Link2 className="h-4 w-4 mr-2 text-emerald-500" />
                      Mensagem com Link/Boleto
                    </DropdownMenuItem>
                  )}
                  {isButtonsEnabled() && (
                    <DropdownMenuItem onClick={() => setShowButtonsModal(true)}>
                      <MousePointerClick className="h-4 w-4 mr-2 text-green-500" />
                      Botões de Resposta
                    </DropdownMenuItem>
                  )}
                  {isListsEnabled() && (
                    <DropdownMenuItem onClick={() => setShowListModal(true)}>
                      <List className="h-4 w-4 mr-2 text-cyan-500" />
                      Lista de Opções
                    </DropdownMenuItem>
                  )}
                  {isLocationEnabled() && (
                    <DropdownMenuItem onClick={() => setShowLocationModal(true)}>
                      <MapPin className="h-4 w-4 mr-2 text-red-500" />
                      Localização
                    </DropdownMenuItem>
                  )}
                  {isVcardEnabled() && (
                    <DropdownMenuItem onClick={() => setShowContactModal(true)}>
                      <Contact className="h-4 w-4 mr-2 text-indigo-500" />
                      Contato
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Emoji Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" side="top" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Inserir Emoji</p>
                    <div className="grid grid-cols-10 gap-1">
                      {MESSAGE_EMOJIS.map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setNewMessage(prev => prev + emoji);
                          }}
                          className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Typing Indicator Button */}
              {isTypingEnabled() && (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={isTyping}
                  onClick={async () => {
                    setIsTyping(true);
                    await sendTypingIndicator(guardianPhone, 3000);
                    setIsTyping(false);
                  }}
                  title="Enviar indicador de digitação"
                >
                  {isTyping ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">...</span>
                  )}
                </Button>
              )}

              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem..."
                className="min-h-[44px] max-h-[120px] resize-none"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isSending || isUploading || (!newMessage.trim() && !selectedFile)}
                className="shrink-0"
              >
                {isSending || isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buttons Modal */}
      <Dialog open={showButtonsModal} onOpenChange={setShowButtonsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              Enviar Mensagem com Botões
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={buttonsForm.message}
                onChange={(e) => setButtonsForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Digite a mensagem..."
              />
            </div>
            <div className="space-y-2">
              <Label>Botões (máx. 3)</Label>
              {buttonsForm.buttons.map((btn, index) => (
                <Input
                  key={btn.id}
                  value={btn.text}
                  onChange={(e) => {
                    const newButtons = [...buttonsForm.buttons];
                    newButtons[index].text = e.target.value;
                    setButtonsForm(prev => ({ ...prev, buttons: newButtons }));
                  }}
                  placeholder={`Botão ${index + 1}`}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowButtonsModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendButtons} disabled={isSending}>
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Modal */}
      <Dialog open={showListModal} onOpenChange={setShowListModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Enviar Lista de Opções
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={listForm.message}
                onChange={(e) => setListForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Digite a mensagem..."
              />
            </div>
            <div>
              <Label>Texto do botão</Label>
              <Input
                value={listForm.buttonText}
                onChange={(e) => setListForm(prev => ({ ...prev, buttonText: e.target.value }))}
                placeholder="Ver opções"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opções (máx. 10)</Label>
                {listForm.sections[0].rows.length < 10 && (
                  <Button variant="ghost" size="sm" onClick={addListRow}>
                    + Adicionar
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {listForm.sections[0].rows.map((row, index) => (
                    <div key={row.id} className="space-y-1">
                      <Input
                        value={row.title}
                        onChange={(e) => {
                          const newRows = [...listForm.sections[0].rows];
                          newRows[index].title = e.target.value;
                          setListForm(prev => ({
                            ...prev,
                            sections: [{ ...prev.sections[0], rows: newRows }]
                          }));
                        }}
                        placeholder={`Opção ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowListModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendList} disabled={isSending}>
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Modal */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Enviar Localização
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={locationForm.latitude}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={locationForm.longitude}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>Nome do local</Label>
              <Input
                value={locationForm.name}
                onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Escola ABC"
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={locationForm.address}
                onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ex: Rua das Flores, 123"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLocationModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendLocation} disabled={isSending}>
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Contact className="h-5 w-5" />
              Compartilhar Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do contato</Label>
              <Input
                value={contactForm.contactName}
                onChange={(e) => setContactForm(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={contactForm.contactPhone}
                onChange={(e) => setContactForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="Ex: 11999999999"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowContactModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendContact} disabled={isSending}>
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Boleto Modal */}
      <Dialog open={showBoletoModal} onOpenChange={setShowBoletoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Enviar Link de Boleto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum boleto pendente</p>
                <p className="text-sm">Este responsável não possui boletos pendentes com link disponível.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Selecione o boleto</Label>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-4">
                      {pendingPayments.map((payment) => {
                        const isSelected = selectedPaymentId === payment.id;
                        const formattedValue = `R$ ${payment.value.toFixed(2).replace('.', ',')}`;
                        const formattedDate = format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: ptBR });
                        const isOverdue = new Date(payment.due_date) < new Date();

                        return (
                          <div
                            key={payment.id}
                            onClick={() => setSelectedPaymentId(payment.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-sm">
                                  {payment.description || 'Mensalidade'}
                                  {payment.installment_number && ` - Parcela ${payment.installment_number}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Vencimento: {formattedDate}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm">{formattedValue}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isOverdue 
                                    ? 'bg-destructive/10 text-destructive' 
                                    : 'bg-amber-500/10 text-amber-700'
                                }`}>
                                  {isOverdue ? 'Vencido' : 'Pendente'}
                                </span>
                              </div>
                            </div>
                            {(payment.bank_slip_url || payment.invoice_url) && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <ExternalLink className="h-3 w-3" />
                                <span>Link disponível</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <Label>Mensagem (opcional)</Label>
                  <Textarea
                    value={boletoMessage}
                    onChange={(e) => setBoletoMessage(e.target.value)}
                    placeholder="Olá! Segue o boleto de mensalidade..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para usar a mensagem padrão.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBoletoModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSendBoleto} 
                disabled={isSending || !selectedPaymentId || pendingPayments.length === 0}
              >
                {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Boleto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
