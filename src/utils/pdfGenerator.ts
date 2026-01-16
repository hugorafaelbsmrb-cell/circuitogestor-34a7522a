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
  guardianRg?: string;
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
  city?: string;
}

export function generateContractPDF(content: ContractContent): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  doc.text(content.schoolName?.toUpperCase() || 'CIRCUITO KIDS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Introduction
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introText = 'Pelo presente instrumento particular, de um lado:';
  doc.text(introText, margin, yPos);
  yPos += 10;

  // School Info (CONTRATADA)
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATADA: ', margin, yPos);
  doc.setFont('helvetica', 'normal');
  const contratadaText = `${content.schoolName || 'CIRCUITO KIDS'}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${content.schoolCnpj || '___________________'}, com sede à ${content.schoolAddress || '_________________________________________________'}.`;
  const contratadaLines = doc.splitTextToSize(contratadaText, pageWidth - 2 * margin);
  doc.text(contratadaLines, margin, yPos);
  yPos += contratadaLines.length * 5 + 5;

  // Guardian Info (CONTRATANTE)
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATANTE: ', margin, yPos);
  doc.setFont('helvetica', 'normal');
  const contratanteText = `${content.guardianName || '___________________________________________'}, responsável legal pelo(a) aluno(a) ${content.studentName || '___________________________________________'}, CPF nº ${content.guardianCpf || '____________________'}${content.guardianRg ? `, RG nº ${content.guardianRg}` : ''}.`;
  const contratanteLines = doc.splitTextToSize(contratanteText, pageWidth - 2 * margin);
  doc.text(contratanteLines, margin, yPos);
  yPos += contratanteLines.length * 5 + 8;

  // Legal reference
  doc.setFont('helvetica', 'normal');
  const legalText = 'As partes resolvem celebrar o presente contrato nos termos do ECA (Lei nº 8.069/90) e da LGPD (Lei nº 13.709/18), conforme as cláusulas abaixo:';
  const legalLines = doc.splitTextToSize(legalText, pageWidth - 2 * margin);
  doc.text(legalLines, margin, yPos);
  yPos += legalLines.length * 5 + 10;

  // Clauses
  if (content.clauses && content.clauses.length > 0) {
    content.clauses.forEach((clause, index) => {
      // Check if we need a new page
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`CLÁUSULA ${index + 1}ª – ${clause.title.toUpperCase()}`, margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      
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

  // Foro clause if not included
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Signature section
  yPos += 10;
  doc.setFontSize(10);
  doc.text(`Local e data: ${content.city || '___________________________________________'}`, margin, yPos);
  yPos += 25;

  // Signature lines
  doc.line(margin, yPos, margin + 70, yPos);
  doc.line(pageWidth - margin - 70, yPos, pageWidth - margin, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.text(`${content.schoolName || 'CIRCUITO KIDS'} (CONTRATADA)`, margin, yPos);
  doc.text('RESPONSÁVEL LEGAL (CONTRATANTE)', pageWidth - margin - 70, yPos);

  // Add Annexes page
  doc.addPage();
  yPos = 20;

  // Annex Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXOS DO CONTRATO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Annex I - Reforço Escolar
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO I – REFORÇO ESCOLAR (1 A 5 ANOS)', margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Modalidade: Plano Semestral (06 meses)', margin, yPos);
  yPos += 6;
  doc.text('• Opções de Frequência e Valores:', margin, yPos);
  yPos += 6;

  // Table for Reforço
  autoTable(doc, {
    startY: yPos,
    head: [['Frequência', 'Valor Mensal']],
    body: [
      ['2x na semana', 'R$ 200,00'],
      ['3x na semana', 'R$ 250,00'],
      ['5x na semana', 'R$ 300,00'],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: margin },
    tableWidth: 100,
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Annex II - Robótica Educacional
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO II – ROBÓTICA EDUCACIONAL', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Frequência: 02 vezes na semana', margin, yPos);
  yPos += 6;
  doc.text('• Plano: Anual (12 meses)', margin, yPos);
  yPos += 6;
  doc.text('• Valor Mensal: R$ 250,00', margin, yPos);
  yPos += 15;

  // Annex III - Soroban
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO III – SOROBAN (ÁBACO JAPONÊS)', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Frequência: 02 vezes na semana', margin, yPos);
  yPos += 6;
  doc.text('• Duração: Estimada em 18 meses (10 níveis no total)', margin, yPos);
  yPos += 6;
  doc.text('• Valor Mensal: R$ 250,00', margin, yPos);
  yPos += 6;
  doc.text('• Material Didático (obrigatório): consultar valores', margin, yPos);
  yPos += 20;

  // Course selected highlight
  if (content.courseName) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MODALIDADE CONTRATADA:', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`• Curso: ${content.courseName}`, margin, yPos);
    yPos += 6;
    doc.text(`• Turma: ${content.classGroupName || '-'}`, margin, yPos);
    yPos += 6;
    doc.text(`• Horário: ${content.schedule || '-'}`, margin, yPos);
    yPos += 6;
    doc.text(`• Duração: ${content.courseDuration || '-'}`, margin, yPos);
    yPos += 6;
    doc.text(`• Valor Mensal: R$ ${content.installmentValue?.toFixed(2).replace('.', ',') || '-'}`, margin, yPos);
    yPos += 6;
    doc.text(`• Número de Parcelas: ${content.installments}x`, margin, yPos);
    yPos += 6;
    doc.text(`• Valor Total: R$ ${content.totalValue?.toFixed(2).replace('.', ',') || '-'}`, margin, yPos);
  }

  // Signature on annex
  yPos += 25;
  doc.line(margin, yPos, margin + 70, yPos);
  doc.line(pageWidth - margin - 70, yPos, pageWidth - margin, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.text(`${content.schoolName || 'CIRCUITO KIDS'} (CONTRATADA)`, margin, yPos);
  doc.text('RESPONSÁVEL LEGAL (CONTRATANTE)', pageWidth - margin - 70, yPos);

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
