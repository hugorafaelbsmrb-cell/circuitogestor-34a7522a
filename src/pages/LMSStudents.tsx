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
  AlertCircle
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  } | null;
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Detalhes do Aluno no LMS
            </DialogTitle>
            <DialogDescription>
              Informações de acesso e progresso do aluno
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
                        {(selectedCredential.completion_percentage || 0).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={selectedCredential.completion_percentage || 0} className="h-3" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Módulo Atual</p>
                      <p className="font-medium">{selectedCredential.current_module || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nível</p>
                      <p className="font-medium">{selectedCredential.current_level || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Aula Atual</p>
                      <p className="font-medium">{selectedCredential.current_lesson || '-'}</p>
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
    </div>
  );
}
