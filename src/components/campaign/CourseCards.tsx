import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Clock, BookOpen } from 'lucide-react';

interface Course {
  id: string;
  name: string;
  description?: string;
  duration: string;
  price: number;
}

interface CourseCardsProps {
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
}

export function CourseCards({ courses, onSelectCourse, sectionTitle, sectionSubtitle }: CourseCardsProps) {
  if (courses.length === 0) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  };

  return (
    <section className="py-16 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-foreground">
          {sectionTitle || 'Nossos Cursos'}
        </h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">
          {sectionSubtitle || 'Escolha o melhor curso para o seu filho'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card 
              key={course.id} 
              className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-500" />
              
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{course.name}</h3>
              </CardHeader>

              <CardContent className="pb-4">
                {course.description && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {course.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">A partir de</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(course.price)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => onSelectCourse(course.id)}
                >
                  Quero saber mais
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
