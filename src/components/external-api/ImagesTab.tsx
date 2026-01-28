import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useExternalApi, ImageFile } from '@/hooks/useExternalApi';
import { Upload, Trash2, RefreshCw, Loader2, Image, FolderOpen, Copy, ExternalLink } from 'lucide-react';

const COMMON_FOLDERS = ['products', 'categories', 'banners', 'gallery', 'general'];

export function ImagesTab() {
  const { toast } = useToast();
  const api = useExternalApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [uploadFolder, setUploadFolder] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    const result = await api.getImages(currentFolder || undefined);
    if (result.data) setImages(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentFolder]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !previewUrl) {
      toast({ title: 'Erro', description: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await api.uploadImage(
      selectedFile.name,
      previewUrl,
      selectedFile.type,
      uploadFolder || undefined
    );

    if (result.data) {
      toast({ 
        title: 'Sucesso', 
        description: 'Imagem enviada com sucesso',
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl('');
      setUploadFolder('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData();
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedImage) return;
    
    setIsLoading(true);
    const result = await api.deleteImage(selectedImage.name);
    
    if (!result.error) {
      toast({ title: 'Sucesso', description: 'Imagem excluída' });
      setDeleteDialogOpen(false);
      setSelectedImage(null);
      loadData();
    }
    setIsLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'URL copiada para a área de transferência' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Galeria de Imagens
            </CardTitle>
            <CardDescription>Gerencie as imagens do site</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={currentFolder || "all"} onValueChange={(val) => setCurrentFolder(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[150px]">
                <FolderOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todas pastas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as pastas</SelectItem>
                {COMMON_FOLDERS.map((folder) => (
                  <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && images.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mb-4" />
            <p>Nenhuma imagem encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((image) => (
              <div 
                key={image.name}
                className="group relative aspect-square rounded-lg border bg-muted/30 overflow-hidden"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground" />
                </div>
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <p className="text-white text-xs text-center truncate w-full">{image.name}</p>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(image.name)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => { setSelectedImage(image); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Imagem</DialogTitle>
            <DialogDescription>
              Selecione uma imagem para fazer upload
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder">Pasta (opcional)</Label>
              <Select value={uploadFolder || "root"} onValueChange={(val) => setUploadFolder(val === "root" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Raiz</SelectItem>
                  {COMMON_FOLDERS.map((folder) => (
                    <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Imagem</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>

            {previewUrl && (
              <div className="border rounded-lg p-2">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-48 mx-auto rounded"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false);
              setSelectedFile(null);
              setPreviewUrl('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={isLoading || !selectedFile}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a imagem "{selectedImage?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
