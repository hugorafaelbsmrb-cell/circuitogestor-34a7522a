import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  Users, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledMessage {
  id: string;
  message: string;
  scheduled_at: string;
  status: string;
  recipient_ids: string[];
  course_filter: string | null;
  sent_count: number | null;
  error_count: number | null;
  processed_at: string | null;
  created_at: string;
}

export function ScheduledMessagesTab() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchScheduledMessages();
  }, []);

  const fetchScheduledMessages = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('scheduled_bulk_messages')
      .select('*')
      .order('scheduled_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    const { error } = await supabase
      .from('scheduled_bulk_messages')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Agendamento cancelado',
        description: 'A mensagem agendada foi removida.',
      });
      fetchScheduledMessages();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingMessages = messages.filter(m => m.status === 'pending' || m.status === 'processing');
  const completedMessages = messages.filter(m => m.status === 'completed' || m.status === 'failed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Messages */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Agendamentos Pendentes ({pendingMessages.length})
        </h3>
        
        {pendingMessages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum agendamento pendente</p>
              <p className="text-sm">Use o botão "Envio em Massa" para agendar mensagens</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingMessages.map((msg) => (
              <Card key={msg.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(msg.status)}
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {msg.recipient_ids.length} destinatários
                        </span>
                      </div>
                      <p className="text-sm mb-2 line-clamp-2">{msg.message}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    {msg.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(msg.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Messages */}
      {completedMessages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Histórico ({completedMessages.length})
          </h3>
          
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {completedMessages.map((msg) => (
                <Card key={msg.id} className="border-border/50 opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(msg.status)}
                          {msg.sent_count !== null && (
                            <span className="text-sm text-muted-foreground">
                              {msg.sent_count} enviados
                              {msg.error_count ? `, ${msg.error_count} erros` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-2 line-clamp-1">{msg.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Agendado: {format(new Date(msg.scheduled_at), "dd/MM HH:mm")}</span>
                          {msg.processed_at && (
                            <span>Processado: {format(new Date(msg.processed_at), "dd/MM HH:mm")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
