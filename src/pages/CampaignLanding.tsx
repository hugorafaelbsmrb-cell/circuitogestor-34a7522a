import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { HeroSection } from '@/components/campaign/HeroSection';
import { PhotoGallery } from '@/components/campaign/PhotoGallery';
import { CourseCards } from '@/components/campaign/CourseCards';
import { BenefitsSection } from '@/components/campaign/BenefitsSection';
import { LeadCaptureForm } from '@/components/campaign/LeadCaptureForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CampaignImage {
  id: string;
  url: string;
  title?: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  duration: string;
  price: number;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

export default function CampaignLanding() {
  const { branding } = useSystemBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [heroTitle, setHeroTitle] = useState('Matrículas Abertas!');
  const [heroSubtitle, setHeroSubtitle] = useState('Transforme o futuro do seu filho com cursos inovadores');
  const [heroImage, setHeroImage] = useState<string | undefined>();
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [images, setImages] = useState<CampaignImage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const [isActive, setIsActive] = useState(true);
  const [coursesSectionTitle, setCoursesSectionTitle] = useState('');
  const [coursesSectionSubtitle, setCoursesSectionSubtitle] = useState('');
  
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCampaignData();
  }, []);

  const loadCampaignData = async () => {
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
          'campaign_courses_title',
          'campaign_courses_subtitle',
        ]);

      settings?.forEach((s) => {
        console.log('⚙️ Loading setting:', s.key, '=', s.value);
        switch (s.key) {
          case 'campaign_hero_title':
            if (s.value) setHeroTitle(s.value);
            break;
          case 'campaign_hero_subtitle':
            if (s.value) setHeroSubtitle(s.value);
            break;
          case 'campaign_hero_image':
            if (s.value) setHeroImage(s.value);
            break;
          case 'campaign_benefits':
            if (s.value) {
              try {
                setBenefits(JSON.parse(s.value));
              } catch {
                console.error('Error parsing benefits JSON');
              }
            }
            break;
          case 'campaign_is_active':
            setIsActive(s.value === 'true');
            break;
          case 'campaign_courses_title':
            if (s.value) setCoursesSectionTitle(s.value);
            break;
          case 'campaign_courses_subtitle':
            if (s.value) setCoursesSectionSubtitle(s.value);
            break;
        }
      });

      // Load images
      const { data: campaignImages } = await supabase
        .from('campaign_images')
        .select('id, url, title')
        .eq('is_active', true)
        .eq('type', 'student_photo')
        .order('sort_order', { ascending: true });

      if (campaignImages) {
        setImages(campaignImages);
      }

      // Load courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, description, duration, price')
        .eq('is_active', true)
        .order('name');

      if (coursesData) {
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error loading campaign data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    scrollToForm();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-2xl font-bold mb-4">Campanha Encerrada</h1>
            <p className="text-muted-foreground">
              Esta campanha não está mais ativa. Entre em contato conosco para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <HeroSection
        title={heroTitle}
        subtitle={heroSubtitle}
        backgroundImage={heroImage}
        onCtaClick={scrollToForm}
      />

      {/* Photo Gallery */}
      {images.length > 0 && <PhotoGallery images={images} />}

      {/* Benefits */}
      {benefits.length > 0 && <BenefitsSection benefits={benefits} />}

      {/* Courses */}
      {courses.length > 0 && (
        <CourseCards 
          courses={courses} 
          onSelectCourse={handleSelectCourse}
          sectionTitle={coursesSectionTitle}
          sectionSubtitle={coursesSectionSubtitle}
        />
      )}

      {/* Lead Capture Form */}
      <section className="py-16 px-4 bg-gradient-to-b from-muted/50 to-background" id="form">
        <div className="max-w-md mx-auto" ref={formRef}>
          <Card className="shadow-2xl border-2 border-primary/20">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">Garanta sua vaga!</CardTitle>
              <p className="text-muted-foreground text-sm mt-2">
                Preencha o formulário e entraremos em contato
              </p>
            </CardHeader>
            <CardContent>
              <LeadCaptureForm
                courses={courses}
                selectedCourseId={selectedCourseId}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {branding.logo && (
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="w-10 h-10 rounded-xl object-contain"
              />
            )}
            <span className="text-lg font-semibold text-foreground">{branding.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {branding.name}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
