import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { AnimatedHeroSection } from '@/components/campaign/AnimatedHeroSection';
import { UrgencyBanner } from '@/components/campaign/UrgencyBanner';
import { FloatingCTA } from '@/components/campaign/FloatingCTA';
import { LeadCaptureForm } from '@/components/campaign/LeadCaptureForm';
import { LandingPageSkeleton } from '@/components/campaign/LandingPageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Lazy load heavier components for faster initial paint
const PhotoGallery = lazy(() => import('@/components/campaign/PhotoGallery').then(m => ({ default: m.PhotoGallery })));
const AnimatedBenefitsSection = lazy(() => import('@/components/campaign/AnimatedBenefitsSection').then(m => ({ default: m.AnimatedBenefitsSection })));
const CourseInfoCard = lazy(() => import('@/components/campaign/CourseInfoCard').then(m => ({ default: m.CourseInfoCard })));
const TestimonialsSection = lazy(() => import('@/components/campaign/TestimonialsSection').then(m => ({ default: m.TestimonialsSection })));

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

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
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
  testimonials: Testimonial[];
  is_active: boolean;
  custom_name: string | null;
  custom_description: string | null;
  custom_duration: string | null;
  custom_price: number | null;
  urgency_banner_message: string | null;
  urgency_banner_variant: string | null;
  floating_cta_text: string | null;
  floating_cta_enabled: boolean;
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

  // Update browser tab title with course name
  useEffect(() => {
    if (course) {
      const displayName = landingData?.custom_name || course.name;
      document.title = `${displayName} | ${branding.name}`;
    }
    
    // Cleanup: restore default title when leaving the page
    return () => {
      document.title = branding.browserTitle || branding.name;
    };
  }, [course, landingData?.custom_name, branding.name, branding.browserTitle]);

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
        let testimonials: Testimonial[] = [];

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

        try {
          if ((landingPageData as any).testimonials) {
            const rawTestimonials = typeof (landingPageData as any).testimonials === 'string'
              ? JSON.parse((landingPageData as any).testimonials)
              : (landingPageData as any).testimonials;
            testimonials = Array.isArray(rawTestimonials) ? rawTestimonials as unknown as Testimonial[] : [];
          }
        } catch { /* ignore */ }

        setLandingData({
          hero_title: landingPageData.hero_title,
          hero_subtitle: landingPageData.hero_subtitle,
          hero_image: landingPageData.hero_image,
          benefits,
          gallery_images: galleryImages,
          testimonials,
          is_active: landingPageData.is_active,
          custom_name: (landingPageData as any).custom_name || null,
          custom_description: (landingPageData as any).custom_description || null,
          custom_duration: (landingPageData as any).custom_duration || null,
          custom_price: (landingPageData as any).custom_price || null,
          urgency_banner_message: (landingPageData as any).urgency_banner_message || null,
          urgency_banner_variant: (landingPageData as any).urgency_banner_variant || 'warning',
          floating_cta_text: (landingPageData as any).floating_cta_text || 'Quero me matricular!',
          floating_cta_enabled: (landingPageData as any).floating_cta_enabled ?? true,
        });
      } else {
        // Use course defaults if no custom landing page
        setLandingData({
          hero_title: `Matricule-se em ${courseData.name}!`,
          hero_subtitle: courseData.description || 'Transforme o futuro do seu filho com cursos inovadores',
          hero_image: null,
          benefits: [],
          gallery_images: [],
          testimonials: [],
          is_active: true,
          custom_name: null,
          custom_description: null,
          custom_duration: null,
          custom_price: null,
          urgency_banner_message: null,
          urgency_banner_variant: 'warning',
          floating_cta_text: 'Quero me matricular!',
          floating_cta_enabled: true,
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
    return <LandingPageSkeleton />;
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
        message={landingData.urgency_banner_message || "🔥 Últimas vagas com desconto especial! Promoção válida por tempo limitado."}
        variant={(landingData.urgency_banner_variant as 'warning' | 'destructive' | 'default' | 'secondary') || "warning"}
      />

      {/* Hero - renders immediately */}
      <AnimatedHeroSection
        title={landingData.hero_title || `Matricule-se em ${displayName}!`}
        subtitle={landingData.hero_subtitle || displayDescription || ''}
        backgroundImage={landingData.hero_image || undefined}
        onCtaClick={scrollToForm}
        urgencyText="Vagas Limitadas!"
        socialProofCount={150}
      />

      {/* Lazy loaded sections */}
      <Suspense fallback={null}>
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
        <TestimonialsSection 
          testimonials={landingData.testimonials.length > 0 ? landingData.testimonials : undefined} 
        />
      </Suspense>

      {/* Lead Capture Form */}
      <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-b from-muted/50 to-background" id="form">
        <div className="max-w-md mx-auto" ref={formRef}>
          <Card className="shadow-xl sm:shadow-2xl border-2 border-primary/20 overflow-hidden">
            <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary to-accent" />
            <CardHeader className="text-center pb-3 sm:pb-4 pt-6 sm:pt-8">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl">Garanta sua vaga agora!</CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Preencha o formulário e receba informações exclusivas
              </p>
            </CardHeader>
            <CardContent className="pb-6 sm:pb-8 px-4 sm:px-6">
              <LeadCaptureForm
                courses={[course]}
                selectedCourseId={course.id}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Floating CTA */}
      {landingData.floating_cta_enabled && (
        <FloatingCTA 
          onCtaClick={scrollToForm} 
          buttonText={landingData.floating_cta_text || "Quero me matricular!"}
        />
      )}

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            {branding.logo && (
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl object-contain"
                loading="lazy"
              />
            )}
            <span className="text-lg sm:text-xl font-semibold text-foreground">{branding.name}</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            Transformando o futuro através da educação
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            © {new Date().getFullYear()} {branding.name}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
