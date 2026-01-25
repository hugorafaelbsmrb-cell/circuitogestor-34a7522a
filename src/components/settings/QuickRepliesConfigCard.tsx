import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Loader2, Save, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuickReply {
  id: string;
  label: string;
  message: string;
  sort_order: number;
  is_active: boolean;
}

export function QuickRepliesConfigCard() {
  const { toast } = useToast();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', message: '' });

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as respostas rápidas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    setIsSaving(true);
    try {
      const maxOrder = replies.length > 0 ? Math.max(...replies.map(r => r.sort_order)) : 0;
      
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .insert({
          label: 'Nova Resposta',
          message: 'Digite a mensagem aqui...',
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      
      setReplies([...replies, data]);
      setEditingId(data.id);
      setEditForm({ label: data.label, message: data.message });
      
      toast({
        title: 'Resposta adicionada',
        description: 'Edite o conteúdo da nova resposta rápida.',
      });
    } catch (error) {
      console.error('Error adding quick reply:', error);
      toast({
        title: 'Erro ao adicionar',
        description: 'Não foi possível adicionar a resposta rápida.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (id: string) => {
    if (!editForm.label.trim() || !editForm.message.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o rótulo e a mensagem.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quick_reply_templates')
        .update({
          label: editForm.label.trim(),
          message: editForm.message.trim(),
        })
        .eq('id', id);

      if (error) throw error;
      
      setReplies(replies.map(r => 
        r.id === id ? { ...r, label: editForm.label.trim(), message: editForm.message.trim() } : r
      ));
      setEditingId(null);
      
      toast({
        title: 'Salvo',
        description: 'Resposta rápida atualizada com sucesso.',
      });
    } catch (error) {
      console.error('Error saving quick reply:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a resposta rápida.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('quick_reply_templates')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setReplies(replies.map(r => 
        r.id === id ? { ...r, is_active: isActive } : r
      ));
    } catch (error) {
      console.error('Error toggling quick reply:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta resposta rápida?')) return;

    try {
      const { error } = await supabase
        .from('quick_reply_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setReplies(replies.filter(r => r.id !== id));
      
      toast({
        title: 'Excluído',
        description: 'Resposta rápida removida com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting quick reply:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a resposta rápida.',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (reply: QuickReply) => {
    setEditingId(reply.id);
    setEditForm({ label: reply.label, message: reply.message });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Respostas Rápidas
        </CardTitle>
        <CardDescription>
          Configure atalhos de mensagens para usar nas conversas do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {replies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma resposta rápida configurada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className="border rounded-lg p-3 space-y-2"
              >
                {editingId === reply.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Rótulo do botão</Label>
                      <Input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        placeholder="Ex: Saudação"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea
                        value={editForm.message}
                        onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                        placeholder="Digite a mensagem completa..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(reply.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => startEditing(reply)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{reply.label}</span>
                        {!reply.is_active && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativo</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {reply.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={reply.is_active}
                        onCheckedChange={(checked) => handleToggle(reply.id, checked)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(reply.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          onClick={handleAdd}
          disabled={isSaving}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Resposta Rápida
        </Button>
      </CardContent>
    </Card>
  );
}
