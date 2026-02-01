import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EmailList, EmailViewer, EmailComposer } from '@/components/email';
import { Link } from 'react-router-dom';

interface Email {
  id: string;
  message_id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  body_html: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  folder: string;
  direction: 'inbound' | 'outbound';
}

export default function EmailClient() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [currentFolder, setCurrentFolder] = useState('INBOX');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [composerInitial, setComposerInitial] = useState({ to: '', subject: '', body: '' });
  const { toast } = useToast();

  const loadEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      setEmails((data as Email[]) || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar emails',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const syncEmails = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-fetch', {
        body: { folder: currentFolder, limit: 50 },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao sincronizar');
      }

      toast({
        title: 'Emails sincronizados',
        description: `${data.count} emails atualizados`,
      });

      await loadEmails();
    } catch (error: any) {
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);

    // Mark as read if not already
    if (!email.is_read) {
      const { error } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('id', email.id);

      if (!error) {
        setEmails((prev) =>
          prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
        );
      }
    }
  };

  const handleReply = (email: Email) => {
    setComposerMode('reply');
    setComposerInitial({
      to: email.from_address,
      subject: `Re: ${email.subject}`,
      body: `\n\n--- Mensagem Original ---\nDe: ${email.from_address}\nData: ${email.received_at}\n\n${email.body_text}`,
    });
    setComposerOpen(true);
  };

  const handleForward = (email: Email) => {
    setComposerMode('forward');
    setComposerInitial({
      to: '',
      subject: `Fwd: ${email.subject}`,
      body: `\n\n--- Mensagem Encaminhada ---\nDe: ${email.from_address}\nData: ${email.received_at}\nAssunto: ${email.subject}\n\n${email.body_text}`,
    });
    setComposerOpen(true);
  };

  const handleToggleStar = async (email: Email) => {
    const { error } = await supabase
      .from('email_messages')
      .update({ is_starred: !email.is_starred })
      .eq('id', email.id);

    if (!error) {
      const updated = { ...email, is_starred: !email.is_starred };
      setEmails((prev) => prev.map((e) => (e.id === email.id ? updated : e)));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(updated);
      }
    }
  };

  const handleMarkAsRead = async (email: Email) => {
    const { error } = await supabase
      .from('email_messages')
      .update({ is_read: true })
      .eq('id', email.id);

    if (!error) {
      const updated = { ...email, is_read: true };
      setEmails((prev) => prev.map((e) => (e.id === email.id ? updated : e)));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(updated);
      }
    }
  };

  const handleNewEmail = () => {
    setComposerMode('new');
    setComposerInitial({ to: '', subject: '', body: '' });
    setComposerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-mail</h1>
          <p className="text-muted-foreground">Gerencie sua caixa de entrada</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/configuracoes">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={syncEmails}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Sincronizar</span>
          </Button>
          <Button size="sm" onClick={handleNewEmail}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Email
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Card className="h-[calc(100vh-12rem)] overflow-hidden">
        <div className="flex h-full">
          {/* Email list */}
          <div className="w-1/3 border-r border-border">
            <EmailList
              emails={emails}
              selectedId={selectedEmail?.id || null}
              onSelect={handleSelectEmail}
              folder={currentFolder}
              onFolderChange={setCurrentFolder}
              isLoading={isLoading}
            />
          </div>

          {/* Email viewer */}
          <div className="flex-1">
            <EmailViewer
              email={selectedEmail}
              onReply={handleReply}
              onForward={handleForward}
              onToggleStar={handleToggleStar}
              onMarkAsRead={handleMarkAsRead}
            />
          </div>
        </div>
      </Card>

      {/* Composer modal */}
      <EmailComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={loadEmails}
        initialTo={composerInitial.to}
        initialSubject={composerInitial.subject}
        initialBody={composerInitial.body}
        mode={composerMode}
      />
    </div>
  );
}
