import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Image, Plus, Trash2, X, ExternalLink, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ReportImageManagerProps {
  reportId: string;
  images: string[];
  onImagesUpdate: (images: string[]) => void;
  isReadOnly?: boolean;
}

// Converts Google Drive share link to direct image URL
function convertGoogleDriveUrl(url: string): string {
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
  // Pattern 2: https://drive.google.com/open?id=FILE_ID
  // Pattern 3: https://drive.google.com/uc?id=FILE_ID
  
  let fileId = '';
  
  // Try to extract file ID from different URL patterns
  const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    fileId = fileIdMatch[1];
  } else {
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch) {
      fileId = idParamMatch[1];
    }
  }

  if (fileId) {
    // Use Google Drive direct link format
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  // If it's not a Google Drive URL, return as-is
  return url;
}

// Validates if URL is a valid Google Drive link
function isValidGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.startsWith('http');
}

export default function ReportImageManager({ 
  reportId, 
  images, 
  onImagesUpdate,
  isReadOnly = false 
}: ReportImageManagerProps) {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleAddImage = async () => {
    if (!newImageUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe o link de compartilhamento do Google Drive',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidGoogleDriveUrl(newImageUrl)) {
      toast({
        title: 'URL inválida',
        description: 'Informe um link válido do Google Drive ou uma URL de imagem',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const directUrl = convertGoogleDriveUrl(newImageUrl.trim());
      const updatedImages = [...images, directUrl];

      const { error } = await supabase
        .from('student_reports')
        .update({ images: updatedImages })
        .eq('id', reportId);

      if (error) throw error;

      onImagesUpdate(updatedImages);
      setNewImageUrl('');
      setIsAddModalOpen(false);
      
      toast({
        title: 'Imagem adicionada',
        description: 'A imagem foi vinculada ao relatório',
      });
    } catch (error) {
      console.error('Error adding image:', error);
      toast({
        title: 'Erro ao adicionar imagem',
        description: 'Não foi possível salvar a imagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    setIsLoading(true);
    try {
      const updatedImages = images.filter((_, i) => i !== index);

      const { error } = await supabase
        .from('student_reports')
        .update({ images: updatedImages })
        .eq('id', reportId);

      if (error) throw error;

      onImagesUpdate(updatedImages);
      
      toast({
        title: 'Imagem removida',
        description: 'A imagem foi removida do relatório',
      });
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: 'Erro ao remover imagem',
        description: 'Não foi possível remover a imagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setNewImageUrl(url);
    // Preview the converted URL
    if (url.trim()) {
      setPreviewUrl(convertGoogleDriveUrl(url.trim()));
    } else {
      setPreviewUrl(null);
    }
  };

  if (isReadOnly && images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <Image className="w-4 h-4" />
          Imagens de Atividades ({images.length})
        </Label>
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={url}
                    alt={`Atividade ${index + 1}`}
                    className="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </CardContent>
              </Card>
              {!isReadOnly && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isLoading}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma imagem adicionada</p>
          {!isReadOnly && (
            <p className="text-xs mt-1">Clique em "Adicionar" para vincular fotos do Google Drive</p>
          )}
        </div>
      )}

      {/* Add Image Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Adicionar Imagem do Google Drive
            </DialogTitle>
            <DialogDescription>
              Cole o link de compartilhamento da imagem do Google Drive
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Link do Google Drive</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="imageUrl"
                  value={newImageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Certifique-se de que o arquivo está compartilhado como "Qualquer pessoa com o link"
              </p>
            </div>

            {previewUrl && (
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="border rounded-lg p-2 bg-muted/30">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-foreground">Como compartilhar:</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>Abra a imagem no Google Drive</li>
                <li>Clique em "Compartilhar" → "Qualquer pessoa com o link"</li>
                <li>Copie o link e cole aqui</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddImage} disabled={isLoading || !newImageUrl.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
