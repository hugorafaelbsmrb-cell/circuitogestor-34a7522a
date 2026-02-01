import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Reply, Forward, Star, Trash2, MailOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface Email {
  id: string;
  message_id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  subject: string;
  body_text: string;
  body_html: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  folder: string;
  direction: 'inbound' | 'outbound';
}

interface EmailViewerProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onForward: (email: Email) => void;
  onToggleStar: (email: Email) => void;
  onMarkAsRead: (email: Email) => void;
}

export function EmailViewer({ 
  email, 
  onReply, 
  onForward, 
  onToggleStar,
  onMarkAsRead 
}: EmailViewerProps) {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Selecione um email para visualizar
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {email.subject || '(Sem assunto)'}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {email.direction === 'outbound' ? 'Para:' : 'De:'}
              </span>
              <span>
                {email.direction === 'outbound' 
                  ? email.to_addresses.join(', ')
                  : email.from_address}
              </span>
            </div>
            {email.direction === 'inbound' && email.to_addresses.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Para:</span>
                <span>{email.to_addresses.join(', ')}</span>
              </div>
            )}
            {email.cc_addresses && email.cc_addresses.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Cc:</span>
                <span>{email.cc_addresses.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">
                {format(new Date(email.received_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              <Badge variant={email.direction === 'outbound' ? 'secondary' : 'outline'} className="text-xs">
                {email.direction === 'outbound' ? 'Enviado' : 'Recebido'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onReply(email)}
            disabled={email.direction === 'outbound'}
          >
            <Reply className="h-4 w-4 mr-2" />
            Responder
          </Button>
          <Button variant="outline" size="sm" onClick={() => onForward(email)}>
            <Forward className="h-4 w-4 mr-2" />
            Encaminhar
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onToggleStar(email)}
          >
            <Star className={email.is_starred ? "h-4 w-4 text-yellow-500 fill-yellow-500" : "h-4 w-4"} />
          </Button>
          {!email.is_read && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onMarkAsRead(email)}
            >
              <MailOpen className="h-4 w-4 mr-2" />
              Marcar como lido
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Body */}
      <ScrollArea className="flex-1 p-4">
        {email.body_html ? (
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans">
            {email.body_text || 'Sem conteúdo'}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}
