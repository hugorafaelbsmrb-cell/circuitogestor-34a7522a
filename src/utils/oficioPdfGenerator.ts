import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface OficioPdfData {
  institutionName: string;
  institutionCnpj?: string;
  institutionAddress?: string;
  institutionLogo?: string | null;
  oficioNumber: string;
  recipientName: string;
  recipientTitle?: string;
  recipientOrg?: string;
  subject: string;
  body: string;
  city: string;
  date: string; // ISO
  signerName: string;
  signerRole: string;
  signatureImage?: string | null; // data URL or public URL of the saved signature
}


const PRIMARY = [234, 88, 12] as const; // orange-600
const TEXT = [38, 38, 38] as const; // neutral-800
const MUTED = [115, 115, 115] as const; // neutral-500

export function generateOficioPDF(data: OficioPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // ===== HEADER BAND =====
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, 0, pageW, 32, "F");

  // Logo (left)
  let textStartX = margin;
  if (data.institutionLogo) {
    try {
      const size = 22;
      doc.addImage(data.institutionLogo, "AUTO", margin, 5, size, size);
      textStartX = margin + size + 5;
    } catch (e) {
      console.warn("logo failed", e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.institutionName.toUpperCase(), textStartX, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let metaY = 19;
  if (data.institutionCnpj) {
    doc.text(`CNPJ: ${data.institutionCnpj}`, textStartX, metaY);
    metaY += 4;
  }
  if (data.institutionAddress) {
    const addrLines = doc.splitTextToSize(data.institutionAddress, contentW - (textStartX - margin) - 5);
    doc.text(addrLines.slice(0, 2), textStartX, metaY);
  }

  // ===== OFICIO NUMBER + DATE =====
  let y = 48;
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Ofício Nº ${data.oficioNumber}`, margin, y);

  const dateStr = format(new Date(data.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.setFont("helvetica", "normal");
  doc.text(`${data.city}, ${dateStr}`, pageW - margin, y, { align: "right" });

  // separator
  y += 4;
  doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);

  // ===== RECIPIENT =====
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  if (data.recipientTitle) {
    doc.text(data.recipientTitle, margin, y);
    y += 5;
  }
  doc.text(data.recipientName, margin, y);
  y += 5;
  if (data.recipientOrg) {
    doc.setFont("helvetica", "normal");
    const orgLines = doc.splitTextToSize(data.recipientOrg, contentW);
    doc.text(orgLines, margin, y);
    y += orgLines.length * 5;
  }

  // ===== SUBJECT =====
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const subjectLabel = "Assunto: ";
  const subjectLabelW = doc.getTextWidth(subjectLabel);
  doc.text(subjectLabel, margin, y);
  doc.setFont("helvetica", "normal");
  const subjectLines = doc.splitTextToSize(data.subject, contentW - subjectLabelW);
  doc.text(subjectLines, margin + subjectLabelW, y);
  y += subjectLines.length * 5;

  // ===== BODY =====
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  const paragraphs = data.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lineHeight = 6;

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, contentW);
    for (const line of lines) {
      if (y > pageH - 50) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y, { align: "justify", maxWidth: contentW });
      y += lineHeight;
    }
    y += 3;
  }

  // ===== SIGNATURE =====
  if (y > pageH - 45) {
    doc.addPage();
    y = margin + 10;
  } else {
    y = Math.max(y + 20, pageH - 50);
  }

  const sigCenter = pageW / 2;
  doc.setDrawColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.setLineWidth(0.3);
  doc.line(sigCenter - 40, y, sigCenter + 40, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.signerName, sigCenter, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(data.signerRole, sigCenter, y, { align: "center" });

  // ===== FOOTER BAND =====
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(data.institutionName, margin, pageH - 4);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageW - margin,
    pageH - 4,
    { align: "right" }
  );

  return doc;
}
