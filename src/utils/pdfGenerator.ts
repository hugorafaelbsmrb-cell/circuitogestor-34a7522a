import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractContent {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  schoolLogo?: string;
  schoolSignatureUrl?: string | null;
  schoolRepresentativeName?: string | null;
  guardianName: string;
  guardianCpf: string;
  guardianRg?: string;
  guardianAddress: string;
  studentName: string;
  studentBirthDate: string;
  studentSex?: string;
  studentAge?: number | null;
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
  contractDurationLabel?: string;
  lmsCredentials?: { email: string; password: string; matricula: string } | null;
  sorobanCredentials?: { email: string; password: string; matricula: string; level?: number } | null;
  // Digital signature fields
  signatureImage?: string | null;
  signedAt?: string | null;
  signatureHash?: string | null;
}

export function generateContractPDF(content: ContractContent): jsPDF {
  // Using 'pt' (points) for more precise control - 1pt = 1/72 inch
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 15;

  // Add logo function - square logo proportions
  const addLogo = (logoY: number): number => {
    if (!content.schoolLogo) return 0;
    
    try {
      const logoSize = 15; // Square: 15mm x 15mm (~50px)
      const logoX = (pageWidth - logoSize) / 2; // Center horizontally
      
      doc.addImage(content.schoolLogo, 'AUTO', logoX, logoY, logoSize, logoSize);
      return logoSize + 5;
    } catch (e) {
      console.warn('Failed to add logo to PDF:', e);
      return 0;
    }
  };

  // Add logo to first page
  yPos += addLogo(yPos);

  // Title - more compact
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(10);
  doc.text(content.schoolName?.toUpperCase() || 'CIRCUITO KIDS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Introduction - smaller font
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Pelo presente instrumento particular, de um lado:', margin, yPos);
  yPos += 6;

  // School Info (CONTRATADA)
  doc.setFont('helvetica', 'bold');
  const contratadaLabel = 'CONTRATADA: ';
  doc.text(contratadaLabel, margin, yPos);
  const contratadaLabelWidth = doc.getTextWidth(contratadaLabel);
  
  doc.setFont('helvetica', 'normal');
  const contratadaText = `${content.schoolName || 'CIRCUITO KIDS'}, CNPJ nº ${content.schoolCnpj || '___________________'}, ${content.schoolAddress || '_________________________________________________'}.`;
  const contratadaLines = doc.splitTextToSize(contratadaText, pageWidth - 2 * margin - contratadaLabelWidth);
  
  if (contratadaLines.length > 0) {
    doc.text(contratadaLines[0], margin + contratadaLabelWidth, yPos);
    yPos += 4;
  }
  for (let i = 1; i < contratadaLines.length; i++) {
    doc.text(contratadaLines[i], margin, yPos);
    yPos += 4;
  }
  yPos += 3;

  // Guardian Info (CONTRATANTE)
  doc.setFont('helvetica', 'bold');
  const contratanteLabel = 'CONTRATANTE: ';
  doc.text(contratanteLabel, margin, yPos);
  const contratanteLabelWidth = doc.getTextWidth(contratanteLabel);
  
  doc.setFont('helvetica', 'normal');
  let contratanteText = `${content.guardianName || '___________________________________________'}, responsável pelo(a) aluno(a) ${content.studentName || '___________________________________________'}`;
  if (content.studentSex) {
    contratanteText += `, sexo ${content.studentSex === 'M' ? 'masculino' : 'feminino'}`;
  }
  if (content.studentAge !== null && content.studentAge !== undefined) {
    contratanteText += `, ${content.studentAge} anos`;
  }
  contratanteText += `, CPF nº ${content.guardianCpf || '____________________'}.`;
  
  const contratanteLines = doc.splitTextToSize(contratanteText, pageWidth - 2 * margin - contratanteLabelWidth);
  
  if (contratanteLines.length > 0) {
    doc.text(contratanteLines[0], margin + contratanteLabelWidth, yPos);
    yPos += 4;
  }
  for (let i = 1; i < contratanteLines.length; i++) {
    doc.text(contratanteLines[i], margin, yPos);
    yPos += 4;
  }
  yPos += 4;

  // Legal reference - compact
  doc.setFont('helvetica', 'normal');
  const legalText = 'As partes celebram o presente contrato nos termos do ECA (Lei nº 8.069/90) e da LGPD (Lei nº 13.709/18):';
  const legalLines = doc.splitTextToSize(legalText, pageWidth - 2 * margin);
  doc.text(legalLines, margin, yPos);
  yPos += legalLines.length * 4 + 4;

  // Clauses - smaller font for compactness
  if (content.clauses && content.clauses.length > 0) {
    content.clauses.forEach((clause, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`CLÁUSULA ${index + 1}ª – ${clause.title.toUpperCase()}`, margin, yPos);
      yPos += 4;

      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(clause.content, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 15;
        }
        doc.text(line, margin, yPos);
        yPos += 3.5;
      });
      yPos += 2;
    });
  }

  // Ensure we have space for signatures
  if (yPos > 250) {
    doc.addPage();
    yPos = 15;
  }

  // Signature section
  yPos += 6;
  doc.setFontSize(9);
  
  // Format date
  let dateStr = content.city || 'Local';
  try {
    const contractDate = content.signedAt ? new Date(content.signedAt) : new Date(content.createdAt);
    dateStr += `, ${format(contractDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  } catch {
    dateStr += `, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  }
  doc.text(dateStr, margin, yPos);
  yPos += 15;

  // Signature lines
  const sigWidth = 70;
  const sigStartRight = pageWidth - margin - sigWidth;
  
  // Left signature (CONTRATADA) - show school signature if available
  if (content.schoolSignatureUrl) {
    try {
      // Add school signature image above the line
      doc.addImage(content.schoolSignatureUrl, 'PNG', margin, yPos - 20, sigWidth, 18);
    } catch {
      // If image fails, just draw line
    }
  }
  doc.line(margin, yPos, margin + sigWidth, yPos);
  
  // Right signature (CONTRATANTE) - show digital signature if available
  if (content.signatureImage) {
    try {
      // Add signature image above the line
      doc.addImage(content.signatureImage, 'PNG', sigStartRight, yPos - 20, sigWidth, 18);
    } catch {
      // If image fails, just draw line
    }
  }
  doc.line(sigStartRight, yPos, sigStartRight + sigWidth, yPos);
  
  yPos += 4;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(content.schoolRepresentativeName || content.schoolName || 'CIRCUITO KIDS', margin, yPos);
  doc.text(content.guardianName || 'RESPONSÁVEL LEGAL', sigStartRight, yPos);
  yPos += 3;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('(CONTRATADA)', margin, yPos);
  doc.text('(CONTRATANTE)', sigStartRight, yPos);
  
  // Show digital signature info if signed
  if (content.signedAt) {
    yPos += 3;
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const signedDate = format(new Date(content.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    doc.text(`Assinado digitalmente em ${signedDate}`, sigStartRight, yPos);
    doc.setTextColor(0, 0, 0);
  }
  
  // Verification hash
  if (content.signatureHash) {
    yPos += 8;
    doc.setFontSize(6);
    doc.setTextColor(128, 128, 128);
    doc.text(`Código de verificação: ${content.signatureHash.substring(0, 32)}...`, pageWidth / 2, yPos, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // Add Annexes page
  doc.addPage();
  yPos = 15;

  // Add logo to annexes page using same function
  yPos += addLogo(yPos);

  // Annex Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXOS DO CONTRATO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Annex I - Reforço Escolar
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO I – REFORÇO ESCOLAR (1º A 5º ANO)', margin, yPos);
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

  yPos = (doc as any).lastAutoTable.finalY + 12;

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
  yPos += 12;

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
  yPos += 15;

  // Course selected highlight - MODALIDADE CONTRATADA
  if (content.courseName) {
    console.log('[PDF] yPos antes da Modalidade:', yPos);
    const modalidadeBoxHeight = 50; // Fixed height for consistency
    
    // Save graphics state to isolate this block
    (doc as any).saveGraphicsState?.() || null;
    
    // ALWAYS reset ALL graphics properties before drawing
    doc.setFillColor(220, 220, 225);     // Slightly darker gray for visibility
    doc.setDrawColor(55, 65, 81);        // Dark gray border
    doc.setLineWidth(0.8);               // Thicker border for visibility
    
    // Draw the rounded rectangle with fill and stroke
    doc.roundedRect(margin - 2, yPos - 4, pageWidth - 2 * margin + 4, modalidadeBoxHeight, 2, 2, 'FD');
    
    // Reset text properties
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MODALIDADE CONTRATADA:', margin, yPos + 2);
    
    let textY = yPos + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Curso: ${content.courseName}`, margin, textY);
    textY += 6;
    doc.text(`Turma: ${content.classGroupName || '-'}`, margin, textY);
    textY += 6;
    doc.text(`Horario: ${content.schedule || '-'}`, margin, textY);
    textY += 6;
    doc.text(`Duracao do Contrato: ${content.contractDurationLabel || `${content.installments} meses`}`, margin, textY);
    textY += 6;
    doc.text(`Valor Mensal: R$ ${content.installmentValue?.toFixed(2).replace('.', ',') || '-'}`, margin, textY);
    textY += 6;
    doc.text(`Numero de Parcelas: ${content.installments}x`, margin, textY);
    textY += 6;
    doc.text(`Valor Total: R$ ${content.totalValue?.toFixed(2).replace('.', ',') || '-'}`, margin, textY);
    
    // Restore graphics state
    (doc as any).restoreGraphicsState?.() || null;
    
    // CRITICAL: Update yPos to move past this block
    yPos += modalidadeBoxHeight + 8;
    console.log('[PDF] yPos depois da Modalidade:', yPos);
  }

  // LMS Credentials section
  if (content.lmsCredentials) {
    console.log('[PDF] yPos antes do LMS:', yPos);
    const lmsBoxHeight = 42; // Fixed height for consistency
    
    // Save graphics state
    (doc as any).saveGraphicsState?.() || null;
    
    // Reset ALL graphics properties
    doc.setFillColor(180, 210, 255);     // More visible blue background
    doc.setDrawColor(37, 99, 235);       // Blue border
    doc.setLineWidth(0.8);
    
    // Draw the rounded rectangle
    doc.roundedRect(margin - 2, yPos - 4, pageWidth - 2 * margin + 4, lmsBoxHeight, 2, 2, 'FD');
    
    // Title in blue
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACESSO A PLATAFORMA DE ENSINO (LMS)', margin, yPos + 2);
    
    // Content in black
    let textY = yPos + 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Matricula: ${content.lmsCredentials.matricula}`, margin, textY);
    textY += 6;
    doc.text(`E-mail de acesso: ${content.lmsCredentials.email}`, margin, textY);
    textY += 6;
    doc.text(`Senha inicial: ${content.lmsCredentials.password}`, margin, textY);
    textY += 8;
    
    // Note in gray
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('* Recomendamos alterar a senha no primeiro acesso.', margin, textY);
    
    // Restore graphics state
    (doc as any).restoreGraphicsState?.() || null;
    
    // Reset to default colors
    doc.setTextColor(0, 0, 0);
    
    // CRITICAL: Update yPos
    yPos += lmsBoxHeight + 8;
    console.log('[PDF] yPos depois do LMS:', yPos);
  }

  // Soroban Credentials section
  if (content.sorobanCredentials) {
    console.log('[PDF] yPos antes do Soroban:', yPos);
    const sorobanBoxHeight = 48; // Fixed height for consistency
    
    // Save graphics state
    (doc as any).saveGraphicsState?.() || null;
    
    // Reset ALL graphics properties
    doc.setFillColor(255, 220, 150);     // More visible orange/amber background
    doc.setDrawColor(217, 119, 6);       // Orange border
    doc.setLineWidth(0.8);
    
    // Draw the rounded rectangle
    doc.roundedRect(margin - 2, yPos - 4, pageWidth - 2 * margin + 4, sorobanBoxHeight, 2, 2, 'FD');
    
    // Title in orange
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACESSO A PLATAFORMA SOROBAN', margin, yPos + 2);
    
    // Content in black
    let textY = yPos + 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Matricula: ${content.sorobanCredentials.matricula}`, margin, textY);
    textY += 6;
    doc.text(`E-mail de acesso: ${content.sorobanCredentials.email}`, margin, textY);
    textY += 6;
    doc.text(`Senha inicial: ${content.sorobanCredentials.password}`, margin, textY);
    textY += 6;
    doc.text(`Nivel inicial: ${content.sorobanCredentials.level || 1}`, margin, textY);
    textY += 8;
    
    // Note in gray
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('* Recomendamos alterar a senha no primeiro acesso.', margin, textY);
    
    // Restore graphics state
    (doc as any).restoreGraphicsState?.() || null;
    
    // Reset to default colors
    doc.setTextColor(0, 0, 0);
    console.log('[PDF] yPos depois do Soroban:', yPos);
  }

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
