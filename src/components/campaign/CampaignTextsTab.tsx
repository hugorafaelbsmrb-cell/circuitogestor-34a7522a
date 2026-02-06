import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
} from 'lucide-react';

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface CampaignTextsTabProps {
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
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function CampaignTextsTab({
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
  onSave,
  isSaving,
}: CampaignTextsTabProps) {
  const { getGenerateFunctionName } = useAIProvider();
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiTarget, setAiTarget] = useState<'title' | 'subtitle' | 'benefit'>('title');
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('profissional e envolvente');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
  const aiCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const addBenefit = () => {
    onBenefitsChange([...benefits, { icon: 'Star', title: '', description: '' }]);
  };

  const removeBenefit = (index: number) => {
    onBenefitsChange(benefits.filter((_, i) => i !== index));
  };

  const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
    onBenefitsChange(benefits.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Textos da Landing Page</CardTitle>
            <CardDescription>Configure o conteúdo exibido na página principal</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiGenerator(!showAiGenerator)}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Assistente IA
            <ChevronDown className={`w-4 h-4 transition-transform ${showAiGenerator ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Generator Panel */}
        <Collapsible open={showAiGenerator} onOpenChange={setShowAiGenerator}>
          <CollapsibleContent>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-4 mb-4">
              <div className="flex items-center gap-2 text-primary">
                <Wand2 className="w-5 h-5" />
                <span className="font-medium">Gerador de Textos com IA</span>
              </div>
              
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
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Hero Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Seção Hero</h3>
          
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
            <p className="text-xs text-muted-foreground">
              Deixe vazio para usar o gradiente padrão
            </p>
          </div>
        </div>

        {/* Courses Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Seção de Cursos</h3>
          
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

        {/* Benefits Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Benefícios/Diferenciais</h3>
            <Button size="sm" variant="outline" onClick={addBenefit}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-background rounded-lg border">
                <div className="flex-1 grid gap-2 sm:grid-cols-3">
                  <Input
                    value={benefit.icon}
                    onChange={(e) => updateBenefit(index, 'icon', e.target.value)}
                    placeholder="Ícone"
                  />
                  <Input
                    value={benefit.title}
                    onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                    placeholder="Título"
                  />
                  <Input
                    value={benefit.description}
                    onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                    placeholder="Descrição"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={() => removeBenefit(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Ícones: Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target
          </p>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Textos
        </Button>
      </CardContent>
    </Card>
  );
}
