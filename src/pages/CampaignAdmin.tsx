import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Loader2, 
  Link as LinkIcon, 
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Settings,
  BookOpen,
  Layers,
  ExternalLink
} from 'lucide-react';
import { CourseLandingEditor } from '@/components/campaign/CourseLandingEditor';
import { CampaignImagesTab } from '@/components/campaign/CampaignImagesTab';
import { CampaignTextsTab } from '@/components/campaign/CampaignTextsTab';
import { CampaignCoursesTab } from '@/components/campaign/CampaignCoursesTab';
import { CampaignWhatsAppTab } from '@/components/campaign/CampaignWhatsAppTab';
import { CampaignSettingsTab } from '@/components/campaign/CampaignSettingsTab';

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

  const copyLink = () => {
    const url = `${window.location.origin}/campanha`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const openPreview = () => {
    window.open(`${window.location.origin}/campanha`, '_blank');
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
            <p className="text-muted-foreground">Gerencie a landing page de captação de leads</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openPreview} variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Visualizar
            </Button>
            <Button onClick={copyLink} variant="outline" size="sm">
              <LinkIcon className="w-4 h-4 mr-2" />
              Copiar Link
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="texts" className="space-y-6">
          <div className="border-b">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-0 overflow-x-auto flex-nowrap">
              <TabsTrigger 
                value="texts" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span>Textos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="images" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Galeria</span>
              </TabsTrigger>
              <TabsTrigger 
                value="courses" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="landing-pages" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <Layers className="w-4 h-4" />
                <span>Por Curso</span>
              </TabsTrigger>
              <TabsTrigger 
                value="whatsapp" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2 shrink-0"
              >
                <Settings className="w-4 h-4" />
                <span>Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="texts" className="mt-6">
            <CampaignTextsTab
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
              heroImage={heroImage}
              benefits={benefits}
              coursesSectionTitle={coursesSectionTitle}
              coursesSectionSubtitle={coursesSectionSubtitle}
              onHeroTitleChange={setHeroTitle}
              onHeroSubtitleChange={setHeroSubtitle}
              onHeroImageChange={setHeroImage}
              onBenefitsChange={setBenefits}
              onCoursesSectionTitleChange={setCoursesSectionTitle}
              onCoursesSectionSubtitleChange={setCoursesSectionSubtitle}
              onSave={handleSaveTexts}
              isSaving={isSaving}
            />
          </TabsContent>

          <TabsContent value="images" className="mt-6">
            <CampaignImagesTab
              images={images}
              onImagesChange={setImages}
              onReload={loadData}
            />
          </TabsContent>

          <TabsContent value="courses" className="mt-6">
            <CampaignCoursesTab
              courses={courses}
              onCoursesChange={setCourses}
            />
          </TabsContent>

          <TabsContent value="landing-pages" className="mt-6">
            <CourseLandingEditor />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-6">
            <CampaignWhatsAppTab
              welcomeTemplate={welcomeTemplate}
              autoWelcomeEnabled={autoWelcomeEnabled}
              onWelcomeTemplateChange={setWelcomeTemplate}
              onAutoWelcomeEnabledChange={setAutoWelcomeEnabled}
              onSave={handleSaveWhatsApp}
              isSaving={isSaving}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <CampaignSettingsTab
              isActive={isActive}
              onIsActiveChange={setIsActive}
              onSave={handleSaveTexts}
              isSaving={isSaving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
