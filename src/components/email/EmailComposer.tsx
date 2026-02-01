import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  mode?: 'new' | 'reply' | 'forward';
}

export function EmailComposer({
  open,
  onClose,
  onSent,
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  mode = 'new',
}: EmailComposerProps) {
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!to.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o destinatário',
        variant: 'destructive',
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o assunto',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('email-send', {
        body: {
          to: to.split(',').map((e) => e.trim()),
          cc: cc ? cc.split(',').map((e) => e.trim()) : undefined,
          subject,
          body,
          isHtml: false,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao enviar email');
      }

      toast({
        title: 'Email enviado',
        description: 'Seu email foi enviado com sucesso',
      });

      setTo('');
      setCc('');
      setSubject('');
      setBody('');
      onSent();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'reply':
        return 'Responder Email';
      case 'forward':
        return 'Encaminhar Email';
      default:
        return 'Novo Email';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="space-y-2">
            <Label htmlFor="to">Para</Label>
            <Input
              id="to"
              type="email"
              placeholder="email@exemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separe múltiplos destinatários com vírgula
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">Cc (opcional)</Label>
            <Input
              id="cc"
              type="email"
              placeholder="copia@exemplo.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              placeholder="Assunto do email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              placeholder="Digite sua mensagem..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[200px] resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
