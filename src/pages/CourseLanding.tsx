import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { AnimatedHeroSection } from '@/components/campaign/AnimatedHeroSection';
import { PhotoGallery } from '@/components/campaign/PhotoGallery';
import { AnimatedBenefitsSection } from '@/components/campaign/AnimatedBenefitsSection';
import { CourseInfoCard } from '@/components/campaign/CourseInfoCard';
import { TestimonialsSection } from '@/components/campaign/TestimonialsSection';
import { UrgencyBanner } from '@/components/campaign/UrgencyBanner';
import { FloatingCTA } from '@/components/campaign/FloatingCTA';
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
  custom_name: string | null;
  custom_description: string | null;
  custom_duration: string | null;
  custom_price: number | null;
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
          custom_name: (landingPageData as any).custom_name || null,
          custom_description: (landingPageData as any).custom_description || null,
          custom_duration: (landingPageData as any).custom_duration || null,
          custom_price: (landingPageData as any).custom_price || null,
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
          custom_name: null,
          custom_description: null,
          custom_duration: null,
          custom_price: null,
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

  // Get display values (custom or fallback to course)
  const displayName = landingData.custom_name || course.name;
  const displayDescription = landingData.custom_description || course.description;
  const displayDuration = landingData.custom_duration || course.duration;
  const displayPrice = landingData.custom_price ?? course.price;

  return (
    <div className="min-h-screen bg-background">
      {/* Urgency Banner */}
      <UrgencyBanner 
        message="🔥 Últimas vagas com desconto especial! Promoção válida por tempo limitado."
        variant="warning"
      />

      {/* Hero */}
      <AnimatedHeroSection
        title={landingData.hero_title || `Matricule-se em ${displayName}!`}
        subtitle={landingData.hero_subtitle || displayDescription || ''}
        backgroundImage={landingData.hero_image || undefined}
        onCtaClick={scrollToForm}
        urgencyText="Vagas Limitadas!"
        socialProofCount={150}
      />

      {/* Photo Gallery */}
      {landingData.gallery_images.length > 0 && (
        <PhotoGallery images={landingData.gallery_images} />
      )}

      {/* Benefits */}
      {landingData.benefits.length > 0 && (
        <AnimatedBenefitsSection 
          benefits={landingData.benefits}
          title="Benefícios exclusivos"
          subtitle="Veja o que seu filho vai conquistar"
        />
      )}

      {/* Course Info Card */}
      <CourseInfoCard
        name={displayName}
        description={displayDescription}
        duration={displayDuration}
        price={displayPrice}
        onCtaClick={scrollToForm}
      />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Lead Capture Form */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/50 to-background" id="form">
        <div className="max-w-md mx-auto" ref={formRef}>
          <Card className="shadow-2xl border-2 border-primary/20 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary to-accent" />
            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-2xl md:text-3xl">Garanta sua vaga agora!</CardTitle>
              <p className="text-muted-foreground mt-2">
                Preencha o formulário e receba informações exclusivas
              </p>
            </CardHeader>
            <CardContent className="pb-8">
              <LeadCaptureForm
                courses={[course]}
                selectedCourseId={course.id}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Floating CTA */}
      <FloatingCTA onCtaClick={scrollToForm} />

      {/* Footer */}
      <footer className="py-12 px-4 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {branding.logo && (
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="w-12 h-12 rounded-xl object-contain"
              />
            )}
            <span className="text-xl font-semibold text-foreground">{branding.name}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Transformando o futuro através da educação
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {branding.name}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
