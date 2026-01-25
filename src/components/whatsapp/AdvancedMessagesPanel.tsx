import { useState } from 'react';
import {
  List,
  Link2,
  Sticker,
  MapPin,
  Image,
  FileText,
  Video,
  Music,
  Plus,
  Trash2,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useWapiAdvanced } from '@/hooks/useWapiAdvanced';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { supabase } from '@/integrations/supabase/client';

interface ListOption {
  id: string;
  title: string;
  description: string;
}

interface AdvancedMessagesPanelProps {
  selectedRecipients: Set<string>;
  recipients: Array<{
    id: string;
    name: string;
    phone: string;
    studentNames: string[];
    courseNames: string[];
  }>;
}

const SEND_DELAY_MS = 3500;

export function AdvancedMessagesPanel({ selectedRecipients, recipients }: AdvancedMessagesPanelProps) {
  const { toast } = useToast();
  const { sendList, sendLink, sendSticker, sendLocation } = useWapiAdvanced();
  const { sendMessage, checkConfig } = useWapiMessage();

  // Panel state
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  // List options state
  const [listTitle, setListTitle] = useState('');
  const [listMessage, setListMessage] = useState('');
  const [listButtonText, setListButtonText] = useState('Ver opções');
  const [listOptions, setListOptions] = useState<ListOption[]>([
    { id: '1', title: '', description: '' },
  ]);

  // Link preview state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');

  // Sticker state
  const [stickerUrl, setStickerUrl] = useState('');

  // Location state
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');

  // Media state
  const [mediaType, setMediaType] = useState<'image' | 'document' | 'video' | 'audio'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');

  const togglePanel = (panel: string) => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getFilteredRecipients = () => {
    return recipients.filter(r => selectedRecipients.has(r.id));
  };

  const personalizeText = (text: string, recipient: typeof recipients[0]) => {
    return text
      .replace(/{nome_responsavel}/g, recipient.name)
      .replace(/{nome}/g, recipient.name)
      .replace(/{nome_aluno}/g, recipient.studentNames[0] || '')
      .replace(/{nomes_alunos}/g, recipient.studentNames.join(', ') || '')
      .replace(/{curso}/g, recipient.courseNames[0] || '')
      .replace(/{cursos}/g, recipient.courseNames.join(', ') || '');
  };

  // List handlers
  const addListOption = () => {
    if (listOptions.length >= 10) {
      toast({
        title: 'Limite atingido',
        description: 'Máximo de 10 opções permitidas.',
        variant: 'destructive',
      });
      return;
    }
    setListOptions([...listOptions, { id: String(listOptions.length + 1), title: '', description: '' }]);
  };

  const removeListOption = (index: number) => {
    if (listOptions.length <= 1) return;
    setListOptions(listOptions.filter((_, i) => i !== index));
  };

  const updateListOption = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...listOptions];
    updated[index][field] = value;
    setListOptions(updated);
  };

  const handleSendList = async () => {
    if (!listMessage.trim() || listOptions.some(o => !o.title.trim())) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha a mensagem e todas as opções.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API na aba Conexão.',
        variant: 'destructive',
      });
      return;
    }

    const recipientsToSend = getFilteredRecipients();
    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      const personalizedMessage = personalizeText(listMessage, recipient);
      const personalizedTitle = listTitle ? personalizeText(listTitle, recipient) : undefined;

      const success = await sendList({
        phone: recipient.phone,
        title: personalizedTitle,
        message: personalizedMessage,
        buttonText: listButtonText,
        sections: [{
          title: 'Opções',
          rows: listOptions.map((o, idx) => ({
            id: String(idx + 1),
            title: o.title,
            description: o.description || undefined,
          })),
        }],
      });

      if (success) successCount++;
      else errorCount++;

      setSendProgress(((i + 1) / recipientsToSend.length) * 100);

      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setIsSending(false);
    toast({
      title: 'Envio concluído',
      description: `${successCount} listas enviadas${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const handleSendLink = async () => {
    if (!linkUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe a URL do link.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API na aba Conexão.',
        variant: 'destructive',
      });
      return;
    }

    const recipientsToSend = getFilteredRecipients();
    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];

      const success = await sendLink({
        phone: recipient.phone,
        url: linkUrl,
        title: linkTitle || undefined,
        description: linkDescription || undefined,
      });

      if (success) successCount++;
      else errorCount++;

      setSendProgress(((i + 1) / recipientsToSend.length) * 100);

      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setIsSending(false);
    toast({
      title: 'Envio concluído',
      description: `${successCount} links enviados${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const handleSendSticker = async () => {
    if (!stickerUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe a URL do sticker.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API na aba Conexão.',
        variant: 'destructive',
      });
      return;
    }

    const recipientsToSend = getFilteredRecipients();
    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];

      const success = await sendSticker({
        phone: recipient.phone,
        stickerUrl: stickerUrl,
      });

      if (success) successCount++;
      else errorCount++;

      setSendProgress(((i + 1) / recipientsToSend.length) * 100);

      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setIsSending(false);
    toast({
      title: 'Envio concluído',
      description: `${successCount} stickers enviados${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const handleSendLocation = async () => {
    if (!locationLat.trim() || !locationLng.trim()) {
      toast({
        title: 'Coordenadas obrigatórias',
        description: 'Informe latitude e longitude.',
        variant: 'destructive',
      });
      return;
    }

    const lat = parseFloat(locationLat);
    const lng = parseFloat(locationLng);

    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: 'Coordenadas inválidas',
        description: 'Informe valores numéricos válidos.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API na aba Conexão.',
        variant: 'destructive',
      });
      return;
    }

    const recipientsToSend = getFilteredRecipients();
    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];

      const success = await sendLocation({
        phone: recipient.phone,
        latitude: lat,
        longitude: lng,
        name: locationName || undefined,
        address: locationAddress || undefined,
      });

      if (success) successCount++;
      else errorCount++;

      setSendProgress(((i + 1) / recipientsToSend.length) * 100);

      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setIsSending(false);
    toast({
      title: 'Envio concluído',
      description: `${successCount} localizações enviadas${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const handleSendMedia = async () => {
    if (!mediaUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe a URL do arquivo.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API na aba Conexão.',
        variant: 'destructive',
      });
      return;
    }

    const recipientsToSend = getFilteredRecipients();
    if (recipientsToSend.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      const personalizedCaption = mediaCaption ? personalizeText(mediaCaption, recipient) : undefined;

      const success = await sendMessage({
        phone: recipient.phone,
        message: personalizedCaption || '',
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      });

      if (success) successCount++;
      else errorCount++;

      setSendProgress(((i + 1) / recipientsToSend.length) * 100);

      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setIsSending(false);
    toast({
      title: 'Envio concluído',
      description: `${successCount} arquivos enviados${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
    });
  };

  const resourcePanels = [
    {
      id: 'list',
      icon: List,
      title: 'Listas de Opções',
      description: 'Envie menus com até 10 opções selecionáveis',
      color: 'text-blue-500',
    },
    {
      id: 'link',
      icon: Link2,
      title: 'Preview de Links',
      description: 'Envie links com pré-visualização',
      color: 'text-green-500',
    },
    {
      id: 'sticker',
      icon: Sticker,
      title: 'Stickers',
      description: 'Envie figurinhas personalizadas',
      color: 'text-purple-500',
    },
    {
      id: 'location',
      icon: MapPin,
      title: 'Localização',
      description: 'Compartilhe endereços e coordenadas',
      color: 'text-red-500',
    },
    {
      id: 'media',
      icon: Image,
      title: 'Imagens e Documentos',
      description: 'Envie fotos, vídeos, áudios e arquivos',
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recursos Avançados</h3>
          <p className="text-sm text-muted-foreground">
            Envie mensagens interativas para {selectedRecipients.size} destinatário(s) selecionado(s)
          </p>
        </div>
        {isSending && (
          <Badge variant="outline" className="gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {Math.round(sendProgress)}%
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {resourcePanels.map((panel) => (
          <Collapsible key={panel.id} open={openPanel === panel.id} onOpenChange={() => togglePanel(panel.id)}>
            <Card className={`transition-all ${openPanel === panel.id ? 'ring-2 ring-primary/20' : ''}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-secondary ${panel.color}`}>
                        <panel.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{panel.title}</CardTitle>
                        <CardDescription className="text-xs">{panel.description}</CardDescription>
                      </div>
                    </div>
                    {openPanel === panel.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 space-y-4">
                  {/* List Panel */}
                  {panel.id === 'list' && (
                    <>
                      <div className="space-y-2">
                        <Label>Título (opcional)</Label>
                        <Input
                          placeholder="Escolha uma opção"
                          value={listTitle}
                          onChange={(e) => setListTitle(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mensagem *</Label>
                        <Textarea
                          placeholder="Olá {nome_responsavel}, selecione uma opção:"
                          value={listMessage}
                          onChange={(e) => setListMessage(e.target.value)}
                          className="min-h-[80px]"
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Texto do botão</Label>
                        <Input
                          placeholder="Ver opções"
                          value={listButtonText}
                          onChange={(e) => setListButtonText(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Opções ({listOptions.length}/10)</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addListOption}
                            disabled={listOptions.length >= 10 || isSending}
                            className="gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {listOptions.map((option, index) => (
                            <div key={index} className="flex gap-2 items-start p-2 rounded-lg bg-secondary/30">
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={`Opção ${index + 1} *`}
                                  value={option.title}
                                  onChange={(e) => updateListOption(index, 'title', e.target.value)}
                                  disabled={isSending}
                                />
                                <Input
                                  placeholder="Descrição (opcional)"
                                  value={option.description}
                                  onChange={(e) => updateListOption(index, 'description', e.target.value)}
                                  disabled={isSending}
                                  className="text-sm"
                                />
                              </div>
                              {listOptions.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeListOption(index)}
                                  disabled={isSending}
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={handleSendList}
                        disabled={isSending || selectedRecipients.size === 0}
                        className="w-full gap-2"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Lista
                      </Button>
                    </>
                  )}

                  {/* Link Panel */}
                  {panel.id === 'link' && (
                    <>
                      <div className="space-y-2">
                        <Label>URL do Link *</Label>
                        <Input
                          placeholder="https://exemplo.com"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Título (opcional)</Label>
                        <Input
                          placeholder="Título do link"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          placeholder="Descrição do link"
                          value={linkDescription}
                          onChange={(e) => setLinkDescription(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <Button
                        onClick={handleSendLink}
                        disabled={isSending || selectedRecipients.size === 0}
                        className="w-full gap-2"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Link
                      </Button>
                    </>
                  )}

                  {/* Sticker Panel */}
                  {panel.id === 'sticker' && (
                    <>
                      <div className="space-y-2">
                        <Label>URL do Sticker *</Label>
                        <Input
                          placeholder="https://exemplo.com/sticker.webp"
                          value={stickerUrl}
                          onChange={(e) => setStickerUrl(e.target.value)}
                          disabled={isSending}
                        />
                        <p className="text-xs text-muted-foreground">
                          Formatos suportados: .webp, .png (será convertido)
                        </p>
                      </div>
                      <Button
                        onClick={handleSendSticker}
                        disabled={isSending || selectedRecipients.size === 0}
                        className="w-full gap-2"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Sticker
                      </Button>
                    </>
                  )}

                  {/* Location Panel */}
                  {panel.id === 'location' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Latitude *</Label>
                          <Input
                            placeholder="-23.550520"
                            value={locationLat}
                            onChange={(e) => setLocationLat(e.target.value)}
                            disabled={isSending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Longitude *</Label>
                          <Input
                            placeholder="-46.633308"
                            value={locationLng}
                            onChange={(e) => setLocationLng(e.target.value)}
                            disabled={isSending}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome do Local (opcional)</Label>
                        <Input
                          placeholder="Ex: Escola XYZ"
                          value={locationName}
                          onChange={(e) => setLocationName(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Endereço (opcional)</Label>
                        <Input
                          placeholder="Ex: Rua das Flores, 123"
                          value={locationAddress}
                          onChange={(e) => setLocationAddress(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <Button
                        onClick={handleSendLocation}
                        disabled={isSending || selectedRecipients.size === 0}
                        className="w-full gap-2"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Localização
                      </Button>
                    </>
                  )}

                  {/* Media Panel */}
                  {panel.id === 'media' && (
                    <>
                      <div className="space-y-2">
                        <Label>Tipo de Mídia</Label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { type: 'image' as const, icon: Image, label: 'Imagem' },
                            { type: 'document' as const, icon: FileText, label: 'Documento' },
                            { type: 'video' as const, icon: Video, label: 'Vídeo' },
                            { type: 'audio' as const, icon: Music, label: 'Áudio' },
                          ].map((item) => (
                            <Button
                              key={item.type}
                              variant={mediaType === item.type ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMediaType(item.type)}
                              disabled={isSending}
                              className="gap-1"
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>URL do Arquivo *</Label>
                        <Input
                          placeholder={`https://exemplo.com/arquivo.${mediaType === 'image' ? 'jpg' : mediaType === 'document' ? 'pdf' : mediaType === 'video' ? 'mp4' : 'mp3'}`}
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          disabled={isSending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Legenda (opcional)</Label>
                        <Textarea
                          placeholder="Olá {nome_responsavel}, segue o arquivo..."
                          value={mediaCaption}
                          onChange={(e) => setMediaCaption(e.target.value)}
                          className="min-h-[60px]"
                          disabled={isSending}
                        />
                      </div>
                      <Button
                        onClick={handleSendMedia}
                        disabled={isSending || selectedRecipients.size === 0}
                        className="w-full gap-2"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar {mediaType === 'image' ? 'Imagem' : mediaType === 'document' ? 'Documento' : mediaType === 'video' ? 'Vídeo' : 'Áudio'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {selectedRecipients.size === 0 && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning-foreground">
          Selecione destinatários na aba "Compor" para enviar mensagens avançadas.
        </div>
      )}
    </div>
  );
}
