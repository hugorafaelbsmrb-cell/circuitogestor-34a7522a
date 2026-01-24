import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Save, 
  Loader2,
  Plus,
  Trash2,
  Edit,
  Eye,
  Copy,
  Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

const categoryOptions = [
  { value: 'lead', label: 'Lead - Primeiro Contato' },
  { value: 'lead_followup', label: 'Lead - Acompanhamento' },
  { value: 'lead_scheduled', label: 'Lead - Agendamento' },
  { value: 'lead_reactivation', label: 'Lead - Reativação' },
  { value: 'enrollment', label: 'Matrícula' },
  { value: 'payment_reminder', label: 'Lembrete de Pagamento' },
  { value: 'payment_due_48h', label: 'Pagamento Vence em 48h' },
  { value: 'payment_overdue', label: 'Pagamento Atrasado' },
  { value: 'payment_confirmed', label: 'Pagamento Confirmado' },
  { value: 'birthday', label: 'Aniversário' },
  { value: 'lms_alert', label: 'Alerta Pedagógico LMS' },
  { value: 'general', label: 'Geral' },
];

const availableVariables = [
  { key: '{nome_responsavel}', description: 'Nome do responsável' },
  { key: '{nome_aluno}', description: 'Nome do aluno' },
  { key: '{nome_curso}', description: 'Nome do curso' },
  { key: '{valor}', description: 'Valor do pagamento' },
  { key: '{vencimento}', description: 'Data de vencimento' },
  { key: '{nome_escola}', description: 'Nome da escola' },
  { key: '{parcela}', description: 'Número da parcela' },
  { key: '{link_boleto}', description: 'Link do boleto em atraso (automático)' },
  { key: '{link_boleto_48h}', description: 'Link do boleto que vence em 48h' },
  { key: '{valor_48h}', description: 'Valor do boleto que vence em 48h' },
  { key: '{vencimento_48h}', description: 'Data de vencimento do boleto em 48h' },
];

export default function WhatsAppConfig() {
  const { toast } = useToast();
  const { profile } = useAuthContext();
  
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    category: 'general',
    message: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    
    // Get templates from app_settings with whatsapp_template prefix
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .like('key', 'whatsapp_template_%')
      .order('key');
    
    if (error) {
      toast({
        title: 'Erro ao carregar templates',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Parse templates from app_settings
      const parsedTemplates: WhatsAppTemplate[] = (data || []).map(setting => {
        try {
          const parsed = JSON.parse(setting.value || '{}');
          return {
            id: setting.id,
            name: parsed.name || setting.key.replace('whatsapp_template_', ''),
            category: parsed.category || 'general',
            message: parsed.message || '',
            is_active: parsed.is_active !== false,
          };
        } catch {
          return {
            id: setting.id,
            name: setting.key.replace('whatsapp_template_', ''),
            category: 'general',
            message: setting.value || '',
            is_active: true,
          };
        }
      });
      setTemplates(parsedTemplates);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.message) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e mensagem são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const templateData = JSON.stringify({
      name: form.name,
      category: form.category,
      message: form.message,
      is_active: form.is_active,
    });

    const key = `whatsapp_template_${form.name.toLowerCase().replace(/\s+/g, '_')}`;

    if (editingTemplate) {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: templateData,
          description: `Template WhatsApp: ${form.name}`,
        })
        .eq('id', editingTemplate.id);

      if (error) {
        toast({
          title: 'Erro ao atualizar template',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Template atualizado',
          description: 'O template foi atualizado com sucesso.',
        });
        fetchTemplates();
        handleCloseModal();
      }
    } else {
      const { error } = await supabase
        .from('app_settings')
        .insert({
          key,
          value: templateData,
          description: `Template WhatsApp: ${form.name}`,
          is_secret: false,
        });

      if (error) {
        if (error.message.includes('duplicate key')) {
          toast({
            title: 'Template já existe',
            description: 'Um template com este nome já existe.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao criar template',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Template criado',
          description: 'O template foi adicionado com sucesso.',
        });
        fetchTemplates();
        handleCloseModal();
      }
    }

    setIsSubmitting(false);
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      category: template.category,
      message: template.message,
      is_active: template.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (template: WhatsAppTemplate) => {
    if (!confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) return;

    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('id', template.id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Template excluído',
        description: 'O template foi removido.',
      });
      fetchTemplates();
    }
  };

  const handleToggleActive = async (template: WhatsAppTemplate) => {
    const templateData = JSON.stringify({
      name: template.name,
      category: template.category,
      message: template.message,
      is_active: !template.is_active,
    });

    const { error } = await supabase
      .from('app_settings')
      .update({ value: templateData })
      .eq('id', template.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchTemplates();
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setForm({
      name: '',
      category: 'general',
      message: '',
      is_active: true,
    });
  };

  const handlePreview = (message: string) => {
    // Replace variables with sample data
    let preview = message
      .replace(/{nome_responsavel}/g, 'João Silva')
      .replace(/{nome_aluno}/g, 'Maria Silva')
      .replace(/{nome_curso}/g, 'Inglês Kids')
      .replace(/{valor}/g, 'R$ 299,00')
      .replace(/{vencimento}/g, '15/02/2026')
      .replace(/{nome_escola}/g, 'EduGestor')
      .replace(/{parcela}/g, '3/12');
    
    setPreviewMessage(preview);
    setShowPreviewModal(true);
  };

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast({
      title: 'Variável copiada',
      description: `${variable} copiada para a área de transferência.`,
    });
  };

  const insertVariable = (variable: string) => {
    setForm(prev => ({
      ...prev,
      message: prev.message + variable,
    }));
  };

  const getCategoryLabel = (category: string) => {
    return categoryOptions.find(c => c.value === category)?.label || category;
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Acesso Negado</h1>
          <p className="page-subtitle">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações do WhatsApp</h1>
          <p className="page-subtitle">Gerencie templates de mensagens para envio via WhatsApp Web</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-border/50 mb-6 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Como funciona?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Os templates criados aqui serão usados para enviar mensagens via WhatsApp Web. 
                Ao clicar no botão de WhatsApp em leads ou responsáveis, a mensagem do template será 
                automaticamente preenchida. Use as variáveis disponíveis para personalizar as mensagens.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables Reference */}
      <Card className="border-border/50 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variáveis Disponíveis</CardTitle>
          <CardDescription>
            Use estas variáveis nas suas mensagens para personalização automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <Button
                key={variable.key}
                variant="outline"
                size="sm"
                className="gap-1 font-mono text-xs"
                onClick={() => handleCopyVariable(variable.key)}
                title={variable.description}
              >
                {variable.key}
                <Copy className="w-3 h-3" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length > 0 ? (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{template.name}</h3>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {template.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => handleToggleActive(template)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(template.message)}
                      title="Pré-visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum template cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie templates de mensagens para facilitar o envio via WhatsApp
            </p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template de WhatsApp'}
            </DialogTitle>
            <DialogDescription>
              Crie uma mensagem personalizada para enviar via WhatsApp Web
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Boas-vindas Lead"
                  disabled={!!editingTemplate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Mensagem *</Label>
                <div className="flex gap-1">
                  {availableVariables.slice(0, 4).map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs font-mono"
                      onClick={() => insertVariable(variable.key)}
                      title={variable.description}
                    >
                      {variable.key}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Olá {nome_responsavel}, tudo bem? Aqui é da {nome_escola}..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Use as variáveis para personalizar a mensagem automaticamente
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label className="font-medium">Template Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Templates inativos não aparecerão nas opções de envio
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => handlePreview(form.message)}>
                <Eye className="w-4 h-4 mr-2" />
                Pré-visualizar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingTemplate ? 'Atualizar' : 'Criar Template'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização da Mensagem</DialogTitle>
            <DialogDescription>
              Assim ficará a mensagem com dados de exemplo
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
