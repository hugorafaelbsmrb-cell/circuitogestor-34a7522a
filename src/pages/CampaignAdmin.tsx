import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAIProvider } from '@/hooks/useAIProvider';
import { 
  Loader2, 
  Upload, 
  Trash2, 
  Save, 
  Link as LinkIcon, 
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Settings,
  GripVertical,
  Plus,
  X,
  Sparkles,
  ChevronDown,
  Wand2,
  BookOpen,
  Pencil
} from 'lucide-react';

interface CampaignImage {
  id: string;
  url: string;
  title: string | null;
  type: string;
  sort_order: number;
  is_active: boolean;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  price: number;
  is_active: boolean | null;
}

export default function CampaignAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  
  // Settings
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [welcomeTemplate, setWelcomeTemplate] = useState('');
  const [autoWelcomeEnabled, setAutoWelcomeEnabled] = useState(true);
  const [coursesSectionTitle, setCoursesSectionTitle] = useState('');
  const [coursesSectionSubtitle, setCoursesSectionSubtitle] = useState('');
  
  // Images
  const [images, setImages] = useState<CampaignImage[]>([]);

  // Courses
  const [courses, setCourses] = useState<Course[]>([]);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isGeneratingCourseDesc, setIsGeneratingCourseDesc] = useState(false);

  // AI Generator
  const { getGenerateFunctionName } = useAIProvider();
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiTarget, setAiTarget] = useState<'title' | 'subtitle' | 'benefit'>('title');
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('profissional e envolvente');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number | null>(null);
  const aiCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
    loadCourses();
  }, []);

  const loadData = async () => {
    try {
      // Load settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'campaign_hero_title',
          'campaign_hero_subtitle',
          'campaign_hero_image',
          'campaign_benefits',
          'campaign_is_active',
          'whatsapp_template_lead_welcome',
          'campaign_courses_title',
          'campaign_courses_subtitle',
        ]);

      settings?.forEach((s) => {
        switch (s.key) {
          case 'campaign_hero_title':
            setHeroTitle(s.value || '');
            break;
          case 'campaign_hero_subtitle':
            setHeroSubtitle(s.value || '');
            break;
          case 'campaign_hero_image':
            setHeroImage(s.value || '');
            console.log('🖼️ Hero image loaded:', s.value);
            break;
          case 'campaign_benefits':
            if (s.value) {
              try { setBenefits(JSON.parse(s.value)); } catch { /* ignore */ }
            }
            break;
          case 'campaign_is_active':
            setIsActive(s.value === 'true');
            break;
          case 'whatsapp_template_lead_welcome':
            setWelcomeTemplate(s.value || '');
            break;
          case 'campaign_courses_title':
            setCoursesSectionTitle(s.value || '');
            break;
          case 'campaign_courses_subtitle':
            setCoursesSectionSubtitle(s.value || '');
            break;
        }
      });

      // Load automation
      const { data: automation } = await supabase
        .from('automation_settings')
        .select('enabled')
        .eq('key', 'auto_lead_welcome')
        .maybeSingle();
      
      if (automation) {
        setAutoWelcomeEnabled(automation.enabled ?? false);
      }

      // Load images
      const { data: imagesData } = await supabase
        .from('campaign_images')
        .select('*')
        .order('sort_order');

      if (imagesData) {
        setImages(imagesData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select('id, name, description, duration, price, is_active')
        .order('name');

      if (error) throw error;
      if (coursesData) {
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const handleSaveCourse = async (course: Course) => {
    setIsSavingCourse(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          name: course.name,
          description: course.description,
          duration: course.duration,
          price: course.price,
          is_active: course.is_active,
        })
        .eq('id', course.id);

      if (error) throw error;

      setCourses(courses.map(c => c.id === course.id ? course : c));
      setEditingCourse(null);
      toast.success('Curso atualizado!');
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Erro ao salvar curso');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleToggleCourseActive = async (course: Course) => {
    try {
      const newValue = !course.is_active;
      const { error } = await supabase
        .from('courses')
        .update({ is_active: newValue })
        .eq('id', course.id);

      if (error) throw error;

      setCourses(courses.map(c => c.id === course.id ? { ...c, is_active: newValue } : c));
      toast.success(newValue ? 'Curso ativado!' : 'Curso desativado!');
    } catch (error) {
      console.error('Error toggling course:', error);
      toast.error('Erro ao atualizar curso');
    }
  };

  const handleGenerateCourseDescription = async () => {
    if (!editingCourse) return;
    
    if (aiCooldownUntil && Date.now() < aiCooldownUntil) {
      toast.error('Aguarde para tentar novamente');
      return;
    }

    setIsGeneratingCourseDesc(true);
    try {
      const prompt = `Crie uma descrição atraente e persuasiva (máximo 80 palavras) para um curso chamado "${editingCourse.name}" com duração de ${editingCourse.duration} para uma escola de cursos extracurriculares. A descrição deve destacar benefícios para crianças/jovens e convencer os pais a matricular seus filhos. Responda APENAS com a descrição, sem aspas ou explicações.`;

      const functionName = getGenerateFunctionName();
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          purpose: prompt,
          tone: 'profissional e envolvente',
          context: 'landing page de captação de leads para escola',
        },
      });

      if (error) throw error;

      if (data?.message) {
        const generatedText = data.message.trim().replace(/^["']|["']$/g, '');
        setEditingCourse({ ...editingCourse, description: generatedText });
        toast.success('Descrição gerada!');
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

      console.error('Error generating course description:', error);
      toast.error(parsed.body?.error || 'Erro ao gerar descrição');
    } finally {
      setIsGeneratingCourseDesc(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' });
    
    if (error) throw error;
  };

  const handleSaveTexts = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting('campaign_hero_title', heroTitle),
        saveSetting('campaign_hero_subtitle', heroSubtitle),
        saveSetting('campaign_hero_image', heroImage),
        saveSetting('campaign_benefits', JSON.stringify(benefits)),
        saveSetting('campaign_is_active', isActive ? 'true' : 'false'),
        saveSetting('campaign_courses_title', coursesSectionTitle),
        saveSetting('campaign_courses_subtitle', coursesSectionSubtitle),
      ]);
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    setIsSaving(true);
    try {
      await saveSetting('whatsapp_template_lead_welcome', welcomeTemplate);
      
      await supabase
        .from('automation_settings')
        .upsert({ 
          key: 'auto_lead_welcome', 
          enabled: autoWelcomeEnabled,
          description: 'Enviar mensagem automática para leads da landing page'
        }, { onConflict: 'key' });
      
      toast.success('Configurações de WhatsApp salvas!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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
      loadData();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (image: CampaignImage) => {
    try {
      // Delete from storage
      const fileName = image.url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('campaign-images').remove([fileName]);
      }

      // Delete from database
      await supabase.from('campaign_images').delete().eq('id', image.id);
      
      setImages(images.filter(i => i.id !== image.id));
      toast.success('Imagem removida!');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  const handleToggleImageActive = async (image: CampaignImage) => {
    try {
      await supabase
        .from('campaign_images')
        .update({ is_active: !image.is_active })
        .eq('id', image.id);
      
      setImages(images.map(i => i.id === image.id ? { ...i, is_active: !i.is_active } : i));
    } catch (error) {
      console.error('Error toggling:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const addBenefit = () => {
    setBenefits([...benefits, { icon: 'Star', title: '', description: '' }]);
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
    setBenefits(benefits.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const copyLink = () => {
    const url = `${window.location.origin}/campanha`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  // Helper to parse edge function errors
  const parseInvokeError = (err: any) => {
    try {
      if (err?.context?.body) return { status: err.context.status, body: JSON.parse(err.context.body) };
      if (typeof err?.message === 'string') return { status: 500, body: { error: err.message } };
    } catch { /* ignore */ }
    return { status: 500, body: { error: 'Erro desconhecido' } };
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
      let context = 'landing page de captação de leads para escola de cursos extracurriculares';
      
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
            setHeroTitle(generatedText.replace(/^["']|["']$/g, ''));
            toast.success('Título gerado!');
            break;
          case 'subtitle':
            setHeroSubtitle(generatedText.replace(/^["']|["']$/g, ''));
            toast.success('Subtítulo gerado!');
            break;
          case 'benefit':
            try {
              // Try to extract JSON from the response
              const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const benefitData = JSON.parse(jsonMatch[0]);
                setBenefits([...benefits, {
                  icon: benefitData.icon || 'Star',
                  title: benefitData.title || '',
                  description: benefitData.description || '',
                }]);
                toast.success('Benefício adicionado!');
              } else {
                throw new Error('JSON não encontrado');
              }
            } catch {
              // Fallback: add as description
              setBenefits([...benefits, {
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

  // Countdown display
  const getCooldownText = () => {
    if (!aiCooldownUntil) return null;
    const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
    return remaining > 0 ? `Aguarde ${remaining}s` : null;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
            <p className="text-muted-foreground">Gerencie a landing page de captação de leads</p>
          </div>
          <Button onClick={copyLink} variant="outline">
            <LinkIcon className="w-4 h-4 mr-2" />
            Copiar Link
          </Button>
        </div>

        <Tabs defaultValue="images" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-5">
            <TabsTrigger value="images" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Imagens</span>
            </TabsTrigger>
            <TabsTrigger value="texts" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Textos</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Cursos</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Images Tab */}
          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle>Galeria de Fotos</CardTitle>
                <CardDescription>Fotos de alunos que aparecerão na landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadImage}
                      disabled={isUploading}
                    />
                    <Button asChild disabled={isUploading}>
                      <span>
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Enviar Foto
                      </span>
                    </Button>
                  </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div 
                      key={image.id} 
                      className={`relative group rounded-lg overflow-hidden border-2 ${
                        image.is_active ? 'border-primary' : 'border-muted opacity-50'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.title || 'Foto'}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleImageActive(image)}
                        >
                          {image.is_active ? 'Ocultar' : 'Mostrar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteImage(image)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="absolute top-2 left-2">
                        <GripVertical className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  ))}
                </div>

                {images.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma foto enviada ainda</p>
                    <p className="text-sm">Clique em "Enviar Foto" para adicionar imagens</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Texts Tab */}
          <TabsContent value="texts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Textos da Landing Page</span>
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
                </CardTitle>
                <CardDescription>Configure o conteúdo exibido na página</CardDescription>
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
                <div className="space-y-2">
                  <Label>Título Principal (Hero)</Label>
                  <Input
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    placeholder="Ex: Matrículas Abertas 2026!"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Textarea
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="Ex: Transforme o futuro do seu filho..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagem de Fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      value={heroImage}
                      onChange={(e) => setHeroImage(e.target.value)}
                      placeholder="URL da imagem ou faça upload..."
                      className="flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
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
                            
                            setHeroImage(urlData.publicUrl);
                            toast.success('Imagem enviada!');
                          } catch (error) {
                            console.error('Error uploading hero image:', error);
                            toast.error('Erro ao enviar imagem');
                          } finally {
                            setIsUploadingHero(false);
                          }
                        }}
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
                    /* Preview image: {heroImage} */
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
                        onClick={() => setHeroImage('')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para usar o gradiente padrão
                  </p>
                </div>

                {/* Courses Section Texts */}
                <div className="border-t border-border pt-6 mt-6">
                  <h3 className="text-lg font-medium mb-4">Seção de Cursos</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título da Seção de Cursos</Label>
                      <Input
                        value={coursesSectionTitle}
                        onChange={(e) => setCoursesSectionTitle(e.target.value)}
                        placeholder="Ex: Nossos Cursos"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para usar "Nossos Cursos"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Subtítulo da Seção de Cursos</Label>
                      <Input
                        value={coursesSectionSubtitle}
                        onChange={(e) => setCoursesSectionSubtitle(e.target.value)}
                        placeholder="Ex: Escolha o melhor curso para o seu filho"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para usar "Escolha o melhor curso para o seu filho"
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Benefícios/Diferenciais</Label>
                    <Button size="sm" variant="outline" onClick={addBenefit}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg">
                      <Input
                        value={benefit.icon}
                        onChange={(e) => updateBenefit(index, 'icon', e.target.value)}
                        placeholder="Ícone"
                        className="w-24"
                      />
                      <Input
                        value={benefit.title}
                        onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                        placeholder="Título"
                        className="flex-1"
                      />
                      <Input
                        value={benefit.description}
                        onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                        placeholder="Descrição"
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeBenefit(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Ícones disponíveis: Users, Award, GraduationCap, Clock, Star, Heart, Lightbulb, Target
                  </p>
                </div>

                <Button onClick={handleSaveTexts} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Textos
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle>Cursos da Landing Page</CardTitle>
                <CardDescription>Edite os cursos exibidos na página de captação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {courses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum curso cadastrado</p>
                    <p className="text-sm">Cadastre cursos na página de Cursos do sistema</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courses.map((course) => (
                      <div 
                        key={course.id} 
                        className={`p-4 border rounded-lg transition-colors ${
                          course.is_active ? 'border-border bg-card' : 'border-muted bg-muted/30 opacity-60'
                        }`}
                      >
                        {editingCourse?.id === course.id ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Nome do Curso</Label>
                                <Input
                                  value={editingCourse.name}
                                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Duração</Label>
                                <Input
                                  value={editingCourse.duration}
                                  onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                                  placeholder="Ex: 12 meses"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Descrição</Label>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleGenerateCourseDescription}
                                  disabled={isGeneratingCourseDesc || !!getCooldownText()}
                                  className="gap-1.5 h-7 text-xs"
                                >
                                  {isGeneratingCourseDesc ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  {getCooldownText() || 'Gerar com IA'}
                                </Button>
                              </div>
                              <Textarea
                                value={editingCourse.description || ''}
                                onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                                placeholder="Descrição do curso..."
                                rows={3}
                              />
                            </div>
                            
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Preço (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingCourse.price}
                                  onChange={(e) => setEditingCourse({ ...editingCourse, price: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch
                                  checked={editingCourse.is_active ?? true}
                                  onCheckedChange={(checked) => setEditingCourse({ ...editingCourse, is_active: checked })}
                                />
                                <Label>Exibir na landing page</Label>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                              <Button 
                                onClick={() => handleSaveCourse(editingCourse)}
                                disabled={isSavingCourse}
                              >
                                {isSavingCourse ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 mr-2" />
                                )}
                                Salvar
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setEditingCourse(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{course.name}</h4>
                                {!course.is_active && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Oculto</span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {course.duration} • R$ {course.price.toFixed(2)}
                              </p>
                              {course.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {course.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={course.is_active ?? true}
                                onCheckedChange={() => handleToggleCourseActive(course)}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEditingCourse(course)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Mensagem Automática</CardTitle>
                <CardDescription>Configure a mensagem enviada automaticamente para novos leads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Envio Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagem de boas-vindas assim que o lead se cadastrar
                    </p>
                  </div>
                  <Switch
                    checked={autoWelcomeEnabled}
                    onCheckedChange={setAutoWelcomeEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Template da Mensagem</Label>
                  <Textarea
                    value={welcomeTemplate}
                    onChange={(e) => setWelcomeTemplate(e.target.value)}
                    rows={8}
                    placeholder="Olá {nome_responsavel}!..."
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Variáveis disponíveis:</p>
                    <ul className="list-disc list-inside">
                      <li><code>{'{nome_responsavel}'}</code> - Primeiro nome do lead</li>
                      <li><code>{'{nome_curso}'}</code> - Curso selecionado</li>
                      <li><code>{'{nome_escola}'}</code> - Nome da escola</li>
                    </ul>
                  </div>
                </div>

                <Button onClick={handleSaveWhatsApp} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>Controle o funcionamento da landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Landing Page Ativa</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando desativada, exibe mensagem de campanha encerrada
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <Label>Link da Landing Page</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={`${window.location.origin}/campanha`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button onClick={copyLink} variant="outline">
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button onClick={handleSaveTexts} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
