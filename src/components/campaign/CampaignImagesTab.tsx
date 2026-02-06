import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Loader2, 
  Upload, 
  Trash2, 
  GripVertical,
  Image as ImageIcon,
} from 'lucide-react';

interface CampaignImage {
  id: string;
  url: string;
  title: string | null;
  type: string;
  sort_order: number;
  is_active: boolean;
}

interface CampaignImagesTabProps {
  images: CampaignImage[];
  onImagesChange: (images: CampaignImage[]) => void;
  onReload: () => void;
}

export function CampaignImagesTab({ images, onImagesChange, onReload }: CampaignImagesTabProps) {
  const [isUploading, setIsUploading] = useState(false);

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
      onReload();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (image: CampaignImage) => {
    try {
      const fileName = image.url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('campaign-images').remove([fileName]);
      }

      await supabase.from('campaign_images').delete().eq('id', image.id);
      
      onImagesChange(images.filter(i => i.id !== image.id));
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
      
      onImagesChange(images.map(i => i.id === image.id ? { ...i, is_active: !i.is_active } : i));
    } catch (error) {
      console.error('Error toggling:', error);
      toast.error('Erro ao atualizar');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Galeria de Fotos</CardTitle>
            <CardDescription>Fotos de alunos que aparecerão na landing page</CardDescription>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadImage}
              disabled={isUploading}
            />
            <Button asChild disabled={isUploading} size="sm">
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
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhuma foto enviada ainda</p>
            <p className="text-sm">Clique em "Enviar Foto" para adicionar imagens</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((image) => (
              <div 
                key={image.id} 
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  image.is_active ? 'border-primary shadow-sm' : 'border-muted opacity-50'
                }`}
              >
                <img
                  src={image.url}
                  alt={image.title || 'Foto'}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
        )}
      </CardContent>
    </Card>
  );
}
