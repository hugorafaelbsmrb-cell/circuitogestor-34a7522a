import { supabase } from '@/integrations/supabase/client';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ContractPrintView } from '@/components/enrollment/ContractPrintView';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ContractPDFData {
  contractId: string;
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  schoolLogo?: string;
  schoolSignatureUrl?: string | null;
  schoolRepresentativeName?: string | null;
  guardianName: string;
  guardianCpf: string;
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
  signatureImage?: string | null;
  signedAt?: string | null;
  signatureHash?: string | null;
}

/**
 * Generates a contract PDF by converting ContractPrintView HTML, uploads it to Supabase Storage,
 * and returns the public URL.
 */
export async function generateAndUploadContractPDF(data: ContractPDFData): Promise<string> {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '210mm'; // A4 width
  document.body.appendChild(container);

  try {
    // Render the ContractPrintView component
    const root = createRoot(container);
    await new Promise<void>((resolve) => {
      root.render(React.createElement(ContractPrintView, { content: data }));
      // Wait for rendering to complete
      setTimeout(resolve, 500);
    });

    // Configure html2pdf options
    const options = {
      margin: [8, 10, 8, 10], // mm: top, right, bottom, left
      filename: 'contrato.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Generate PDF blob
    const pdfBlob = await html2pdf()
      .set(options)
      .from(container.firstChild)
      .outputPdf('blob');
  
    // Create a safe filename
    const studentNameSafe = data.studentName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_');
    
    const timestamp = Date.now();
    const fileName = `contratos/contrato_${studentNameSafe}_${timestamp}.pdf`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('system-branding')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw new Error('Erro ao fazer upload do PDF do contrato');
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('system-branding')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } finally {
    // Cleanup: remove temporary container
    document.body.removeChild(container);
  }
}
