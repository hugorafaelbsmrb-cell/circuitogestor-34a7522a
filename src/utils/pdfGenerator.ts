import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractContent {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  guardianName: string;
  guardianCpf: string;
  guardianAddress: string;
  studentName: string;
  studentBirthDate: string;
  courseName: string;
  courseDuration: string;
  coursePrice: number;
  classGroupName: string;
  schedule: string;
  installments: number;
  installmentValue: number;
  totalValue: number;
  clauses: { title: string; content: string }[];
  createdAt: string;
}

export function generateContractPDF(content: ContractContent): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Line separator
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // School Info (CONTRATADO)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATADO:', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(content.schoolName || 'EduGestor', margin, yPos);
  yPos += 5;
  doc.text(`CNPJ: ${content.schoolCnpj || '-'}`, margin, yPos);
  yPos += 5;
  doc.text(`Endereço: ${content.schoolAddress || '-'}`, margin, yPos);
  yPos += 10;

  // Guardian Info (CONTRATANTE)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATANTE (Responsável Financeiro):', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${content.guardianName}`, margin, yPos);
  yPos += 5;
  doc.text(`CPF: ${content.guardianCpf}`, margin, yPos);
  yPos += 5;
  doc.text(`Endereço: ${content.guardianAddress}`, margin, yPos);
  yPos += 10;

  // Student Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ALUNO:', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${content.studentName}`, margin, yPos);
  yPos += 5;
  const birthDate = content.studentBirthDate ? format(parseISO(content.studentBirthDate), 'dd/MM/yyyy') : '-';
  doc.text(`Data de Nascimento: ${birthDate}`, margin, yPos);
  yPos += 10;

  // Course Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CURSO:', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${content.courseName}`, margin, yPos);
  yPos += 5;
  doc.text(`Duração: ${content.courseDuration}`, margin, yPos);
  yPos += 5;
  doc.text(`Turma: ${content.classGroupName}`, margin, yPos);
  yPos += 5;
  doc.text(`Horário: ${content.schedule}`, margin, yPos);
  yPos += 10;

  // Financial Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR:', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Mensalidade: R$ ${content.installmentValue.toFixed(2).replace('.', ',')}`, margin, yPos);
  yPos += 5;
  doc.text(`Número de Parcelas: ${content.installments}x`, margin, yPos);
  yPos += 5;
  doc.text(`Valor Total: R$ ${content.totalValue.toFixed(2).replace('.', ',')}`, margin, yPos);
  yPos += 10;

  // Contract Date
  const contractDate = content.createdAt ? format(parseISO(content.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Data do Contrato: ${contractDate}`, margin, yPos);
  yPos += 15;

  // Clauses
  if (content.clauses && content.clauses.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULAS CONTRATUAIS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    content.clauses.forEach((clause, index) => {
      // Check if we need a new page
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cláusula ${index + 1}ª - ${clause.title}`, margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      // Split long text into lines
      const lines = doc.splitTextToSize(clause.content, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;
    });
  }

  // Signature section
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  yPos += 20;

  doc.setFontSize(10);
  doc.text('Local e Data: _________________________________, ___/___/_______', margin, yPos);
  yPos += 30;

  // Signature lines
  doc.line(margin, yPos, margin + 60, yPos);
  doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.text('CONTRATANTE', margin + 20, yPos);
  doc.text('CONTRATADO', pageWidth - margin - 40, yPos);

  return doc;
}

interface StudentReportData {
  name: string;
  birth_date: string;
  guardian?: { name?: string; phone?: string; email?: string } | null;
  course?: { name?: string } | null;
  classGroup?: { name?: string } | null;
}

interface BirthdayReportData {
  name: string;
  birth_date: string;
  guardian?: { name?: string; phone?: string } | null;
}

interface LeadReportData {
  name: string;
  phone: string;
  email?: string | null;
  course?: { name?: string } | null;
  status: string;
  created_at: string;
}

const leadStatusLabels: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  interested: 'Interessado',
  scheduled: 'Agendado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export function generateStudentsReportPDF(data: StudentReportData[]): jsPDF {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Alunos Matriculados', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

  // Table
  autoTable(doc, {
    startY: 35,
    head: [['Aluno', 'Nascimento', 'Responsável', 'Telefone', 'Curso / Turma']],
    body: data.map(row => [
      row.name,
      format(parseISO(row.birth_date), 'dd/MM/yyyy'),
      row.guardian?.name || '-',
      row.guardian?.phone || '-',
      row.course?.name && row.classGroup?.name ? `${row.course.name} - ${row.classGroup.name}` : '-'
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  return doc;
}

export function generateBirthdaysReportPDF(data: BirthdayReportData[], monthName: string): jsPDF {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Aniversariantes de ${monthName}`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

  // Table
  autoTable(doc, {
    startY: 35,
    head: [['Aluno', 'Aniversário', 'Idade', 'Responsável', 'Telefone']],
    body: data.map(row => {
      const birthDate = parseISO(row.birth_date);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      return [
        row.name,
        format(birthDate, 'dd/MM'),
        `${age} anos`,
        row.guardian?.name || '-',
        row.guardian?.phone || '-',
      ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [236, 72, 153] },
  });

  return doc;
}

export function generateLeadsReportPDF(data: LeadReportData[]): jsPDF {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Leads', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

  // Table
  autoTable(doc, {
    startY: 35,
    head: [['Nome', 'Telefone', 'Email', 'Curso Interessado', 'Status', 'Data Cadastro']],
    body: data.map(row => [
      row.name,
      row.phone,
      row.email || '-',
      row.course?.name || '-',
      leadStatusLabels[row.status] || row.status,
      format(parseISO(row.created_at), 'dd/MM/yyyy'),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [34, 197, 94] },
  });

  return doc;
}
