import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Users, 
  Cake, 
  UserCheck,
  Download,
  Loader2,
  Calendar,
  Filter,
  FileDown,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { format, getMonth, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  generateStudentsReportPDF, 
  generateBirthdaysReportPDF, 
  generateLeadsReportPDF 
} from '@/utils/pdfGenerator';

type ReportType = 'students' | 'birthdays' | 'leads' | 'financial' | null;

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const BILLING_LABELS: Record<string, string> = {
  PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: '—',
};

interface FinancialPayment {
  id: string;
  guardian_id: string;
  value: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  description: string;
  billing_type: string | null;
  guardian_name?: string;
}

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
  const [sexFilter, setSexFilter] = useState<string>('all');
  const [ageMinFilter, setAgeMinFilter] = useState<string>('');
  const [ageMaxFilter, setAgeMaxFilter] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Financial report state
  const [financialPayments, setFinancialPayments] = useState<FinancialPayment[]>([]);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  const [finStartDate, setFinStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [finEndDate, setFinEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Calculate age helper
  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const fetchFinancial = async () => {
    setIsLoadingFinancial(true);
    const { data: pays } = await supabase
      .from('payments')
      .select('id, guardian_id, value, status, due_date, payment_date, description, billing_type')
      .or(`and(payment_date.gte.${finStartDate},payment_date.lte.${finEndDate}),and(due_date.gte.${finStartDate},due_date.lte.${finEndDate})`)
      .order('due_date', { ascending: true });
    
    const guardianMap = new Map(guardians.map(g => [g.id, g.name]));
    const enriched = (pays || []).map((p: any) => ({
      ...p,
      guardian_name: guardianMap.get(p.guardian_id) || '—',
    }));
    setFinancialPayments(enriched);
    setIsLoadingFinancial(false);
  };

  useEffect(() => {
    if (selectedReport === 'financial') fetchFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, finStartDate, finEndDate]);

  const financialBuckets = useMemo(() => {
    const received = financialPayments.filter(p =>
      PAID_STATUSES.has(p.status) && p.payment_date &&
      p.payment_date >= finStartDate && p.payment_date <= finEndDate
    );
    const toPay = financialPayments.filter(p =>
      !PAID_STATUSES.has(p.status) &&
      p.due_date >= finStartDate && p.due_date <= finEndDate
    );
    return {
      received,
      toPay,
      receivedTotal: received.reduce((s, p) => s + Number(p.value), 0),
      toPayTotal: toPay.reduce((s, p) => s + Number(p.value), 0),
    };
  }, [financialPayments, finStartDate, finEndDate]);

  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d?: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—');

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
    {
      id: 'financial' as const,
      title: 'Recebido e A Pagar',
      description: 'Conferência manual: pagamentos recebidos e em aberto no período',
      icon: DollarSign,
      color: 'bg-amber-500/10 text-amber-500',
    },
  ];

  const getStudentsReport = () => {
    return students
      .filter(student => {
        // Sex filter
        if (sexFilter !== 'all' && student.sex !== sexFilter) return false;
        
        // Age filter
        const age = calculateAge(student.birth_date);
        if (ageMinFilter && age < parseInt(ageMinFilter)) return false;
        if (ageMaxFilter && age > parseInt(ageMaxFilter)) return false;
        
        return true;
      })
      .map(student => {
        const guardian = guardians.find(g => g.id === student.guardian_id);
        const enrollment = enrollments.find(e => e.student_id === student.id);
        const classGroup = classGroups.find(c => c.id === enrollment?.class_group_id);
        const course = courses.find(c => c.id === classGroup?.course_id);
        const age = calculateAge(student.birth_date);
        
        return {
          ...student,
          guardian,
          classGroup,
          course,
          enrollment,
          age,
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
      csvContent = 'Nome do Aluno,Sexo,Idade,Data de Nascimento,Responsável,Telefone,Email,Curso,Turma\n';
      data.forEach(row => {
        const sexLabel = row.sex === 'M' ? 'Masculino' : row.sex === 'F' ? 'Feminino' : '';
        csvContent += `"${row.name}","${sexLabel}","${row.age} anos","${format(parseISO(row.birth_date), 'dd/MM/yyyy')}","${row.guardian?.name || ''}","${row.guardian?.phone || ''}","${row.guardian?.email || ''}","${row.course?.name || ''}","${row.classGroup?.name || ''}"\n`;
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
    } else if (selectedReport === 'financial') {
      const { received, toPay, receivedTotal, toPayTotal } = financialBuckets;
      csvContent = `Conferência Financeira — ${fmtDate(finStartDate)} a ${fmtDate(finEndDate)}\n\n`;
      csvContent += `=== RECEBIDO (${received.length}) — Total: ${fmtBRL(receivedTotal)} ===\n`;
      csvContent += 'Data Pagamento,Vencimento,Responsável,Descrição,Forma,Valor,Status\n';
      received.forEach(p => {
        csvContent += `"${fmtDate(p.payment_date)}","${fmtDate(p.due_date)}","${p.guardian_name}","${p.description.replace(/"/g, "'")}","${BILLING_LABELS[p.billing_type || 'UNDEFINED'] || p.billing_type || '—'}","${Number(p.value).toFixed(2).replace('.', ',')}","${p.status}"\n`;
      });
      csvContent += `\n=== A PAGAR / EM ABERTO (${toPay.length}) — Total: ${fmtBRL(toPayTotal)} ===\n`;
      csvContent += 'Vencimento,Responsável,Descrição,Forma,Valor,Status\n';
      toPay.forEach(p => {
        csvContent += `"${fmtDate(p.due_date)}","${p.guardian_name}","${p.description.replace(/"/g, "'")}","${BILLING_LABELS[p.billing_type || 'UNDEFINED'] || p.billing_type || '—'}","${Number(p.value).toFixed(2).replace('.', ',')}","${p.status}"\n`;
      });
      filename = `conferencia_financeira_${finStartDate}_a_${finEndDate}.csv`;
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
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-secondary/30 rounded-lg">
            <div className="space-y-1">
              <label className="text-sm font-medium">Sexo</label>
              <Select value={sexFilter} onValueChange={setSexFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Idade mín.</label>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="0"
                value={ageMinFilter}
                onChange={(e) => setAgeMinFilter(e.target.value)}
                className="w-[80px] h-10 px-3 border rounded-md bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Idade máx.</label>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="99"
                value={ageMaxFilter}
                onChange={(e) => setAgeMaxFilter(e.target.value)}
                className="w-[80px] h-10 px-3 border rounded-md bg-background"
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSexFilter('all');
                setAgeMinFilter('');
                setAgeMaxFilter('');
              }}
            >
              Limpar filtros
            </Button>
          </div>

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
                  <TableHead>Sexo</TableHead>
                  <TableHead>Idade</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">
                        {row.sex === 'M' ? 'M' : row.sex === 'F' ? 'F' : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.age} anos</TableCell>
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