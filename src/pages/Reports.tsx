import { useState, useEffect } from 'react';
import { 
  FileText, 
  Users, 
  Cake, 
  UserCheck,
  Download,
  Loader2,
  Calendar,
  Filter,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { format, getMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  generateStudentsReportPDF, 
  generateBirthdaysReportPDF, 
  generateLeadsReportPDF 
} from '@/utils/pdfGenerator';

type ReportType = 'students' | 'birthdays' | 'leads' | null;

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  interested_course_id: string | null;
  student_name: string | null;
  student_birth_date: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
}

const months = [
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
];

const leadStatusLabels: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  interested: 'Interessado',
  scheduled: 'Agendado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export default function Reports() {
  const { toast } = useToast();
  const { students, guardians, courses, classGroups, enrollments } = useSchool();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);
  const [birthdayMonth, setBirthdayMonth] = useState<string>(String(new Date().getMonth()));
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  const reportCards = [
    {
      id: 'students' as const,
      title: 'Relatório de Alunos',
      description: 'Lista completa de alunos matriculados com dados de contato',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      id: 'birthdays' as const,
      title: 'Aniversariantes do Mês',
      description: 'Lista de alunos que fazem aniversário no mês selecionado',
      icon: Cake,
      color: 'bg-pink-500/10 text-pink-500',
    },
    {
      id: 'leads' as const,
      title: 'Relatório de Leads',
      description: 'Lista de leads e seus status de conversão',
      icon: UserCheck,
      color: 'bg-green-500/10 text-green-500',
    },
  ];

  const getStudentsReport = () => {
    return students.map(student => {
      const guardian = guardians.find(g => g.id === student.guardian_id);
      const enrollment = enrollments.find(e => e.student_id === student.id);
      const classGroup = classGroups.find(c => c.id === enrollment?.class_group_id);
      const course = courses.find(c => c.id === classGroup?.course_id);
      
      return {
        ...student,
        guardian,
        classGroup,
        course,
        enrollment,
      };
    });
  };

  const getBirthdayReport = () => {
    const monthNumber = parseInt(birthdayMonth);
    return students.filter(student => {
      const birthDate = parseISO(student.birth_date);
      return getMonth(birthDate) === monthNumber;
    }).map(student => {
      const guardian = guardians.find(g => g.id === student.guardian_id);
      return { ...student, guardian };
    }).sort((a, b) => {
      const dayA = parseISO(a.birth_date).getDate();
      const dayB = parseISO(b.birth_date).getDate();
      return dayA - dayB;
    });
  };

  const getLeadsReport = () => {
    return leads
      .filter(lead => leadStatusFilter === 'all' || lead.status === leadStatusFilter)
      .map(lead => {
        const course = courses.find(c => c.id === lead.interested_course_id);
        return { ...lead, course };
      });
  };

  const handleExportCSV = () => {
    setIsGenerating(true);
    
    let csvContent = '';
    let filename = '';
    
    if (selectedReport === 'students') {
      const data = getStudentsReport();
      csvContent = 'Nome do Aluno,Data de Nascimento,Responsável,Telefone,Email,Curso,Turma\n';
      data.forEach(row => {
        csvContent += `"${row.name}","${format(parseISO(row.birth_date), 'dd/MM/yyyy')}","${row.guardian?.name || ''}","${row.guardian?.phone || ''}","${row.guardian?.email || ''}","${row.course?.name || ''}","${row.classGroup?.name || ''}"\n`;
      });
      filename = `relatorio_alunos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    } else if (selectedReport === 'birthdays') {
      const data = getBirthdayReport();
      csvContent = 'Nome do Aluno,Data de Nascimento,Idade,Responsável,Telefone\n';
      data.forEach(row => {
        const birthDate = parseISO(row.birth_date);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        csvContent += `"${row.name}","${format(birthDate, 'dd/MM/yyyy')}","${age} anos","${row.guardian?.name || ''}","${row.guardian?.phone || ''}"\n`;
      });
      filename = `aniversariantes_${months[parseInt(birthdayMonth)].label.toLowerCase()}_${format(new Date(), 'yyyy')}.csv`;
    } else if (selectedReport === 'leads') {
      const data = getLeadsReport();
      csvContent = 'Nome,Telefone,Email,Curso Interessado,Status,Data de Cadastro\n';
      data.forEach(row => {
        csvContent += `"${row.name}","${row.phone}","${row.email || ''}","${row.course?.name || ''}","${leadStatusLabels[row.status] || row.status}","${format(parseISO(row.created_at), 'dd/MM/yyyy')}"\n`;
      });
      filename = `relatorio_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    }

    // Create and download CSV
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleExportPDF = () => {
    setIsGeneratingPDF(true);
    
    try {
      let doc;
      let filename = '';
      
      if (selectedReport === 'students') {
        const data = getStudentsReport();
        doc = generateStudentsReportPDF(data);
        filename = `relatorio_alunos_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      } else if (selectedReport === 'birthdays') {
        const data = getBirthdayReport();
        const monthName = months[parseInt(birthdayMonth)].label;
        doc = generateBirthdaysReportPDF(data, monthName);
        filename = `aniversariantes_${monthName.toLowerCase()}_${format(new Date(), 'yyyy')}.pdf`;
      } else if (selectedReport === 'leads') {
        const data = getLeadsReport();
        doc = generateLeadsReportPDF(data);
        filename = `relatorio_leads_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      }
      
      if (doc) {
        doc.save(filename);
        toast({
          title: 'PDF gerado',
          description: 'O relatório foi baixado com sucesso.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o relatório em PDF.',
        variant: 'destructive',
      });
    }
    
    setTimeout(() => setIsGeneratingPDF(false), 500);
  };

  const renderReportContent = () => {
    if (!selectedReport) return null;

    if (selectedReport === 'students') {
      const data = getStudentsReport();
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="font-semibold">Alunos Matriculados ({data.length})</h3>
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} disabled={isGenerating} size="sm" variant="outline" className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={isGeneratingPDF} size="sm" className="gap-2">
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF
              </Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Curso / Turma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{format(parseISO(row.birth_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{row.guardian?.name || '-'}</TableCell>
                    <TableCell>{row.guardian?.phone || '-'}</TableCell>
                    <TableCell>
                      {row.course?.name && row.classGroup?.name 
                        ? `${row.course.name} - ${row.classGroup.name}`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    }

    if (selectedReport === 'birthdays') {
      const data = getBirthdayReport();
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Aniversariantes de {months[parseInt(birthdayMonth)].label} ({data.length})</h3>
              <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} disabled={isGenerating || data.length === 0} size="sm" variant="outline" className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={isGeneratingPDF || data.length === 0} size="sm" className="gap-2">
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF
              </Button>
            </div>
          </div>
          {data.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Aniversário</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => {
                    const birthDate = parseISO(row.birth_date);
                    const age = new Date().getFullYear() - birthDate.getFullYear();
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Cake className="w-4 h-4 text-pink-500" />
                            {row.name}
                          </div>
                        </TableCell>
                        <TableCell>{format(birthDate, 'dd/MM')}</TableCell>
                        <TableCell>{age} anos</TableCell>
                        <TableCell>{row.guardian?.name || '-'}</TableCell>
                        <TableCell>{row.guardian?.phone || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Cake className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum aniversariante em {months[parseInt(birthdayMonth)].label}</p>
            </div>
          )}
        </div>
      );
    }

    if (selectedReport === 'leads') {
      const data = getLeadsReport();
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Leads ({data.length})</h3>
              <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(leadStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} disabled={isGenerating || data.length === 0} size="sm" variant="outline" className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </Button>
              <Button onClick={handleExportPDF} disabled={isGeneratingPDF || data.length === 0} size="sm" className="gap-2">
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF
              </Button>
            </div>
          </div>
          {data.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Curso Interessado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{row.phone}</div>
                          {row.email && <div className="text-muted-foreground">{row.email}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{row.course?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'converted' ? 'default' : row.status === 'lost' ? 'destructive' : 'secondary'}>
                          {leadStatusLabels[row.status] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(parseISO(row.created_at), 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lead encontrado com os filtros selecionados</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Gere relatórios de alunos, aniversariantes e leads</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {reportCards.map(card => (
          <Card 
            key={card.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === card.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedReport(card.id)}
          >
            <CardHeader className="pb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg mb-1">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Content */}
      {selectedReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {reportCards.find(r => r.id === selectedReport)?.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderReportContent()}
          </CardContent>
        </Card>
      )}

      {!selectedReport && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Selecione um Relatório</h3>
            <p className="text-muted-foreground">Clique em um dos cards acima para gerar o relatório desejado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}