import { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Copy, 
  User,
  BookOpen,
  Trophy,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Unlock,
  RotateCcw,
  Settings,
  Coins,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

interface LMSProgressData {
  status?: string;
  current_module?: string;
  current_level?: string;
  current_lesson?: string;
  completion_percentage?: number;
  total_lessons?: number;
  completed_lessons?: number;
  total_xp?: number;
  coins?: number;
}

interface LMSCredential {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  email: string;
  password: string;
  matricula: string;
  lms_user_id: string | null;
  current_module: string | null;
  current_level: string | null;
  current_lesson: string | null;
  completion_percentage: number;
  last_sync_at: string | null;
  created_at: string;
  progressData?: LMSProgressData;
  student: {
    id: string;
    name: string;
    birth_date: string;
    is_active: boolean;
  } | null;
  enrollment: {
    id: string;
    status: string;
    class_group_id: string;
    enrollment_date: string;
    class_group?: {
      schedule?: {
        day_of_week: string;
      };
    };
  } | null;
  // All class days from all enrollments for this student
  all_class_days?: string[];
  earliest_enrollment_date?: string;
}

export default function LMSStudents() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<LMSCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredential, setSelectedCredential] = useState<LMSCredential | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<LMSCredential | null>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'getCredentials' }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setCredentials(data.data);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do LMS.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncAll = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'syncAll' }
      });

      if (error) throw error;

      toast({
        title: 'Sincronização concluída',
        description: data?.message || 'Dados sincronizados com sucesso.',
      });

      await fetchCredentials();
    } catch (error) {
      console.error('Error syncing:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar com o LMS.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSingle = async (credentialId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'syncProgress', credentialId }
      });

      if (error) throw error;

      // Update the selected credential with new progress data
      if (selectedCredential && data?.data) {
        setSelectedCredential({
          ...selectedCredential,
          progressData: data.data,
          current_module: data.data.current_module,
          current_level: data.data.current_level,
          current_lesson: data.data.current_lesson,
          completion_percentage: data.data.completion_percentage,
        });
      }

      toast({
        title: 'Dados atualizados',
        description: data?.message || 'Progresso atualizado com sucesso.',
      });

      await fetchCredentials();
    } catch (error) {
      console.error('Error syncing single:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o progresso.',
        variant: 'destructive',
      });
    }
  };

  // LMS Management Actions
  const executeLMSAction = async (
    actionName: string, 
    credential: LMSCredential, 
    extraParams: Record<string, string> = {}
  ) => {
    const lmsUserId = credential.lms_user_id || credential.matricula;
    setActionLoading(actionName);
    
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: actionName, lmsUserId, ...extraParams }
      });

      if (error) throw error;

      toast({
        title: data?.success ? 'Ação executada' : 'Erro na ação',
        description: data?.message || 'Operação concluída.',
        variant: data?.success ? 'default' : 'destructive',
      });

      if (data?.success) {
        await syncSingle(credential.id);
      }
    } catch (error) {
      console.error(`Error executing ${actionName}:`, error);
      toast({
        title: 'Erro',
        description: `Não foi possível executar a ação: ${actionName}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockLevel = (credential: LMSCredential, levelId: string) => {
    executeLMSAction('unlockLevel', credential, { levelId });
  };

  const handleSetModule = (credential: LMSCredential, moduleId: string) => {
    executeLMSAction('setModule', credential, { moduleId });
  };

  const handleSetLevel = (credential: LMSCredential, levelId: string) => {
    executeLMSAction('setLevel', credential, { levelId });
  };

  const handleResetProgress = (credential: LMSCredential) => {
    setConfirmReset(credential);
  };

  const confirmResetProgress = async () => {
    if (!confirmReset) return;
    await executeLMSAction('resetProgress', confirmReset);
    setConfirmReset(null);
  };

  const generatePedagogicalReport = async (credential: LMSCredential) => {
    setReportLoading(credential.id);
    
    try {
      // Build the query parameter
      const queryParam = credential.lms_user_id 
        ? `student_user_id=${encodeURIComponent(credential.lms_user_id)}`
        : `matricula=${encodeURIComponent(credential.matricula)}`;
      
      // Call external LMS API with pdf_data format
      const LMS_API_BASE = 'https://icbudgpjptemjfymssvr.supabase.co/functions/v1';
      const response = await fetch(`${LMS_API_BASE}/get-parent-report?${queryParam}&format=pdf_data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'educacionalcircuuiToKIdsLTDA',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar relatório: ${response.status}`);
      }

      const data = await response.json();
      
      if (data?.error) {
        throw new Error(data.error);
      }

      // Generate PDF from the data
      const doc = new jsPDF();
      const studentName = data.student?.full_name || credential.student?.name || 'Aluno';
      const nickname = data.student?.nickname || '';
      const currentLevel = data.student?.current_level || 1;
      const totalXp = data.student?.total_xp || 0;
      const reports = data.reports || [];
      
      // Header
      doc.setFillColor(245, 130, 32); // Orange color
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Pedagógico', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Circuito Kids - Robótica Educacional', 105, 30, { align: 'center' });
      
      // Student Info
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados do Aluno', 20, 55);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      let yPos = 65;
      
      doc.text(`Nome: ${studentName}`, 20, yPos);
      yPos += 8;
      if (nickname) {
        doc.text(`Apelido: ${nickname}`, 20, yPos);
        yPos += 8;
      }
      doc.text(`Nível Atual: ${currentLevel}`, 20, yPos);
      yPos += 8;
      doc.text(`XP Total: ${totalXp}`, 20, yPos);
      yPos += 8;
      doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
      
      // Reports Section
      yPos += 20;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatórios de Aula', 20, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      if (reports.length === 0) {
        doc.setTextColor(128, 128, 128);
        doc.text('Nenhum relatório de aula disponível ainda.', 20, yPos);
        doc.text('Os relatórios serão adicionados conforme o aluno avança nas aulas.', 20, yPos + 6);
      } else {
        reports.forEach((report: { date?: string; title?: string; content?: string; lesson_title?: string; bncc_codes?: string[] }, index: number) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setTextColor(245, 130, 32);
          doc.setFont('helvetica', 'bold');
          doc.text(`${index + 1}. ${report.lesson_title || report.title || 'Aula'}`, 20, yPos);
          yPos += 6;
          
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          if (report.date) {
            doc.text(`Data: ${report.date}`, 25, yPos);
            yPos += 5;
          }
          if (report.content) {
            const lines = doc.splitTextToSize(report.content, 165);
            doc.text(lines, 25, yPos);
            yPos += lines.length * 5;
          }
          if (report.bncc_codes && report.bncc_codes.length > 0) {
            doc.setTextColor(80, 80, 80);
            doc.text(`BNCC: ${report.bncc_codes.join(', ')}`, 25, yPos);
            yPos += 5;
          }
          yPos += 8;
        });
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      }
      
      // Open PDF in new tab
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      
      toast({
        title: 'Relatório gerado!',
        description: 'O relatório pedagógico foi aberto em uma nova aba.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Não foi possível gerar o relatório pedagógico.',
        variant: 'destructive',
      });
    } finally {
      setReportLoading(null);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const filteredCredentials = credentials.filter(cred => 
    cred.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Map day names in Portuguese to JavaScript day numbers (0 = Sunday, 1 = Monday, etc.)
  const dayNameToNumber: Record<string, number> = {
    'Domingo': 0,
    'Segunda-feira': 1,
    'Terça-feira': 2,
    'Quarta-feira': 3,
    'Quinta-feira': 4,
    'Sexta-feira': 5,
    'Sábado': 6,
  };

  // Calculate expected lesson based on enrollment date and ALL class days of the week
  const calculateExpectedLesson = (enrollmentDate: string | undefined, classDays: string[] | undefined): number => {
    if (!enrollmentDate || !classDays || classDays.length === 0) return 0;
    
    const startDate = new Date(enrollmentDate);
    const today = new Date();
    
    // Convert day names to day numbers
    const targetDayNumbers = classDays
      .map(day => dayNameToNumber[day])
      .filter(num => num !== undefined);
    
    if (targetDayNumbers.length === 0) return 0;
    
    // Count all occurrences of any target day from enrollment to today
    let lessonCount = 0;
    const currentDate = new Date(startDate);
    
    // Iterate through each day from enrollment to today
    while (currentDate <= today) {
      if (targetDayNumbers.includes(currentDate.getDay())) {
        lessonCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return Math.max(1, lessonCount);
  };

  // Get the current lesson number from the lesson string (e.g., "Aula 5" -> 5)
  const extractLessonNumber = (lessonString: string | null): number => {
    if (!lessonString) return 0;
    // Try to find a number in the string
    const match = lessonString.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Calculate progress status
  const getProgressStatus = (currentLesson: number, expectedLesson: number) => {
    if (currentLesson === 0 || expectedLesson === 0) return 'unknown';
    const diff = currentLesson - expectedLesson;
    if (diff >= 0) return 'ahead';
    if (diff >= -2) return 'ontrack';
    return 'behind';
  };

  // Calculate stats
  const totalStudents = credentials.length;
  const activeStudents = credentials.filter(c => c.student?.is_active).length;
  const avgCompletion = credentials.length > 0 
    ? credentials.reduce((sum, c) => sum + (c.completion_percentage || 0), 0) / credentials.length 
    : 0;
  const completedCount = credentials.filter(c => (c.completion_percentage || 0) >= 100).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Alunos LMS</h1>
          <p className="page-subtitle">Gerencie acessos e acompanhe o progresso no sistema de ensino</p>
        </div>
        <Button 
          onClick={syncAll} 
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar Todos'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total de Alunos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeStudents}</p>
                <p className="text-sm text-muted-foreground">Alunos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <BookOpen className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgCompletion.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Média de Conclusão</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        ) : filteredCredentials.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Credenciais</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Módulo Atual</TableHead>
                <TableHead>Projeção</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCredentials.map((cred) => (
                <TableRow key={cred.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{cred.student?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          Matrícula: {cred.matricula}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cred.email}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(cred.email, 'E-mail')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {visiblePasswords.has(cred.id) ? cred.password : '••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(cred.id)}
                        >
                          {visiblePasswords.has(cred.id) ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(cred.password, 'Senha')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {(cred.completion_percentage || 0).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={cred.completion_percentage || 0} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {cred.current_module ? (
                      <div className="text-sm">
                        <p className="font-medium">{cred.current_module}</p>
                        {cred.current_lesson && (
                          <p className="text-muted-foreground text-xs">
                            Aula: {cred.current_lesson}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const classDays = cred.all_class_days || [];
                      const enrollmentDate = cred.earliest_enrollment_date || cred.enrollment?.enrollment_date;
                      const expectedLesson = calculateExpectedLesson(enrollmentDate, classDays);
                      const currentLesson = extractLessonNumber(cred.current_lesson);
                      const status = getProgressStatus(currentLesson, expectedLesson);
                      const diff = currentLesson - expectedLesson;
                      
                      return (
                        <div className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            {status === 'ahead' && (
                              <Badge className="bg-success/10 text-success border-success/20">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Adiantado
                              </Badge>
                            )}
                            {status === 'ontrack' && (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <Minus className="w-3 h-3 mr-1" />
                                No prazo
                              </Badge>
                            )}
                            {status === 'behind' && (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                <TrendingDown className="w-3 h-3 mr-1" />
                                Atrasado
                              </Badge>
                            )}
                            {status === 'unknown' && (
                              <Badge variant="outline">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                N/A
                              </Badge>
                            )}
                          </div>
                          {expectedLesson > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Esperado: Aula {expectedLesson} | Atual: {currentLesson || '-'}
                              {diff !== 0 && currentLesson > 0 && (
                                <span className={diff > 0 ? 'text-success ml-1' : 'text-destructive ml-1'}>
                                  ({diff > 0 ? '+' : ''}{diff})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {cred.student?.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => syncSingle(cred.id)}
                        title="Atualizar progresso"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="Ações">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Gerenciar Aluno</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => generatePedagogicalReport(cred)}
                            disabled={reportLoading === cred.id}
                          >
                            {reportLoading === cred.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4 mr-2" />
                            )}
                            Relatório Pedagógico
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUnlockLevel(cred, 'current')}>
                            <Unlock className="w-4 h-4 mr-2" />
                            Desbloquear Nível
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetModule(cred, 'next')}>
                            <BookOpen className="w-4 h-4 mr-2" />
                            Mover para Módulo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetLevel(cred, 'next')}>
                            <Trophy className="w-4 h-4 mr-2" />
                            Mover para Nível
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleResetProgress(cred)}
                            className="text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Resetar Progresso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCredential(cred);
                          setShowDetailsModal(true);
                        }}
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno no LMS'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Tente buscar por outro termo' 
                : 'Os alunos serão adicionados automaticamente ao matricular em cursos de robótica ou programação.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Detalhes do Aluno no LMS
            </DialogTitle>
            <DialogDescription>
              Informações de acesso, progresso e ações de gerenciamento
            </DialogDescription>
          </DialogHeader>
          
          {selectedCredential && (
            <div className="space-y-6">
              {/* Student Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dados do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedCredential.student?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matrícula</p>
                    <p className="font-medium font-mono">{selectedCredential.matricula}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Credentials */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Credenciais de Acesso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selectedCredential.email}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedCredential.email, 'E-mail')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Senha</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono">
                        {visiblePasswords.has(selectedCredential.id) 
                          ? selectedCredential.password 
                          : '••••••••'
                        }
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => togglePasswordVisibility(selectedCredential.id)}
                      >
                        {visiblePasswords.has(selectedCredential.id) ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedCredential.password, 'Senha')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Progresso no Curso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Conclusão Geral</span>
                      <span className="font-bold text-primary">
                        {(selectedCredential.progressData?.completion_percentage || selectedCredential.completion_percentage || 0).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={selectedCredential.progressData?.completion_percentage || selectedCredential.completion_percentage || 0} className="h-3" />
                  </div>
                  
                  {/* XP and Coins */}
                  {(selectedCredential.progressData?.total_xp !== undefined || selectedCredential.progressData?.coins !== undefined) && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">XP Total</p>
                          <p className="font-bold">{selectedCredential.progressData?.total_xp || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Moedas</p>
                          <p className="font-bold">{selectedCredential.progressData?.coins || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lessons Progress */}
                  {selectedCredential.progressData?.total_lessons !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Aulas Concluídas</span>
                      <span className="font-medium">
                        {selectedCredential.progressData?.completed_lessons || 0} / {selectedCredential.progressData?.total_lessons || 0}
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Módulo Atual</p>
                      <p className="font-medium">{selectedCredential.progressData?.current_module || selectedCredential.current_module || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nível</p>
                      <p className="font-medium">{selectedCredential.progressData?.current_level || selectedCredential.current_level || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aula Atual</p>
                      <p className="font-medium">{selectedCredential.progressData?.current_lesson || selectedCredential.current_lesson || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={selectedCredential.progressData?.status === 'active' ? 'default' : 'secondary'}>
                        {selectedCredential.progressData?.status || 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  {selectedCredential.last_sync_at && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <Clock className="w-3 h-3" />
                      Última sincronização: {new Date(selectedCredential.last_sync_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Management Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Ações de Gerenciamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlockLevel(selectedCredential, 'current')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'unlockLevel' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Desbloquear Nível
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetModule(selectedCredential, 'next')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'setModule' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                      Próximo Módulo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetLevel(selectedCredential, 'next')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'setLevel' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trophy className="w-4 h-4" />
                      )}
                      Próximo Nível
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetProgress(selectedCredential)}
                      disabled={!!actionLoading}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      {actionLoading === 'resetProgress' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Resetar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Report Button */}
              <Button 
                onClick={() => generatePedagogicalReport(selectedCredential)}
                disabled={reportLoading === selectedCredential.id}
                variant="outline"
                className="w-full gap-2"
              >
                {reportLoading === selectedCredential.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Gerar Relatório Pedagógico
              </Button>

              <Button 
                onClick={() => syncSingle(selectedCredential.id)}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Progresso
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!confirmReset} onOpenChange={() => setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Progresso do Aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá resetar todo o progresso do aluno {confirmReset?.student?.name} no LMS. 
              Isso não pode ser desfeito. O aluno terá que recomeçar do início.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetProgress} className="bg-destructive hover:bg-destructive/90">
              Sim, Resetar Progresso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
