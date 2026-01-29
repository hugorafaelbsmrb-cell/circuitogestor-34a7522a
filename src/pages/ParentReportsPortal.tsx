import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { Search, User, FileText, ArrowLeft, MessageSquare, Send, Loader2, CheckCircle, BookOpen, Star, AlertTriangle, Lightbulb, ClipboardList, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Student {
  id: string;
  name: string;
  birth_date: string;
}

interface Guardian {
  id: string;
  name: string;
  cpf: string;
}

interface Report {
  id: string;
  title: string;
  content: string;
  report_date: string;
  report_type: string;
  teacher_name?: string;
  student_name?: string;
}

interface ParentComment {
  id: string;
  report_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

const REPORTS_API_URL = 'https://uvnkqzwzsokyonxonzot.supabase.co/functions/v1/teacher-api/reports';
const API_KEY = 'teacher_api_circuitokids_2025';

export default function ParentReportsPortal() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const [cpf, setCpf] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [comments, setComments] = useState<Record<string, ParentComment>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const searchByCpf = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      toast({
        title: 'CPF inválido',
        description: 'Digite um CPF válido com 11 dígitos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Find guardian by CPF
      const { data: guardianData, error: guardianError } = await supabase
        .from('guardians')
        .select('id, name, cpf')
        .eq('cpf', cleanCpf)
        .single();

      if (guardianError || !guardianData) {
        toast({
          title: 'CPF não encontrado',
          description: 'Não encontramos nenhum responsável cadastrado com este CPF',
          variant: 'destructive',
        });
        return;
      }

      setGuardian(guardianData);

      // Find students linked to this guardian
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, birth_date')
        .eq('guardian_id', guardianData.id)
        .eq('is_active', true);

      if (studentsError) {
        throw studentsError;
      }

      if (!studentsData || studentsData.length === 0) {
        toast({
          title: 'Nenhum aluno encontrado',
          description: 'Não encontramos alunos vinculados a este responsável',
          variant: 'destructive',
        });
        return;
      }

      setStudents(studentsData);

      // If only one student, select automatically
      if (studentsData.length === 1) {
        selectStudent(studentsData[0], guardianData.id);
      }
    } catch (error) {
      console.error('Error searching by CPF:', error);
      toast({
        title: 'Erro na busca',
        description: 'Ocorreu um erro ao buscar os dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectStudent = async (student: Student, guardianId?: string) => {
    setSelectedStudent(student);
    setLoadingReports(true);

    try {
      let allReports: Report[] = [];
      const localReportIds: string[] = [];

      // First, fetch approved reports from local database
      const { data: localReports, error: localError } = await supabase
        .from('student_reports')
        .select(`
          id,
          title,
          content,
          report_date,
          report_type,
          teacher:teachers(name)
        `)
        .eq('student_id', student.id)
        .eq('approval_status', 'approved')
        .order('report_date', { ascending: false });

      if (!localError && localReports) {
        allReports = localReports.map((r: any) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          report_date: r.report_date,
          report_type: r.report_type || 'pedagogical',
          teacher_name: r.teacher?.name,
          student_name: student.name,
        }));
        localReportIds.push(...localReports.map((r: any) => r.id));
      }

      // Then, fetch reports from external API (these are already considered approved)
      try {
        const response = await fetch(`${REPORTS_API_URL}?student_id=${student.id}`, {
          headers: {
            'x-api-key': API_KEY,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const externalReports = (data.data || data || []).map((r: any) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            report_date: r.report_date,
            report_type: r.report_type || 'pedagogical',
            teacher_name: r.teacher_name,
            student_name: student.name,
          }));
          
          // Merge reports, avoiding duplicates by ID
          const existingIds = new Set(allReports.map(r => r.id));
          externalReports.forEach((r: Report) => {
            if (!existingIds.has(r.id)) {
              allReports.push(r);
            }
          });
        }
      } catch (apiError) {
        console.error('Error fetching external reports:', apiError);
        // Continue with local reports only
      }

      // Sort all reports by date
      allReports.sort((a, b) => 
        new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
      );

      setReports(allReports);

      // Mark local reports as read by guardian
      if (localReportIds.length > 0) {
        await supabase
          .from('student_reports')
          .update({ 
            read_at: new Date().toISOString(),
            read_by_guardian: true 
          })
          .in('id', localReportIds)
          .is('read_at', null);
      }

      // Fetch existing comments for these reports
      const gId = guardianId || guardian?.id;
      if (gId && allReports.length > 0) {
        const reportIds = allReports.map((r: Report) => r.id);
        const { data: commentsData } = await supabase
          .from('report_parent_comments')
          .select('*')
          .eq('guardian_id', gId)
          .in('report_id', reportIds);

        if (commentsData) {
          const commentsMap: Record<string, ParentComment> = {};
          commentsData.forEach((c: ParentComment) => {
            commentsMap[c.report_id] = c;
          });
          setComments(commentsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const saveComment = async (reportId: string) => {
    const comment = newComments[reportId]?.trim();
    if (!comment || !guardian || !selectedStudent) return;

    setSavingComment(reportId);
    try {
      const existingComment = comments[reportId];

      if (existingComment) {
        // Update existing comment
        const { error } = await supabase
          .from('report_parent_comments')
          .update({ comment, updated_at: new Date().toISOString() })
          .eq('id', existingComment.id);

        if (error) throw error;

        setComments(prev => ({
          ...prev,
          [reportId]: { ...existingComment, comment, updated_at: new Date().toISOString() },
        }));
      } else {
        // Insert new comment
        const { data, error } = await supabase
          .from('report_parent_comments')
          .insert({
            report_id: reportId,
            student_id: selectedStudent.id,
            guardian_id: guardian.id,
            comment,
          })
          .select()
          .single();

        if (error) throw error;

        setComments(prev => ({
          ...prev,
          [reportId]: data,
        }));
      }

      setNewComments(prev => ({ ...prev, [reportId]: '' }));
      toast({
        title: 'Comentário salvo',
        description: 'Seu comentário foi registrado com sucesso',
      });
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o comentário. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSavingComment(null);
    }
  };

  const goBack = () => {
    if (selectedStudent) {
      setSelectedStudent(null);
      setReports([]);
      setComments({});
      setNewComments({});
    } else if (guardian) {
      setGuardian(null);
      setStudents([]);
      setCpf('');
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const parseReportContent = (report: Report) => {
    // Try to parse as JSON for weekly reports
    if (report.report_type === 'weekly' || report.report_type === 'semanal') {
      try {
        const content = typeof report.content === 'string' ? JSON.parse(report.content) : report.content;
        return content;
      } catch {
        return null;
      }
    }
    return null;
  };

  // CPF Entry Screen
  if (!guardian) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="mx-auto w-20 h-20 rounded-2xl mb-4 object-contain shadow-lg"
              />
            ) : (
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
            )}
            <CardTitle className="text-2xl font-bold text-gray-800">Portal dos Pais</CardTitle>
            <CardDescription className="text-gray-600">
              Acesse os relatórios de acompanhamento do seu filho
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">CPF do Responsável</label>
              <div className="relative">
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  className="pl-10 h-12 text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && searchByCpf()}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
            <Button
              onClick={searchByCpf}
              disabled={isLoading || cpf.length < 14}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Search className="w-5 h-5 mr-2" />
              )}
              Buscar Relatórios
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student Selection Screen
  if (!selectedStudent && students.length > 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={goBack}
            className="mb-6 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Card className="shadow-xl border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold text-gray-800">
                Olá, {guardian.name.split(' ')[0]}!
              </CardTitle>
              <CardDescription>
                Selecione o aluno para visualizar os relatórios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => selectStudent(student)}
                  className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all text-left flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-lg">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 group-hover:text-orange-600">
                      {student.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {calculateAge(student.birth_date)} anos
                    </p>
                  </div>
                  <BookOpen className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reports View
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={goBack}
          className="mb-6 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {students.length > 1 ? 'Escolher outro aluno' : 'Voltar'}
        </Button>

        {/* Student Header */}
        <Card className="shadow-lg border-0 mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {selectedStudent?.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{selectedStudent?.name}</h1>
                <p className="text-white/80">
                  {calculateAge(selectedStudent?.birth_date || '')} anos • {reports.length} relatório(s)
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Reports List */}
        {loadingReports ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : reports.length === 0 ? (
          <Card className="shadow-lg border-0">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">Nenhum relatório encontrado</h3>
              <p className="text-gray-400">Os relatórios aparecerão aqui quando estiverem disponíveis</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => {
              const parsedContent = parseReportContent(report);
              const existingComment = comments[report.id];

              return (
                <Card key={report.id} className="shadow-lg border-0 overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-gray-800">{report.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{format(new Date(report.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                          {report.teacher_name && (
                            <>
                              <span>•</span>
                              <span>Prof. {report.teacher_name}</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <Badge variant={report.report_type === 'weekly' || report.report_type === 'semanal' ? 'default' : 'secondary'}>
                        {report.report_type === 'weekly' || report.report_type === 'semanal' ? 'Semanal' : 'Pedagógico'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Report Content */}
                    {parsedContent ? (
                      <div className="space-y-4">
                        {parsedContent.performance && (
                          <div className="flex gap-3">
                            <div className="w-1 bg-orange-500 rounded-full" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <Star className="w-4 h-4 text-orange-500" />
                                Desempenho Geral
                              </h4>
                              <p className="text-gray-600">{parsedContent.performance}</p>
                            </div>
                          </div>
                        )}
                        {parsedContent.positive_points && (
                          <div className="flex gap-3">
                            <div className="w-1 bg-green-500 rounded-full" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Pontos Positivos
                              </h4>
                              <p className="text-gray-600">{parsedContent.positive_points}</p>
                            </div>
                          </div>
                        )}
                        {parsedContent.difficulties && (
                          <div className="flex gap-3">
                            <div className="w-1 bg-amber-500 rounded-full" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Dificuldades
                              </h4>
                              <p className="text-gray-600">{parsedContent.difficulties}</p>
                            </div>
                          </div>
                        )}
                        {parsedContent.recommendations && (
                          <div className="flex gap-3">
                            <div className="w-1 bg-blue-500 rounded-full" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <Lightbulb className="w-4 h-4 text-blue-500" />
                                Recomendações
                              </h4>
                              <p className="text-gray-600">{parsedContent.recommendations}</p>
                            </div>
                          </div>
                        )}
                        {parsedContent.observations && (
                          <div className="flex gap-3">
                            <div className="w-1 bg-gray-400 rounded-full" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-1">
                                <ClipboardList className="w-4 h-4 text-gray-500" />
                                Observações
                              </h4>
                              <p className="text-gray-600">{parsedContent.observations}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600 whitespace-pre-wrap">{report.content}</p>
                    )}

                    <Separator />

                    {/* Parent Comment Section */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-orange-500" />
                        Seu Comentário
                      </h4>

                      {existingComment && (
                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                          <p className="text-gray-700">{existingComment.comment}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Enviado em {format(new Date(existingComment.created_at), "dd/MM/yyyy 'às' HH:mm")}
                            {existingComment.updated_at !== existingComment.created_at && ' (editado)'}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Textarea
                          placeholder={existingComment ? "Atualizar comentário..." : "Deixe seu comentário sobre este relatório..."}
                          value={newComments[report.id] || ''}
                          onChange={(e) => setNewComments(prev => ({ ...prev, [report.id]: e.target.value }))}
                          className="flex-1 min-h-[80px] resize-none"
                        />
                        <Button
                          onClick={() => saveComment(report.id)}
                          disabled={!newComments[report.id]?.trim() || savingComment === report.id}
                          className="self-end bg-orange-500 hover:bg-orange-600"
                        >
                          {savingComment === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
