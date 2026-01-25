import { supabase } from '@/integrations/supabase/client';
import { generateContractPDF } from './pdfGenerator';

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
 * Generates a contract PDF using jsPDF, uploads it to Supabase Storage,
 * and returns the public URL.
 */
export async function generateAndUploadContractPDF(data: ContractPDFData): Promise<string> {
  // Generate the PDF using the existing generator
  const doc = generateContractPDF(data);
  
  // Convert to blob
  const pdfBlob = doc.output('blob');
  
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
}
