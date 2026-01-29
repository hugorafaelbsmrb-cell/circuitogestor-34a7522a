import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useDropboxUpload } from '@/hooks/useDropboxUpload';
import { Image, Plus, X, Loader2, Link as LinkIcon, Upload, Cloud, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ReportImageManagerProps {
  reportId: string;
  images: string[];
  onImagesUpdate: (images: string[]) => void;
  isReadOnly?: boolean;
}

// Converts Google Drive share link to direct image URL
function convertGoogleDriveUrl(url: string): string {
  let fileId = '';
  
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
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  return url;
}

// Validates if URL is a valid link
function isValidUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.startsWith('http');
}

export default function ReportImageManager({ 
  reportId, 
  images, 
  onImagesUpdate,
  isReadOnly = false 
}: ReportImageManagerProps) {
  const { toast } = useToast();
  const { uploadFile, isUploading, uploadProgress, checkConfiguration, isConfigured } = useDropboxUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dropbox');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (isAddModalOpen) {
      checkConfiguration();
    }
  }, [isAddModalOpen]);

  const handleAddImageUrl = async () => {
    if (!newImageUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe o link da imagem',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidUrl(newImageUrl)) {
      toast({
        title: 'URL inválida',
        description: 'Informe um link válido',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const directUrl = newImageUrl.includes('drive.google.com') 
        ? convertGoogleDriveUrl(newImageUrl.trim())
        : newImageUrl.trim();
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: 'Arquivos inválidos',
        description: 'Apenas imagens são permitidas',
        variant: 'destructive',
      });
    }

    // Limit file size to 10MB
    const validFiles = imageFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: `${file.name} excede o limite de 10MB`,
          variant: 'destructive',
        });
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDropboxUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Selecione ao menos uma imagem para enviar',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedFiles) {
        const result = await uploadFile(file, '/relatorios');
        if (result.success && result.file?.url) {
          uploadedUrls.push(result.file.url);
        }
      }

      if (uploadedUrls.length > 0) {
        const updatedImages = [...images, ...uploadedUrls];

        const { error } = await supabase
          .from('student_reports')
          .update({ images: updatedImages })
          .eq('id', reportId);

        if (error) throw error;

        onImagesUpdate(updatedImages);
        setSelectedFiles([]);
        setIsAddModalOpen(false);

        toast({
          title: 'Upload concluído',
          description: `${uploadedUrls.length} imagem(s) adicionada(s) ao relatório`,
        });
      }
    } catch (error) {
      console.error('Error uploading to Dropbox:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível completar o upload',
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
    if (url.trim()) {
      const converted = url.includes('drive.google.com') 
        ? convertGoogleDriveUrl(url.trim())
        : url.trim();
      setPreviewUrl(converted);
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
            <p className="text-xs mt-1">Clique em "Adicionar" para vincular fotos</p>
          )}
        </div>
      )}

      {/* Add Image Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Adicionar Imagem
            </DialogTitle>
            <DialogDescription>
              Faça upload de imagens pelo Dropbox ou cole um link externo
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dropbox" className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Dropbox
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link Externo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dropbox" className="space-y-4 mt-4">
              {isConfigured === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Dropbox não configurado</p>
                    <p className="text-amber-700">
                      Configure o token do Dropbox em Configurações → APIs para habilitar o upload.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isConfigured === false || isUploading}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para selecionar imagens
                    </span>
                  </div>
                </Button>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>Arquivos selecionados ({selectedFiles.length})</Label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between bg-muted/50 rounded px-2 py-1"
                        >
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeSelectedFile(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-2">
                    <Label>Enviando...</Label>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleDropboxUpload} 
                  disabled={isLoading || isUploading || selectedFiles.length === 0 || isConfigured === false}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Enviar ({selectedFiles.length})
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="link" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Link da Imagem</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="imageUrl"
                    value={newImageUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://..."
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole o link direto da imagem ou link do Google Drive
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

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddImageUrl} disabled={isLoading || !newImageUrl.trim()}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Adicionar
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
