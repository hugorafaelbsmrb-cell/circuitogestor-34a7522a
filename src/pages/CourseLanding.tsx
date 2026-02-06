import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { HeroSection } from '@/components/campaign/HeroSection';
import { PhotoGallery } from '@/components/campaign/PhotoGallery';
import { BenefitsSection } from '@/components/campaign/BenefitsSection';
import { LeadCaptureForm } from '@/components/campaign/LeadCaptureForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CampaignImage {
  id: string;
  url: string;
  title?: string;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  duration: string;
  price: number;
  slug: string;
}

interface CourseLandingData {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  benefits: Benefit[];
  gallery_images: CampaignImage[];
  is_active: boolean;
}

export default function CourseLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { branding } = useSystemBranding();
  
  const [isLoading, setIsLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [landingData, setLandingData] = useState<CourseLandingData | null>(null);
  const [notFound, setNotFound] = useState(false);
  
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      loadCourseData(slug);
    }
  }, [slug]);

  const loadCourseData = async (courseSlug: string) => {
    try {
      // Find course by slug
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id, name, description, duration, price, slug')
        .eq('slug', courseSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (courseError) throw courseError;

      if (!courseData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setCourse(courseData);

      // Load landing page data for this course
      const { data: landingPageData } = await supabase
        .from('course_landing_pages')
        .select('*')
        .eq('course_id', courseData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (landingPageData) {
        // Parse JSON fields
        let benefits: Benefit[] = [];
        let galleryImages: CampaignImage[] = [];

        try {
          if (landingPageData.benefits) {
            const rawBenefits = typeof landingPageData.benefits === 'string' 
              ? JSON.parse(landingPageData.benefits) 
              : landingPageData.benefits;
            benefits = Array.isArray(rawBenefits) ? rawBenefits as unknown as Benefit[] : [];
          }
        } catch { /* ignore */ }

        try {
          if (landingPageData.gallery_images) {
            const rawImages = typeof landingPageData.gallery_images === 'string'
              ? JSON.parse(landingPageData.gallery_images)
              : landingPageData.gallery_images;
            galleryImages = Array.isArray(rawImages) ? rawImages as unknown as CampaignImage[] : [];
          }
        } catch { /* ignore */ }

        setLandingData({
          hero_title: landingPageData.hero_title,
          hero_subtitle: landingPageData.hero_subtitle,
          hero_image: landingPageData.hero_image,
          benefits,
          gallery_images: galleryImages,
          is_active: landingPageData.is_active,
        });
      } else {
        // Use course defaults if no custom landing page
        setLandingData({
          hero_title: `Matricule-se em ${courseData.name}!`,
          hero_subtitle: courseData.description || 'Transforme o futuro do seu filho com cursos inovadores',
          hero_image: null,
          benefits: [],
          gallery_images: [],
          is_active: true,
        });
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !course) {
    return <Navigate to="/campanha" replace />;
  }

  if (!landingData?.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-2xl font-bold mb-4">Página Indisponível</h1>
            <p className="text-muted-foreground">
              Esta página de campanha não está ativa no momento. Entre em contato conosco para mais informações.
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
        title={landingData.hero_title || `Matricule-se em ${course.name}!`}
        subtitle={landingData.hero_subtitle || course.description || ''}
        backgroundImage={landingData.hero_image || undefined}
        onCtaClick={scrollToForm}
      />

      {/* Photo Gallery */}
      {landingData.gallery_images.length > 0 && (
        <PhotoGallery images={landingData.gallery_images} />
      )}

      {/* Benefits */}
      {landingData.benefits.length > 0 && (
        <BenefitsSection benefits={landingData.benefits} />
      )}

      {/* Course Info Card */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <Card className="overflow-hidden border-2 border-primary/20">
            <CardHeader className="bg-primary/5 text-center">
              <CardTitle className="text-2xl">{course.name}</CardTitle>
              {course.description && (
                <p className="text-muted-foreground mt-2">{course.description}</p>
              )}
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-center gap-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Duração</p>
                  <p className="font-semibold text-lg">{course.duration}</p>
                </div>
                <div className="border-l border-border hidden sm:block" />
                <div>
                  <p className="text-sm text-muted-foreground">Investimento</p>
                  <p className="font-semibold text-lg text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(course.price)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

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
                courses={[course]}
                selectedCourseId={course.id}
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
