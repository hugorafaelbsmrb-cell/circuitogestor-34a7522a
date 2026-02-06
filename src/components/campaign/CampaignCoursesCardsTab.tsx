import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  BookOpen,
  ExternalLink,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CourseLandingEditor } from './CourseLandingEditor';

interface Course {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  price: number;
  slug: string | null;
  is_active: boolean | null;
}

interface CourseLandingPage {
  id: string;
  course_id: string;
  is_active: boolean;
}

export function CampaignCoursesCardsTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [landingPages, setLandingPages] = useState<CourseLandingPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, landingPagesRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, name, description, duration, price, slug, is_active')
          .order('name'),
        supabase
          .from('course_landing_pages')
          .select('id, course_id, is_active')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (landingPagesRes.error) throw landingPagesRes.error;

      setCourses(coursesRes.data || []);
      setLandingPages(landingPagesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar cursos');
    } finally {
      setIsLoading(false);
    }
  };

  const getLandingPageStatus = (courseId: string) => {
    const landingPage = landingPages.find(lp => lp.course_id === courseId);
    return landingPage ? landingPage.is_active : false;
  };

  const handleOpenCourseEditor = (courseId: string) => {
    setSelectedCourseId(courseId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCourseId(null);
    loadData(); // Refresh data after editing
  };

  const handlePreviewLanding = (slug: string | null, courseId: string) => {
    const url = slug 
      ? `${window.location.origin}/campanha/${slug}`
      : `${window.location.origin}/campanha/${courseId}`;
    window.open(url, '_blank');
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Landing Pages por Curso</h2>
            <p className="text-sm text-muted-foreground">
              Configure páginas de captação individuais para cada curso
            </p>
          </div>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Nenhum curso cadastrado</p>
                <p className="text-sm">Cadastre cursos na página de Cursos do sistema</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const hasLandingPage = getLandingPageStatus(course.id);
              const isActiveCourse = course.is_active ?? true;

              return (
                <Card 
                  key={course.id} 
                  className={`transition-all hover:shadow-md ${
                    !isActiveCourse ? 'opacity-60' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{course.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {course.duration} • R$ {course.price.toFixed(2)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {hasLandingPage ? (
                          <Badge variant="default" className="text-xs gap-1">
                            <Eye className="w-3 h-3" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <EyeOff className="w-3 h-3" />
                            Inativa
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {course.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                        {course.description}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        onClick={() => handleOpenCourseEditor(course.id)}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreviewLanding(course.slug, course.id)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Course Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Landing Page: {selectedCourse?.name || 'Curso'}
            </DialogTitle>
          </DialogHeader>
          {selectedCourseId && (
            <CourseLandingEditor 
              courseId={selectedCourseId} 
              onClose={handleCloseModal}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
