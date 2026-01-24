import { useState, useMemo } from 'react';
import { 
  Send, 
  Users, 
  Filter,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useSchool } from '@/contexts/SchoolContext';
import { useWapiMessage } from '@/hooks/useWapiMessage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Recipient {
  id: string;
  name: string;
  phone: string;
  type: 'guardian';
  courseIds: string[];
}

type SendStatus = 'idle' | 'sending' | 'completed';

interface SendResult {
  recipientId: string;
  success: boolean;
  error?: string;
}

const SEND_DELAY_MS = 2500;

export default function BulkMessages() {
  const { guardians, students, courses, enrollments, classGroups } = useSchool();
  const { sendMessage, checkConfig } = useWapiMessage();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);

  // Build recipients list with course associations
  const recipients = useMemo(() => {
    const recipientMap = new Map<string, Recipient>();

    guardians.forEach(guardian => {
      const guardianStudents = students.filter(s => s.guardian_id === guardian.id);
      const courseIds = new Set<string>();

      guardianStudents.forEach(student => {
        const studentEnrollments = enrollments.filter(e => e.student_id === student.id && e.status === 'active');
        studentEnrollments.forEach(enrollment => {
          const classGroup = classGroups.find(cg => cg.id === enrollment.class_group_id);
          if (classGroup) {
            courseIds.add(classGroup.course_id);
          }
        });
      });

      recipientMap.set(guardian.id, {
        id: guardian.id,
        name: guardian.name,
        phone: guardian.phone,
        type: 'guardian',
        courseIds: Array.from(courseIds),
      });
    });

    return Array.from(recipientMap.values());
  }, [guardians, students, enrollments, classGroups]);

  // Filter recipients by selected course
  const filteredRecipients = useMemo(() => {
    if (selectedCourse === 'all') {
      return recipients;
    }
    return recipients.filter(r => r.courseIds.includes(selectedCourse));
  }, [recipients, selectedCourse]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecipients(new Set(filteredRecipients.map(r => r.id)));
    } else {
      setSelectedRecipients(new Set());
    }
  };

  const handleSelectRecipient = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRecipients);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRecipients(newSelected);
  };

  const getCourseNames = (courseIds: string[]) => {
    return courseIds
      .map(id => courses.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const logMessage = async (
    phone: string,
    guardianId: string,
    status: 'success' | 'error',
    errorMessage?: string
  ) => {
    try {
      await supabase.from('message_logs').insert({
        phone,
        guardian_id: guardianId,
        template_category: 'bulk_manual',
        message_preview: message.substring(0, 100),
        automation_key: 'bulk_messages_page',
        status,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Mensagem vazia',
        description: 'Digite uma mensagem para enviar.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRecipients.size === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Selecione pelo menos um responsável para enviar.',
        variant: 'destructive',
      });
      return;
    }

    const config = await checkConfig();
    if (!config.isConfigured) {
      toast({
        title: 'W-API não configurada',
        description: 'Configure a W-API em Configurações > WhatsApp antes de enviar.',
        variant: 'destructive',
      });
      return;
    }

    setSendStatus('sending');
    setSendProgress(0);
    setSendResults([]);

    const recipientsToSend = filteredRecipients.filter(r => selectedRecipients.has(r.id));
    const results: SendResult[] = [];

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      
      // Personalize message
      const personalizedMessage = message
        .replace(/{nome_responsavel}/g, recipient.name)
        .replace(/{nome}/g, recipient.name);

      const success = await sendMessage({
        phone: recipient.phone,
        message: personalizedMessage,
      });

      const result: SendResult = {
        recipientId: recipient.id,
        success,
        error: success ? undefined : 'Falha no envio',
      };

      results.push(result);
      setSendResults([...results]);
      
      await logMessage(
        recipient.phone,
        recipient.id,
        success ? 'success' : 'error',
        success ? undefined : 'Falha no envio'
      );

      const progress = ((i + 1) / recipientsToSend.length) * 100;
      setSendProgress(progress);

      // Rate limiting delay
      if (i < recipientsToSend.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    setSendStatus('completed');
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    toast({
      title: 'Envio concluído',
      description: `${successCount} mensagens enviadas com sucesso${errorCount > 0 ? `, ${errorCount} falharam` : ''}.`,
      variant: errorCount > 0 ? 'default' : 'default',
    });
  };

  const handleReset = () => {
    setSendStatus('idle');
    setSendProgress(0);
    setSendResults([]);
    setSelectedRecipients(new Set());
    setMessage('');
  };

  const allSelected = filteredRecipients.length > 0 && 
    filteredRecipients.every(r => selectedRecipients.has(r.id));
  const someSelected = filteredRecipients.some(r => selectedRecipients.has(r.id)) && !allSelected;

  const successCount = sendResults.filter(r => r.success).length;
  const errorCount = sendResults.filter(r => !r.success).length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Envio em Massa</h1>
        <p className="page-subtitle">Envie mensagens WhatsApp para múltiplos responsáveis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Compor Mensagem
            </CardTitle>
            <CardDescription>
              Use {'{nome_responsavel}'} para personalizar a mensagem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Olá {nome_responsavel}, escreva sua mensagem aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] resize-none"
                disabled={sendStatus === 'sending'}
              />
              <p className="text-xs text-muted-foreground">
                {message.length} caracteres
              </p>
            </div>

            {sendStatus === 'sending' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Enviando mensagens...</span>
                  <span>{Math.round(sendProgress)}%</span>
                </div>
                <Progress value={sendProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {sendResults.length} de {selectedRecipients.size} enviadas
                </p>
              </div>
            )}

            {sendStatus === 'completed' && (
              <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Envio concluído
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-primary">{successCount} enviadas</span>
                  {errorCount > 0 && (
                    <span className="text-destructive">{errorCount} falharam</span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Novo envio
                </Button>
              </div>
            )}

            {sendStatus === 'idle' && (
              <Button
                onClick={handleSend}
                disabled={selectedRecipients.size === 0 || !message.trim()}
                className="w-full gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar para {selectedRecipients.size} {selectedRecipients.size === 1 ? 'responsável' : 'responsáveis'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recipients Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Destinatários
            </CardTitle>
            <CardDescription>
              Filtre e selecione os responsáveis para enviar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter by Course */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtrar por Curso
              </Label>
              <Select 
                value={selectedCourse} 
                onValueChange={(value) => {
                  setSelectedCourse(value);
                  setSelectedRecipients(new Set());
                }}
                disabled={sendStatus === 'sending'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {courses.filter(c => c.is_active).map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select All */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  disabled={sendStatus === 'sending'}
                  className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Selecionar todos ({filteredRecipients.length})
                </Label>
              </div>
              <Badge variant="secondary">
                {selectedRecipients.size} selecionados
              </Badge>
            </div>

            {/* Recipients List */}
            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="p-2 space-y-1">
                {filteredRecipients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mb-2" />
                    <p className="text-sm">Nenhum responsável encontrado</p>
                  </div>
                ) : (
                  filteredRecipients.map(recipient => {
                    const result = sendResults.find(r => r.recipientId === recipient.id);
                    const isSelected = selectedRecipients.has(recipient.id);

                    return (
                      <div
                        key={recipient.id}
                        className={`flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors ${
                          result?.success ? 'bg-primary/10' : 
                          result?.success === false ? 'bg-destructive/10' : ''
                        }`}
                      >
                        <Checkbox
                          id={recipient.id}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRecipient(recipient.id, checked as boolean)}
                          disabled={sendStatus === 'sending'}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                        </div>
                        {recipient.courseIds.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <GraduationCap className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                              {getCourseNames(recipient.courseIds)}
                            </span>
                          </div>
                        )}
                        {result && (
                          result.success ? (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive shrink-0" />
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-secondary/30">
                <p className="text-lg font-bold">{filteredRecipients.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30">
                <p className="text-lg font-bold">{selectedRecipients.size}</p>
                <p className="text-xs text-muted-foreground">Selecionados</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30">
                <p className="text-lg font-bold">{courses.filter(c => c.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Cursos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
