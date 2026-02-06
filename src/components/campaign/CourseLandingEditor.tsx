import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Image as ImageIcon
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

interface CourseLandingData {
  id?: string;
  course_id: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image: string;
  benefits: Benefit[];
  gallery_images: GalleryImage[];
  is_active: boolean;
  custom_name: string;
  custom_description: string;
  custom_duration: string;
  custom_price: string;
}

const ICON_OPTIONS = ['Star', 'Award', 'GraduationCap', 'Clock', 'Heart', 'Lightbulb', 'Target', 'Users', 'Rocket', 'Brain'];

export function CourseLandingEditor() {
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
    loadCourses();
  }, []);

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

        setLandingData({
          id: data.id,
          course_id: course.id,
          hero_title: data.hero_title || '',
          hero_subtitle: data.hero_subtitle || '',
          hero_image: data.hero_image || '',
          benefits,
          gallery_images: galleryImages,
          is_active: data.is_active,
          custom_name: (data as any).custom_name || '',
          custom_description: (data as any).custom_description || '',
          custom_duration: (data as any).custom_duration || '',
          custom_price: (data as any).custom_price?.toString() || '',
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
          is_active: true,
          custom_name: '',
          custom_description: '',
          custom_duration: '',
          custom_price: '',
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
        is_active: landingData.is_active,
        custom_name: landingData.custom_name || null,
        custom_description: landingData.custom_description || null,
        custom_duration: landingData.custom_duration || null,
        custom_price: landingData.custom_price ? parseFloat(landingData.custom_price) : null,
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
                    <DialogContent className="max-w-3xl max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Configurar Landing Page - {selectedCourse?.name}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[70vh] pr-4">
                        {landingData && (
                          <div className="space-y-6 py-4">
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

                            {/* Hero Section */}
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

                            {/* Custom Course Info */}
                            <div className="space-y-4">
                              <h4 className="font-medium">Informações do Curso (personalizadas)</h4>
                              <p className="text-sm text-muted-foreground">
                                Deixe em branco para usar os dados originais do curso.
                              </p>
                              
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
                                  rows={2}
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

                            {/* Benefits Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">Benefícios</h4>
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
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  Nenhum benefício adicionado. Clique em "Adicionar" para começar.
                                </p>
                              )}
                            </div>

                            {/* Gallery Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">Galeria de Imagens</h4>
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
                                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Nenhuma imagem na galeria</p>
                                </div>
                              )}
                            </div>

                            {/* Save Button */}
                            <Button onClick={handleSave} disabled={isSaving} className="w-full">
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-2" />
                              )}
                              Salvar Página
                            </Button>
                          </div>
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}

            {courses.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum curso cadastrado. Cadastre cursos primeiro.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
