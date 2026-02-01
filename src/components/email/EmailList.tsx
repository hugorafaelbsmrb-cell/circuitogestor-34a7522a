import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, MailOpen, Star, Inbox, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Email {
  id: string;
  message_id: string;
  from_address: string;
  to_addresses: string[];
  subject: string;
  body_text: string;
  body_html: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  folder: string;
  direction: 'inbound' | 'outbound';
}

interface EmailListProps {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  folder: string;
  onFolderChange: (folder: string) => void;
  isLoading: boolean;
}

const folders = [
  { id: 'INBOX', label: 'Caixa de Entrada', icon: Inbox },
  { id: 'SENT', label: 'Enviados', icon: Send },
];

export function EmailList({ 
  emails, 
  selectedId, 
  onSelect, 
  folder, 
  onFolderChange,
  isLoading 
}: EmailListProps) {
  const filteredEmails = emails.filter((e) => e.folder === folder);

  return (
    <div className="flex h-full">
      {/* Folder sidebar */}
      <div className="w-40 border-r border-border p-2 space-y-1">
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => onFolderChange(f.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              folder === f.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <f.icon className="h-4 w-4" />
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Email list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando emails...
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum email encontrado
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelect(email)}
                className={cn(
                  'w-full text-left p-4 hover:bg-muted/50 transition-colors',
                  selectedId === email.id && 'bg-muted',
                  !email.is_read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {email.is_read ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-sm truncate',
                        !email.is_read && 'font-semibold'
                      )}>
                        {email.direction === 'outbound' 
                          ? `Para: ${email.to_addresses[0]}` 
                          : email.from_address}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(email.received_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                    <p className={cn(
                      'text-sm truncate mt-1',
                      !email.is_read ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {email.subject || '(Sem assunto)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {email.body_text?.slice(0, 80) || '...'}
                    </p>
                  </div>
                  {email.is_starred && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
