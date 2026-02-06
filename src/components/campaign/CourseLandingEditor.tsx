import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { 
  Loader2, 
  Save, 
  Link as LinkIcon, 
  Plus, 
  X, 
  Upload,
  Trash2,
  Pencil,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Layout,
  MessageSquare,
  Images,
  Users,
  Megaphone
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean | null;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface GalleryImage {
  id: string;
  url: string;
  title?: string;
}

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
}

interface CourseLandingData {
  id?: string;
  course_id: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image: string;
  benefits: Benefit[];
  gallery_images: GalleryImage[];
  testimonials: Testimonial[];
  is_active: boolean;
  custom_name: string;
  custom_description: string;
  custom_duration: string;
  custom_price: string;
  urgency_banner_message: string;
  urgency_banner_variant: string;
  floating_cta_text: string;
  floating_cta_enabled: boolean;
}

const ICON_OPTIONS = ['Star', 'Award', 'GraduationCap', 'Clock', 'Heart', 'Lightbulb', 'Target', 'Users', 'Rocket', 'Brain'];
const RATING_OPTIONS = [1, 2, 3, 4, 5];
const BANNER_VARIANTS = [
  { value: 'warning', label: 'Amarelo (Urgência)' },
  { value: 'destructive', label: 'Vermelho (Alerta)' },
  { value: 'default', label: 'Primário' },
  { value: 'secondary', label: 'Neutro' },
];

interface CourseLandingEditorProps {
  courseId?: string;
  onClose?: () => void;
  embedded?: boolean;
}

export function CourseLandingEditor({ courseId, onClose, embedded = false }: CourseLandingEditorProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [landingData, setLandingData] = useState<CourseLandingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');

  useEffect(() => {
    if (courseId) {
      // Embedded mode: load specific course
      loadCourseById(courseId);
    } else {
      // Standalone mode: load all courses
      loadCourses();
    }
  }, [courseId]);

  const loadCourseById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, slug, is_active')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setCourses([data]);
        loadLandingData(data);
      }
    } catch (error) {
      console.error('Error loading course:', error);
      toast.error('Erro ao carregar curso');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, slug, is_active')
        .order('name');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Erro ao carregar cursos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLandingData = async (course: Course) => {
    setSelectedCourse(course);
    
    try {
      const { data, error } = await supabase
        .from('course_landing_pages')
        .select('*')
        .eq('course_id', course.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Parse JSON fields
        let benefits: Benefit[] = [];
        let galleryImages: GalleryImage[] = [];
        let testimonials: Testimonial[] = [];

        try {
          if (data.benefits) {
            const rawBenefits = typeof data.benefits === 'string' 
              ? JSON.parse(data.benefits) 
              : data.benefits;
            benefits = Array.isArray(rawBenefits) ? rawBenefits as unknown as Benefit[] : [];
          }
        } catch { /* ignore */ }

        try {
          if (data.gallery_images) {
            const rawImages = typeof data.gallery_images === 'string'
              ? JSON.parse(data.gallery_images)
              : data.gallery_images;
            galleryImages = Array.isArray(rawImages) ? rawImages as unknown as GalleryImage[] : [];
          }
        } catch { /* ignore */ }

        try {
          if ((data as any).testimonials) {
            const rawTestimonials = typeof (data as any).testimonials === 'string'
              ? JSON.parse((data as any).testimonials)
              : (data as any).testimonials;
            testimonials = Array.isArray(rawTestimonials) ? rawTestimonials as unknown as Testimonial[] : [];
          }
        } catch { /* ignore */ }

        setLandingData({
          id: data.id,
          course_id: course.id,
          hero_title: data.hero_title || '',
          hero_subtitle: data.hero_subtitle || '',
          hero_image: data.hero_image || '',
          benefits,
          gallery_images: galleryImages,
          testimonials,
          is_active: data.is_active,
          custom_name: (data as any).custom_name || '',
          custom_description: (data as any).custom_description || '',
          custom_duration: (data as any).custom_duration || '',
          custom_price: (data as any).custom_price?.toString() || '',
          urgency_banner_message: (data as any).urgency_banner_message || '',
          urgency_banner_variant: (data as any).urgency_banner_variant || 'warning',
          floating_cta_text: (data as any).floating_cta_text || 'Quero me matricular!',
          floating_cta_enabled: (data as any).floating_cta_enabled ?? true,
        });
      } else {
        // Create default data
        setLandingData({
          course_id: course.id,
          hero_title: `Matricule-se em ${course.name}!`,
          hero_subtitle: 'Transforme o futuro do seu filho com cursos inovadores',
          hero_image: '',
          benefits: [],
          gallery_images: [],
          testimonials: [],
          is_active: true,
          custom_name: '',
          custom_description: '',
          custom_duration: '',
          custom_price: '',
          urgency_banner_message: '🔥 Últimas vagas com desconto especial! Promoção válida por tempo limitado.',
          urgency_banner_variant: 'warning',
          floating_cta_text: 'Quero me matricular!',
          floating_cta_enabled: true,
        });
      }
    } catch (error) {
      console.error('Error loading landing data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const handleSave = async () => {
    if (!landingData || !selectedCourse) return;

    setIsSaving(true);
    try {
      const payload = {
        course_id: landingData.course_id,
        hero_title: landingData.hero_title,
        hero_subtitle: landingData.hero_subtitle,
        hero_image: landingData.hero_image,
        benefits: landingData.benefits as unknown as Json,
        gallery_images: landingData.gallery_images as unknown as Json,
        testimonials: landingData.testimonials as unknown as Json,
        is_active: landingData.is_active,
        custom_name: landingData.custom_name || null,
        custom_description: landingData.custom_description || null,
        custom_duration: landingData.custom_duration || null,
        custom_price: landingData.custom_price ? parseFloat(landingData.custom_price) : null,
        urgency_banner_message: landingData.urgency_banner_message || null,
        urgency_banner_variant: landingData.urgency_banner_variant || 'warning',
        floating_cta_text: landingData.floating_cta_text || 'Quero me matricular!',
        floating_cta_enabled: landingData.floating_cta_enabled,
      };

      if (landingData.id) {
        // Update existing
        const { error } = await supabase
          .from('course_landing_pages')
          .update(payload)
          .eq('id', landingData.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('course_landing_pages')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;
        setLandingData({ ...landingData, id: data.id });
      }

      toast.success('Página salva com sucesso!');
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSlug = async (courseId: string) => {
    if (!newSlug.trim()) {
      toast.error('Slug não pode ser vazio');
      return;
    }

    // Validate slug format
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(newSlug)) {
      toast.error('Slug deve conter apenas letras minúsculas, números e hífens');
      return;
    }

    try {
      const { error } = await supabase
        .from('courses')
        .update({ slug: newSlug })
        .eq('id', courseId);

      if (error) {
        if (error.code === '23505') {
          toast.error('Este slug já está em uso');
          return;
        }
        throw error;
      }

      setCourses(courses.map(c => c.id === courseId ? { ...c, slug: newSlug } : c));
      setEditingSlug(null);
      setNewSlug('');
      toast.success('Slug atualizado!');
    } catch (error) {
      console.error('Error saving slug:', error);
      toast.error('Erro ao salvar slug');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleUploadHeroImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !landingData) return;

    setIsUploadingHero(true);
    try {
      const fileName = `hero-${selectedCourse?.id}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);

      setLandingData({ ...landingData, hero_image: urlData.publicUrl });
      toast.success('Imagem enviada!');
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploadingHero(false);
    }
  };

  const handleUploadGalleryImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !landingData) return;

    setIsUploadingGallery(true);
    try {
      const fileName = `gallery-${selectedCourse?.id}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);

      const newImage: GalleryImage = {
        id: `img-${Date.now()}`,
        url: urlData.publicUrl,
        title: file.name.split('.')[0],
      };

      setLandingData({
        ...landingData,
        gallery_images: [...landingData.gallery_images, newImage],
      });
      toast.success('Imagem adicionada!');
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const removeGalleryImage = (imageId: string) => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      gallery_images: landingData.gallery_images.filter(img => img.id !== imageId),
    });
  };

  const addBenefit = () => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      benefits: [...landingData.benefits, { icon: 'Star', title: '', description: '' }],
    });
  };

  const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      benefits: landingData.benefits.map((b, i) => i === index ? { ...b, [field]: value } : b),
    });
  };

  const removeBenefit = (index: number) => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      benefits: landingData.benefits.filter((_, i) => i !== index),
    });
  };

  // Testimonials management
  const addTestimonial = () => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      testimonials: [...landingData.testimonials, { name: '', role: '', content: '', rating: 5 }],
    });
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: string | number) => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      testimonials: landingData.testimonials.map((t, i) => i === index ? { ...t, [field]: value } : t),
    });
  };

  const removeTestimonial = (index: number) => {
    if (!landingData) return;
    setLandingData({
      ...landingData,
      testimonials: landingData.testimonials.filter((_, i) => i !== index),
    });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/campanha/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Embedded mode: render only the editor content for modal use
  if (embedded && landingData) {
    return (
      <div className="space-y-4">
        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger value="hero" className="text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Hero</span>
            </TabsTrigger>
            <TabsTrigger value="course" className="text-xs sm:text-sm">
              <Layout className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Curso</span>
            </TabsTrigger>
            <TabsTrigger value="benefits" className="text-xs sm:text-sm">
              <MessageSquare className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Benefícios</span>
            </TabsTrigger>
            <TabsTrigger value="gallery" className="text-xs sm:text-sm">
              <Images className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Galeria</span>
            </TabsTrigger>
            <TabsTrigger value="testimonials" className="text-xs sm:text-sm">
              <Users className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Depoimentos</span>
            </TabsTrigger>
            <TabsTrigger value="cta" className="text-xs sm:text-sm">
              <Megaphone className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">CTAs</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[50vh] pr-4">
            {/* Hero Tab */}
            <TabsContent value="hero" className="space-y-4 mt-0">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Página Ativa</Label>
                  <p className="text-sm text-muted-foreground">Página visível publicamente</p>
                </div>
                <Switch
                  checked={landingData.is_active}
                  onCheckedChange={(checked) => setLandingData({ ...landingData, is_active: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={landingData.hero_title}
                  onChange={(e) => setLandingData({ ...landingData, hero_title: e.target.value })}
                  placeholder="Matricule-se agora!"
                />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Textarea
                  value={landingData.hero_subtitle}
                  onChange={(e) => setLandingData({ ...landingData, hero_subtitle: e.target.value })}
                  placeholder="Descrição atrativa do curso"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Imagem de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    value={landingData.hero_image}
                    onChange={(e) => setLandingData({ ...landingData, hero_image: e.target.value })}
                    placeholder="URL da imagem"
                  />
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadHeroImage} disabled={isUploadingHero} />
                    <Button asChild variant="outline" disabled={isUploadingHero}>
                      <span>{isUploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                    </Button>
                  </label>
                </div>
                {landingData.hero_image && (
                  <img src={landingData.hero_image} alt="Hero preview" className="h-24 w-full object-cover rounded-lg" />
                )}
              </div>
            </TabsContent>

            {/* Course Tab */}
            <TabsContent value="course" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Curso</Label>
                  <Input
                    value={landingData.custom_name}
                    onChange={(e) => setLandingData({ ...landingData, custom_name: e.target.value })}
                    placeholder={selectedCourse?.name || 'Nome original'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duração</Label>
                  <Input
                    value={landingData.custom_duration}
                    onChange={(e) => setLandingData({ ...landingData, custom_duration: e.target.value })}
                    placeholder="Ex: 6 meses"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={landingData.custom_description}
                  onChange={(e) => setLandingData({ ...landingData, custom_description: e.target.value })}
                  placeholder="Descrição personalizada"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={landingData.custom_price}
                  onChange={(e) => setLandingData({ ...landingData, custom_price: e.target.value })}
                  placeholder="Preço personalizado"
                />
              </div>
            </TabsContent>

            {/* Benefits Tab */}
            <TabsContent value="benefits" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Benefícios</h4>
                <Button size="sm" variant="outline" onClick={addBenefit}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              {landingData.benefits.map((benefit, index) => (
                <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                  <div className="flex-1 grid gap-2 sm:grid-cols-3">
                    <Select value={benefit.icon} onValueChange={(v) => updateBenefit(index, 'icon', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={benefit.title} onChange={(e) => updateBenefit(index, 'title', e.target.value)} placeholder="Título" />
                    <Input value={benefit.description} onChange={(e) => updateBenefit(index, 'description', e.target.value)} placeholder="Descrição" />
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeBenefit(index)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Galeria de Imagens</h4>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadGalleryImage} disabled={isUploadingGallery} />
                  <Button asChild size="sm" variant="outline" disabled={isUploadingGallery}>
                    <span>{isUploadingGallery ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Adicionar</span>
                  </Button>
                </label>
              </div>
              {landingData.gallery_images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma imagem adicionada</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {landingData.gallery_images.map((image) => (
                    <div key={image.id} className="relative group rounded-lg overflow-hidden border">
                      <img src={image.url} alt={image.title || 'Imagem'} className="w-full aspect-square object-cover" />
                      <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeGalleryImage(image.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Testimonials Tab */}
            <TabsContent value="testimonials" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Depoimentos</h4>
                <Button size="sm" variant="outline" onClick={addTestimonial}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              {landingData.testimonials.map((testimonial, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <Input value={testimonial.name} onChange={(e) => updateTestimonial(index, 'name', e.target.value)} placeholder="Nome" />
                      <Input value={testimonial.role} onChange={(e) => updateTestimonial(index, 'role', e.target.value)} placeholder="Cargo" />
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive ml-2" onClick={() => removeTestimonial(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea value={testimonial.content} onChange={(e) => updateTestimonial(index, 'content', e.target.value)} placeholder="Depoimento" rows={2} />
                  <Select value={testimonial.rating.toString()} onValueChange={(v) => updateTestimonial(index, 'rating', parseInt(v))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATING_OPTIONS.map(r => <SelectItem key={r} value={r.toString()}>{r} estrelas</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </TabsContent>

            {/* CTA Tab */}
            <TabsContent value="cta" className="space-y-4 mt-0">
              <div className="space-y-4">
                <h4 className="font-medium">Banner de Urgência</h4>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Input
                    value={landingData.urgency_banner_message}
                    onChange={(e) => setLandingData({ ...landingData, urgency_banner_message: e.target.value })}
                    placeholder="🔥 Últimas vagas com desconto!"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estilo</Label>
                  <Select value={landingData.urgency_banner_variant} onValueChange={(v) => setLandingData({ ...landingData, urgency_banner_variant: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BANNER_VARIANTS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Botão Flutuante (CTA)</h4>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label>Exibir botão flutuante</Label>
                    <p className="text-xs text-muted-foreground">Botão fixo no canto da tela</p>
                  </div>
                  <Switch checked={landingData.floating_cta_enabled} onCheckedChange={(checked) => setLandingData({ ...landingData, floating_cta_enabled: checked })} />
                </div>
                {landingData.floating_cta_enabled && (
                  <div className="space-y-2">
                    <Label>Texto do Botão</Label>
                    <Input
                      value={landingData.floating_cta_text}
                      onChange={(e) => setLandingData({ ...landingData, floating_cta_text: e.target.value })}
                      placeholder="Quero me matricular!"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>

          <div className="pt-4 border-t mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course List */}
      <Card>
        <CardHeader>
          <CardTitle>Landing Pages por Curso</CardTitle>
          <CardDescription>Configure uma página de captação dedicada para cada curso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {courses.map((course) => (
              <div key={course.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{course.name}</h3>
                      {!course.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    
                    {/* Slug management */}
                    <div className="flex items-center gap-2 mt-1">
                      {editingSlug === course.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">/campanha/</span>
                          <Input
                            value={newSlug}
                            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                            placeholder="slug-do-curso"
                            className="h-7 w-40 text-sm"
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleSaveSlug(course.id)}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingSlug(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : course.slug ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">/campanha/{course.slug}</code>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-1.5"
                            onClick={() => {
                              setEditingSlug(course.id);
                              setNewSlug(course.slug || '');
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-1.5"
                            onClick={() => copyLink(course.slug!)}
                          >
                            <LinkIcon className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-1.5"
                            onClick={() => window.open(`/campanha/${course.slug}`, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="link" 
                          className="h-6 px-0 text-xs"
                          onClick={() => {
                            setEditingSlug(course.id);
                            setNewSlug(generateSlug(course.name));
                          }}
                        >
                          + Definir slug
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Edit button */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => loadLandingData(course)}
                        disabled={!course.slug}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar Página
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Layout className="w-5 h-5" />
                          Configurar Landing Page - {selectedCourse?.name}
                        </DialogTitle>
                      </DialogHeader>
                      
                      {landingData && (
                        <Tabs defaultValue="hero" className="w-full">
                          <TabsList className="grid w-full grid-cols-6 mb-4">
                            <TabsTrigger value="hero" className="text-xs sm:text-sm">
                              <Sparkles className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Hero</span>
                            </TabsTrigger>
                            <TabsTrigger value="course" className="text-xs sm:text-sm">
                              <Layout className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Curso</span>
                            </TabsTrigger>
                            <TabsTrigger value="benefits" className="text-xs sm:text-sm">
                              <MessageSquare className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Benefícios</span>
                            </TabsTrigger>
                            <TabsTrigger value="gallery" className="text-xs sm:text-sm">
                              <Images className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Galeria</span>
                            </TabsTrigger>
                            <TabsTrigger value="testimonials" className="text-xs sm:text-sm">
                              <Users className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Depoimentos</span>
                            </TabsTrigger>
                            <TabsTrigger value="cta" className="text-xs sm:text-sm">
                              <Megaphone className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">CTAs</span>
                            </TabsTrigger>
                          </TabsList>

                          <ScrollArea className="max-h-[60vh] pr-4">
                            {/* Hero Tab */}
                            <TabsContent value="hero" className="space-y-4 mt-0">
                              {/* Active toggle */}
                              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                  <Label>Página Ativa</Label>
                                  <p className="text-sm text-muted-foreground">Página visível publicamente</p>
                                </div>
                                <Switch
                                  checked={landingData.is_active}
                                  onCheckedChange={(checked) => setLandingData({ ...landingData, is_active: checked })}
                                />
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-medium">Seção Hero</h4>
                                
                                <div className="space-y-2">
                                  <Label>Título</Label>
                                  <Input
                                    value={landingData.hero_title}
                                    onChange={(e) => setLandingData({ ...landingData, hero_title: e.target.value })}
                                    placeholder="Matricule-se agora!"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Subtítulo</Label>
                                  <Textarea
                                    value={landingData.hero_subtitle}
                                    onChange={(e) => setLandingData({ ...landingData, hero_subtitle: e.target.value })}
                                    placeholder="Descrição atrativa do curso"
                                    rows={2}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Imagem de Fundo</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={landingData.hero_image}
                                      onChange={(e) => setLandingData({ ...landingData, hero_image: e.target.value })}
                                      placeholder="URL da imagem ou faça upload"
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
                                          {isUploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        </span>
                                      </Button>
                                    </label>
                                  </div>
                                  {landingData.hero_image && (
                                    <img src={landingData.hero_image} alt="Hero preview" className="h-32 w-full object-cover rounded-lg" />
                                  )}
                                </div>
                              </div>
                            </TabsContent>

                            {/* Course Info Tab */}
                            <TabsContent value="course" className="space-y-4 mt-0">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium">Informações do Curso</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Personalize as informações exibidas. Deixe em branco para usar os dados originais do curso.
                                  </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Nome do Curso</Label>
                                    <Input
                                      value={landingData.custom_name}
                                      onChange={(e) => setLandingData({ ...landingData, custom_name: e.target.value })}
                                      placeholder={selectedCourse?.name || 'Nome original do curso'}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Duração</Label>
                                    <Input
                                      value={landingData.custom_duration}
                                      onChange={(e) => setLandingData({ ...landingData, custom_duration: e.target.value })}
                                      placeholder="Ex: 6 meses"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Descrição</Label>
                                  <Textarea
                                    value={landingData.custom_description}
                                    onChange={(e) => setLandingData({ ...landingData, custom_description: e.target.value })}
                                    placeholder="Descrição personalizada do curso"
                                    rows={3}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Preço (R$)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={landingData.custom_price}
                                    onChange={(e) => setLandingData({ ...landingData, custom_price: e.target.value })}
                                    placeholder="Preço personalizado"
                                  />
                                </div>
                              </div>
                            </TabsContent>

                            {/* Benefits Tab */}
                            <TabsContent value="benefits" className="space-y-4 mt-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Benefícios</h4>
                                  <p className="text-sm text-muted-foreground">Liste os diferenciais do curso</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addBenefit}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar
                                </Button>
                              </div>

                              {landingData.benefits.map((benefit, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Ícone</Label>
                                        <select
                                          value={benefit.icon}
                                          onChange={(e) => updateBenefit(index, 'icon', e.target.value)}
                                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                          {ICON_OPTIONS.map(icon => (
                                            <option key={icon} value={icon}>{icon}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Título</Label>
                                        <Input
                                          value={benefit.title}
                                          onChange={(e) => updateBenefit(index, 'title', e.target.value)}
                                          placeholder="Título do benefício"
                                        />
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="ml-2" onClick={() => removeBenefit(index)}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Descrição</Label>
                                    <Textarea
                                      value={benefit.description}
                                      onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                                      placeholder="Descrição do benefício"
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              ))}

                              {landingData.benefits.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                                  Nenhum benefício adicionado. Clique em "Adicionar" para começar.
                                </p>
                              )}
                            </TabsContent>

                            {/* Gallery Tab */}
                            <TabsContent value="gallery" className="space-y-4 mt-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Galeria de Imagens</h4>
                                  <p className="text-sm text-muted-foreground">Adicione fotos de alunos e atividades</p>
                                </div>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleUploadGalleryImage}
                                    disabled={isUploadingGallery}
                                  />
                                  <Button asChild size="sm" variant="outline" disabled={isUploadingGallery}>
                                    <span>
                                      {isUploadingGallery ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                                      Adicionar
                                    </span>
                                  </Button>
                                </label>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                {landingData.gallery_images.map((img) => (
                                  <div key={img.id} className="relative group">
                                    <img
                                      src={img.url}
                                      alt={img.title || 'Imagem'}
                                      className="w-full aspect-square object-cover rounded-lg"
                                    />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeGalleryImage(img.id)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              {landingData.gallery_images.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Nenhuma imagem na galeria</p>
                                </div>
                              )}
                            </TabsContent>

                            {/* Testimonials Tab */}
                            <TabsContent value="testimonials" className="space-y-4 mt-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">Depoimentos</h4>
                                  <p className="text-sm text-muted-foreground">O que os pais dizem sobre o curso</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addTestimonial}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar
                                </Button>
                              </div>

                              {landingData.testimonials.map((testimonial, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Nome</Label>
                                        <Input
                                          value={testimonial.name}
                                          onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                                          placeholder="Nome do responsável"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Relação</Label>
                                        <Input
                                          value={testimonial.role}
                                          onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                                          placeholder="Ex: Mãe do João, 8 anos"
                                        />
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="ml-2" onClick={() => removeTestimonial(index)}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Depoimento</Label>
                                    <Textarea
                                      value={testimonial.content}
                                      onChange={(e) => updateTestimonial(index, 'content', e.target.value)}
                                      placeholder="O que o responsável disse sobre o curso..."
                                      rows={2}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Avaliação</Label>
                                    <select
                                      value={testimonial.rating}
                                      onChange={(e) => updateTestimonial(index, 'rating', parseInt(e.target.value))}
                                      className="w-24 h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                      {RATING_OPTIONS.map(rating => (
                                        <option key={rating} value={rating}>{rating} ⭐</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ))}

                              {landingData.testimonials.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                                  Nenhum depoimento adicionado. Se deixar vazio, serão exibidos depoimentos padrão.
                                </p>
                              )}
                            </TabsContent>

                            {/* CTAs Tab */}
                            <TabsContent value="cta" className="space-y-6 mt-0">
                              {/* Urgency Banner */}
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Megaphone className="w-4 h-4" />
                                    Banner de Urgência
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Aparece no topo da página para criar senso de urgência
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>Mensagem do Banner</Label>
                                  <Input
                                    value={landingData.urgency_banner_message}
                                    onChange={(e) => setLandingData({ ...landingData, urgency_banner_message: e.target.value })}
                                    placeholder="🔥 Últimas vagas com desconto especial!"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Deixe em branco para usar o padrão. Use emojis para chamar atenção!
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label>Estilo do Banner</Label>
                                  <Select
                                    value={landingData.urgency_banner_variant}
                                    onValueChange={(value) => setLandingData({ ...landingData, urgency_banner_variant: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {BANNER_VARIANTS.map(variant => (
                                        <SelectItem key={variant.value} value={variant.value}>
                                          {variant.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Floating CTA */}
                              <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium">Botão Flutuante (CTA)</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Botão fixo que aparece ao rolar a página
                                    </p>
                                  </div>
                                  <Switch
                                    checked={landingData.floating_cta_enabled}
                                    onCheckedChange={(checked) => setLandingData({ ...landingData, floating_cta_enabled: checked })}
                                  />
                                </div>

                                {landingData.floating_cta_enabled && (
                                  <div className="space-y-2">
                                    <Label>Texto do Botão</Label>
                                    <Input
                                      value={landingData.floating_cta_text}
                                      onChange={(e) => setLandingData({ ...landingData, floating_cta_text: e.target.value })}
                                      placeholder="Quero me matricular!"
                                    />
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                          </ScrollArea>

                          {/* Save Button - Always visible */}
                          <div className="pt-4 border-t mt-4">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full">
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-2" />
                              )}
                              Salvar Alterações
                            </Button>
                          </div>
                        </Tabs>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
