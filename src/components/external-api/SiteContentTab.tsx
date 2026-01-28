import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useExternalApi, SiteContent } from '@/hooks/useExternalApi';
import { Plus, Pencil, Trash2, RefreshCw, Loader2, FileText } from 'lucide-react';

const COMMON_SECTIONS = [
  { key: 'hero', label: 'Seção Hero' },
  { key: 'about', label: 'Sobre Nós' },
  { key: 'contact', label: 'Contato' },
  { key: 'branding', label: 'Marca/Logo' },
  { key: 'programs', label: 'Programas' },
];

export function SiteContentTab() {
  const { toast } = useToast();
  const api = useExternalApi();
  const [contents, setContents] = useState<SiteContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<SiteContent | null>(null);
  const [formData, setFormData] = useState<{
    section_key: string;
    content: Record<string, string>;
  }>({
    section_key: '',
    content: {},
  });
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    const result = await api.getSiteContent();
    if (result.data) setContents(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (content?: SiteContent) => {
    if (content) {
      setSelectedContent(content);
      setFormData({
        section_key: content.section_key,
        content: content.content as Record<string, string>,
      });
    } else {
      setSelectedContent(null);
      setFormData({
        section_key: '',
        content: {},
      });
    }
    setDialogOpen(true);
  };

  const handleAddField = () => {
    if (!newFieldKey.trim()) return;
    
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        [newFieldKey]: newFieldValue,
      },
    });
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleRemoveField = (key: string) => {
    const newContent = { ...formData.content };
    delete newContent[key];
    setFormData({ ...formData, content: newContent });
  };

  const handleUpdateField = (key: string, value: string) => {
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        [key]: value,
      },
    });
  };

  const handleSave = async () => {
    if (!formData.section_key) {
      toast({ title: 'Erro', description: 'Chave da seção é obrigatória', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    let result;
    
    if (selectedContent) {
      result = await api.updateSiteContent(formData.section_key, formData.content);
    } else {
      result = await api.createSiteContent({
        section_key: formData.section_key,
        content: formData.content,
      });
    }

    if (result.data) {
      toast({ title: 'Sucesso', description: selectedContent ? 'Conteúdo atualizado' : 'Conteúdo criado' });
      setDialogOpen(false);
      loadData();
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedContent) return;
    
    setIsLoading(true);
    const result = await api.deleteSiteContent(selectedContent.section_key);
    
    if (!result.error) {
      toast({ title: 'Sucesso', description: 'Conteúdo excluído' });
      setDeleteDialogOpen(false);
      setSelectedContent(null);
      loadData();
    }
    setIsLoading(false);
  };

  const getSectionLabel = (key: string) => {
    return COMMON_SECTIONS.find(s => s.key === key)?.label || key;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conteúdo do Site
            </CardTitle>
            <CardDescription>Gerencie textos e informações das seções do site</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Seção
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && contents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : contents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            <p>Nenhum conteúdo encontrado</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {contents.map((content) => (
              <AccordionItem key={content.id} value={content.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{getSectionLabel(content.section_key)}</span>
                    <span className="text-sm text-muted-foreground font-mono">({content.section_key})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      {Object.entries(content.content as Record<string, unknown>).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 gap-2">
                          <span className="font-mono text-sm text-muted-foreground">{key}:</span>
                          <span className="col-span-2 text-sm">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(content)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSelectedContent(content); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContent ? 'Editar Seção' : 'Nova Seção'}</DialogTitle>
            <DialogDescription>
              {selectedContent ? 'Atualize o conteúdo da seção' : 'Crie uma nova seção de conteúdo'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section_key">Chave da Seção *</Label>
              <Input
                id="section_key"
                value={formData.section_key}
                onChange={(e) => setFormData({ ...formData, section_key: e.target.value })}
                disabled={!!selectedContent}
                placeholder="ex: hero, about, contact"
              />
              {!selectedContent && (
                <div className="flex flex-wrap gap-1">
                  {COMMON_SECTIONS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, section_key: key })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Campos do Conteúdo</Label>
              <div className="space-y-2">
                {Object.entries(formData.content).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input value={key} disabled className="w-1/3" />
                    <Textarea
                      value={value}
                      onChange={(e) => handleUpdateField(key, e.target.value)}
                      className="flex-1"
                      rows={2}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveField(key)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <Label>Adicionar Campo</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Chave (ex: title)"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-1/3"
                />
                <Input
                  placeholder="Valor"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddField}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
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
              Tem certeza que deseja excluir a seção "{selectedContent?.section_key}"? Esta ação não pode ser desfeita.
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
