import { supabase } from '@/integrations/supabase/client';
import { generateContractPDF } from './pdfGenerator';
import { preloadContractImages } from './imageLoader';

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
 * Generates a contract PDF using jsPDF with pre-loaded images (reliable programmatic generation),
 * uploads it to Supabase Storage, and returns the public URL.
 */
export async function generateAndUploadContractPDF(data: ContractPDFData): Promise<string> {
  console.log('Starting PDF generation with jsPDF...');
  
  // Pre-load all images as base64 to ensure they're embedded in the PDF
  const preloadedImages = await preloadContractImages({
    schoolLogo: data.schoolLogo,
    schoolSignatureUrl: data.schoolSignatureUrl,
    signatureImage: data.signatureImage,
  });
  
  console.log('Images preloaded for PDF generation');
  
  // Generate PDF using the robust jsPDF implementation with pre-loaded images
  const doc = generateContractPDF({
    schoolName: data.schoolName,
    schoolCnpj: data.schoolCnpj,
    schoolAddress: data.schoolAddress,
    schoolLogo: preloadedImages.schoolLogo || undefined,
    schoolSignatureUrl: preloadedImages.schoolSignatureUrl,
    schoolRepresentativeName: data.schoolRepresentativeName,
    guardianName: data.guardianName,
    guardianCpf: data.guardianCpf,
    guardianRg: undefined,
    guardianAddress: data.guardianAddress,
    studentName: data.studentName,
    studentBirthDate: data.studentBirthDate,
    studentSex: data.studentSex,
    studentAge: data.studentAge,
    courseName: data.courseName,
    courseDuration: data.courseDuration,
    coursePrice: data.coursePrice,
    classGroupName: data.classGroupName,
    schedule: data.schedule,
    installments: data.installments,
    installmentValue: data.installmentValue,
    totalValue: data.totalValue,
    clauses: data.clauses,
    createdAt: data.createdAt,
    city: data.city,
    contractDurationLabel: data.contractDurationLabel,
    lmsCredentials: data.lmsCredentials,
    sorobanCredentials: data.sorobanCredentials,
    signatureImage: preloadedImages.signatureImage,
    signedAt: data.signedAt,
    signatureHash: data.signatureHash,
  });
  
  // Convert to blob
  const pdfBlob = doc.output('blob');
  console.log('PDF blob generated, size:', pdfBlob.size);

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
  
  console.log('PDF uploaded successfully:', urlData.publicUrl);
  return urlData.publicUrl;
}
