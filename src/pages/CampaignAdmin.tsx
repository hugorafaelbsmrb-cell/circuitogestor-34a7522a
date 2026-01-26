import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
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
  X
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
  
  // Images
  const [images, setImages] = useState<CampaignImage[]>([]);

  useEffect(() => {
    loadData();
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
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="images" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Imagens</span>
            </TabsTrigger>
            <TabsTrigger value="texts" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Textos</span>
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
                <CardTitle>Textos da Landing Page</CardTitle>
                <CardDescription>Configure o conteúdo exibido na página</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
