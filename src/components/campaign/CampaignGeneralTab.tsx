import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAIProvider } from '@/hooks/useAIProvider';
import { 
  Loader2, 
  Upload, 
  Trash2, 
  Save, 
  Plus, 
  X, 
  Sparkles, 
  ChevronDown, 
  Wand2,
  ImageIcon,
  GripVertical,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface CampaignImage {
  id: string;
  url: string;
  title: string | null;
  type: string;
  sort_order: number;
  is_active: boolean;
}

interface CampaignGeneralTabProps {
  // Hero & Texts
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  benefits: Benefit[];
  coursesSectionTitle: string;
  coursesSectionSubtitle: string;
  onHeroTitleChange: (value: string) => void;
  onHeroSubtitleChange: (value: string) => void;
  onHeroImageChange: (value: string) => void;
  onBenefitsChange: (benefits: Benefit[]) => void;
  onCoursesSectionTitleChange: (value: string) => void;
  onCoursesSectionSubtitleChange: (value: string) => void;
  
  // Images
  images: CampaignImage[];
  onImagesChange: (images: CampaignImage[]) => void;
  onReloadImages: () => void;
  
  // WhatsApp
  welcomeTemplate: string;
  autoWelcomeEnabled: boolean;
  onWelcomeTemplateChange: (value: string) => void;
  onAutoWelcomeEnabledChange: (value: boolean) => void;
  
  // Settings
  isActive: boolean;
  onIsActiveChange: (value: boolean) => void;
  
  // Actions
  onSave: () => Promise<void>;
  onSaveWhatsApp: () => Promise<void>;
  isSaving: boolean;
}

export function CampaignGeneralTab({
  heroTitle,
  heroSubtitle,
  heroImage,
  benefits,
  coursesSectionTitle,
  coursesSectionSubtitle,
  onHeroTitleChange,
  onHeroSubtitleChange,
  onHeroImageChange,
  onBenefitsChange,
  onCoursesSectionTitleChange,
  onCoursesSectionSubtitleChange,
  images,
  onImagesChange,
  onReloadImages,
  welcomeTemplate,
  autoWelcomeEnabled,
  onWelcomeTemplateChange,
  onAutoWelcomeEnabledChange,
  isActive,
  onIsActiveChange,
  onSave,
  onSaveWhatsApp,
  isSaving,
}: CampaignGeneralTabProps) {
  const { getGenerateFunctionName } = useAIProvider();
  
  // AI Generator State
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiTarget, setAiTarget] = useState<'title' | 'subtitle' | 'benefit'>('title');
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('profissional e envolvente');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
  const aiCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Upload State
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  
  // Collapsible sections
  const [openSections, setOpenSections] = useState({
    hero: true,
    gallery: false,
    whatsapp: false,
    settings: false,
  });

  const landingPageUrl = `${window.location.origin}/campanha`;

  const parseInvokeError = (err: any) => {
    try {
      if (err?.context?.body) return { status: err.context.status, body: JSON.parse(err.context.body) };
      if (typeof err?.message === 'string') return { status: 500, body: { error: err.message } };
    } catch { /* ignore */ }
    return { status: 500, body: { error: 'Erro desconhecido' } };
  };

  const getCooldownText = () => {
    if (!aiCooldownUntil) return null;
    const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
    return remaining > 0 ? `Aguarde ${remaining}s` : null;
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleGenerateWithAI = async () => {
    if (aiCooldownUntil && Date.now() < aiCooldownUntil) {
      toast.error('Aguarde para tentar novamente');
      return;
    }

    if (!aiPurpose.trim()) {
      toast.error('Descreva o que deseja gerar');
      return;
    }

    setIsGeneratingAI(true);
    try {
      let prompt = '';
      const context = 'landing page de captação de leads para escola de cursos extracurriculares';
      
      switch (aiTarget) {
        case 'title':
          prompt = `Crie um título curto e impactante (máximo 8 palavras) para uma landing page de matrículas. Objetivo: ${aiPurpose}. Responda APENAS com o título, sem aspas ou explicações.`;
          break;
        case 'subtitle':
          prompt = `Crie um subtítulo envolvente (máximo 20 palavras) para uma landing page de matrículas. Objetivo: ${aiPurpose}. Responda APENAS com o subtítulo, sem aspas ou explicações.`;
          break;
        case 'benefit':
          prompt = `Crie um benefício/diferencial para uma landing page. Objetivo: ${aiPurpose}. Responda em formato JSON: {"icon": "NomeDoIcone", "title": "Título curto", "description": "Descrição breve"}. Ícones disponíveis: Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target.`;
          break;
      }

      const functionName = getGenerateFunctionName();
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          purpose: prompt,
          tone: aiTone,
          context,
        },
      });

      if (error) throw error;

      if (data?.message) {
        const generatedText = data.message.trim();
        
        switch (aiTarget) {
          case 'title':
            onHeroTitleChange(generatedText.replace(/^["']|["']$/g, ''));
            toast.success('Título gerado!');
            break;
          case 'subtitle':
            onHeroSubtitleChange(generatedText.replace(/^["']|["']$/g, ''));
            toast.success('Subtítulo gerado!');
            break;
          case 'benefit':
            try {
              const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const benefitData = JSON.parse(jsonMatch[0]);
                onBenefitsChange([...benefits, {
                  icon: benefitData.icon || 'Star',
                  title: benefitData.title || '',
                  description: benefitData.description || '',
                }]);
                toast.success('Benefício adicionado!');
              } else {
                throw new Error('JSON não encontrado');
              }
            } catch {
              onBenefitsChange([...benefits, {
                icon: 'Star',
                title: 'Novo Benefício',
                description: generatedText.substring(0, 100),
              }]);
              toast.success('Benefício adicionado (revise os campos)');
            }
            break;
        }
        
        setAiPurpose('');
        setShowAiGenerator(false);
      } else {
        throw new Error('Nenhum texto gerado');
      }
    } catch (error: any) {
      const parsed = parseInvokeError(error);
      
      if (parsed.status === 429) {
        const retryAfterSeconds = Number(parsed.body?.retry_after_seconds ?? 60);
        const ms = Math.min(Math.max(retryAfterSeconds, 5), 600) * 1000;
        setAiCooldownUntil(Date.now() + ms);
        if (aiCooldownTimeoutRef.current) clearTimeout(aiCooldownTimeoutRef.current);
        aiCooldownTimeoutRef.current = setTimeout(() => setAiCooldownUntil(null), ms);
        toast.error('Limite de requisições atingido. Aguarde um momento.');
        return;
      }

      console.error('Error generating with AI:', error);
      toast.error(parsed.body?.error || 'Erro ao gerar texto');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleUploadHeroImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingHero(true);
    try {
      const fileName = `hero-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);
      
      onHeroImageChange(urlData.publicUrl);
      toast.success('Imagem enviada!');
    } catch (error) {
      console.error('Error uploading hero image:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploadingHero(false);
    }
  };

  const handleUploadGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingGallery(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('campaign_images')
        .insert({
          url: urlData.publicUrl,
          title: file.name.split('.')[0],
          type: 'student_photo',
          sort_order: images.length,
        });

      if (insertError) throw insertError;

      toast.success('Imagem enviada!');
      onReloadImages();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleDeleteGalleryImage = async (image: CampaignImage) => {
    try {
      const fileName = image.url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('campaign-images').remove([fileName]);
      }

      await supabase.from('campaign_images').delete().eq('id', image.id);
      
      onImagesChange(images.filter(i => i.id !== image.id));
      toast.success('Imagem removida!');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  const handleToggleGalleryImage = async (image: CampaignImage) => {
    try {
      await supabase
        .from('campaign_images')
        .update({ is_active: !image.is_active })
        .eq('id', image.id);
      
      onImagesChange(images.map(i => i.id === image.id ? { ...i, is_active: !i.is_active } : i));
    } catch (error) {
      console.error('Error toggling:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const addBenefit = () => {
    onBenefitsChange([...benefits, { icon: 'Star', title: '', description: '' }]);
  };

  const removeBenefit = (index: number) => {
    onBenefitsChange(benefits.filter((_, i) => i !== index));
  };

  const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
    onBenefitsChange(benefits.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(landingPageUrl);
    toast.success('Link copiado!');
  };

  const openPreview = () => {
    window.open(landingPageUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* AI Generator Panel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              Assistente IA
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAiGenerator(!showAiGenerator)}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAiGenerator ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <Collapsible open={showAiGenerator} onOpenChange={setShowAiGenerator}>
          <CollapsibleContent>
            <CardContent className="pt-2 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>O que deseja gerar?</Label>
                  <Select value={aiTarget} onValueChange={(v) => setAiTarget(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Título Principal</SelectItem>
                      <SelectItem value="subtitle">Subtítulo</SelectItem>
                      <SelectItem value="benefit">Novo Benefício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Tom da mensagem</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profissional e envolvente">Profissional e Envolvente</SelectItem>
                      <SelectItem value="divertido e descontraído">Divertido e Descontraído</SelectItem>
                      <SelectItem value="urgente e persuasivo">Urgente e Persuasivo</SelectItem>
                      <SelectItem value="acolhedor e familiar">Acolhedor e Familiar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Descreva o objetivo ou tema</Label>
                <Textarea
                  value={aiPurpose}
                  onChange={(e) => setAiPurpose(e.target.value)}
                  placeholder="Ex: Destacar matrículas abertas para 2026 com foco em inovação tecnológica..."
                  rows={2}
                />
              </div>
              
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGeneratingAI || !aiPurpose.trim() || !!getCooldownText()}
                className="w-full"
              >
                {isGeneratingAI ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {getCooldownText() || 'Gerar com IA'}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Hero Section */}
      <Card>
        <Collapsible open={openSections.hero} onOpenChange={() => toggleSection('hero')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Seção Hero</CardTitle>
                  <CardDescription className="text-xs">Título, subtítulo, imagem e benefícios</CardDescription>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.hero ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título Principal</Label>
                <Input
                  value={heroTitle}
                  onChange={(e) => onHeroTitleChange(e.target.value)}
                  placeholder="Ex: Matrículas Abertas 2026!"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Textarea
                  value={heroSubtitle}
                  onChange={(e) => onHeroSubtitleChange(e.target.value)}
                  placeholder="Ex: Transforme o futuro do seu filho..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Imagem de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    value={heroImage}
                    onChange={(e) => onHeroImageChange(e.target.value)}
                    placeholder="URL da imagem ou faça upload..."
                    className="flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadHeroImage}
                      disabled={isUploadingHero}
                    />
                    <Button asChild variant="outline" disabled={isUploadingHero}>
                      <span>
                        {isUploadingHero ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
                {heroImage && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border">
                    <img 
                      src={heroImage} 
                      alt="Preview" 
                      className="w-full h-32 object-cover"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => onHeroImageChange('')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Courses Section Titles */}
              <div className="pt-4 border-t">
                <h4 className="font-medium text-sm mb-3">Seção de Cursos</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Título da Seção</Label>
                    <Input
                      value={coursesSectionTitle}
                      onChange={(e) => onCoursesSectionTitleChange(e.target.value)}
                      placeholder="Ex: Nossos Cursos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo da Seção</Label>
                    <Input
                      value={coursesSectionSubtitle}
                      onChange={(e) => onCoursesSectionSubtitleChange(e.target.value)}
                      placeholder="Ex: Escolha o melhor curso"
                    />
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Benefícios/Diferenciais</h4>
                  <Button size="sm" variant="outline" onClick={addBenefit}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 bg-muted/30 rounded-lg">
                      <div className="flex-1 grid gap-2 sm:grid-cols-3">
                        <Input
                          value={benefit.icon}
                          onChange={(e) => updateBenefit(index, 'icon', e.target.value)}
                          placeholder="Ícone"
                          className="text-sm"
                        />
                        <Input
                          value={benefit.title}
                          onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                          placeholder="Título"
                          className="text-sm"
                        />
                        <Input
                          value={benefit.description}
                          onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                          placeholder="Descrição"
                          className="text-sm"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive shrink-0 h-8 w-8"
                        onClick={() => removeBenefit(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Ícones: Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target
                </p>
              </div>

              <Button onClick={onSave} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Textos
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Gallery Section */}
      <Card>
        <Collapsible open={openSections.gallery} onOpenChange={() => toggleSection('gallery')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Galeria de Fotos</CardTitle>
                  <CardDescription className="text-xs">{images.length} fotos na galeria</CardDescription>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.gallery ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadGalleryImage}
                  disabled={isUploadingGallery}
                />
                <Button asChild disabled={isUploadingGallery} size="sm" className="w-full">
                  <span>
                    {isUploadingGallery ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Enviar Foto
                  </span>
                </Button>
              </label>

              {images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma foto enviada</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((image) => (
                    <div 
                      key={image.id} 
                      className={`relative group rounded-lg overflow-hidden border transition-all ${
                        image.is_active ? 'border-primary' : 'border-muted opacity-50'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.title || 'Foto'}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => handleToggleGalleryImage(image)}
                        >
                          {image.is_active ? 'Ocultar' : 'Mostrar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteGalleryImage(image)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="absolute top-1 left-1">
                        <GripVertical className="w-4 h-4 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* WhatsApp Section */}
      <Card>
        <Collapsible open={openSections.whatsapp} onOpenChange={() => toggleSection('whatsapp')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">WhatsApp Automático</CardTitle>
                  <CardDescription className="text-xs">Mensagem de boas-vindas para leads</CardDescription>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.whatsapp ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-sm">Envio Automático</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar mensagem ao cadastrar
                  </p>
                </div>
                <Switch
                  checked={autoWelcomeEnabled}
                  onCheckedChange={onAutoWelcomeEnabledChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Template da Mensagem</Label>
                <Textarea
                  value={welcomeTemplate}
                  onChange={(e) => onWelcomeTemplateChange(e.target.value)}
                  rows={5}
                  placeholder="Olá {nome_responsavel}!..."
                  className="font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                  <p className="font-medium mb-1">Variáveis:</p>
                  <span className="space-x-2">
                    <code className="bg-muted px-1 rounded">{'{nome_responsavel}'}</code>
                    <code className="bg-muted px-1 rounded">{'{nome_curso}'}</code>
                    <code className="bg-muted px-1 rounded">{'{nome_escola}'}</code>
                  </span>
                </div>
              </div>

              <Button onClick={onSaveWhatsApp} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar WhatsApp
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Settings Section */}
      <Card>
        <Collapsible open={openSections.settings} onOpenChange={() => toggleSection('settings')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Configurações</CardTitle>
                  <CardDescription className="text-xs">Status e link da landing page</CardDescription>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${openSections.settings ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-sm">Landing Page Ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desativada, exibe mensagem de encerrada
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={onIsActiveChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Link da Landing Page</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={landingPageUrl}
                    readOnly
                    className="font-mono text-xs flex-1"
                  />
                  <Button onClick={copyLink} variant="outline" size="icon">
                    <LinkIcon className="w-4 h-4" />
                  </Button>
                  <Button onClick={openPreview} variant="outline" size="icon">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button onClick={onSave} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Configurações
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
