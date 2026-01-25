import { forwardRef } from 'react';
import sorobanSyllabus from '@/assets/soroban-syllabus.jpg';

interface LMSCredentials {
  email: string;
  password: string;
  matricula: string;
}

interface SorobanCredentials {
  email: string;
  password: string;
  matricula: string;
  level?: number;
}

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
  gradeLevel?: { id: string; label: string; description: string } | null;
  contractDuration?: number;
  contractDurationLabel?: string;
  installments: number;
  installmentValue: number;
  totalValue: number;
  clauses: { title: string; content: string }[];
  createdAt: string;
  city?: string;
  lmsCredentials?: LMSCredentials | null;
  sorobanCredentials?: SorobanCredentials | null;
  // Digital signature fields
  signatureImage?: string | null;
  signedAt?: string | null;
  signatureHash?: string | null;
}

interface ContractPrintViewProps {
  content: ContractContent;
}

export const ContractPrintView = forwardRef<HTMLDivElement, ContractPrintViewProps>(
  ({ content }, ref) => {
    // Extrair cidade do endereço da escola (último item antes do CEP ou último item)
    const extractCity = (address: string) => {
      if (!address) return 'Marabá - PA';
      // Tenta encontrar padrão "Cidade - UF" ou pega a cidade do endereço
      const parts = address.split('-').map(p => p.trim());
      if (parts.length >= 2) {
        // Pega os dois últimos elementos (cidade e estado)
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];
        // Se o último parece ser um estado (2 letras), usa cidade - estado
        if (lastPart.length === 2 || lastPart.match(/^[A-Z]{2}$/i)) {
          return `${secondLastPart} - ${lastPart.toUpperCase()}`;
        }
        return lastPart;
      }
      return 'Marabá - PA';
    };

    // Formatar data do contrato
    const formatContractDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
      } catch {
        return new Date().toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
      }
    };

    const city = content.city || extractCity(content.schoolAddress);
    const formattedDate = formatContractDate(content.createdAt);

    return (
      <div ref={ref} className="contract-print-container bg-white text-black">
        {/* Estilos de impressão inline - sobrescreve print.css para contratos */}
        <style>{`
          .contract-print-container,
          .contract-print-container * {
            font-family: 'Times New Roman', serif !important;
            color: black !important;
            background: white !important;
          }
          .contract-print-container p,
          .contract-print-container h1,
          .contract-print-container h2,
          .contract-print-container h3,
          .contract-print-container li,
          .contract-print-container td,
          .contract-print-container th {
            margin: 0;
            padding: 0;
          }
          /* Quebra de página para visualização */
          .contract-page {
            min-height: 297mm;
            box-sizing: border-box;
            padding-bottom: 10mm;
            border-bottom: 2px dashed #ccc;
            margin-bottom: 10mm;
          }
          .annex-page {
            min-height: 297mm;
            box-sizing: border-box;
            padding-top: 5mm;
          }
          @media print {
            @page {
              size: A4;
              margin: 8mm 10mm 8mm 10mm;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            .contract-print-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .contract-page {
              page-break-after: always;
              min-height: auto;
              border-bottom: none;
              margin-bottom: 0;
            }
            .annex-page {
              page-break-before: always;
              min-height: auto;
              padding-top: 0;
            }
            /* Desativa estilos globais de print.css para contratos */
            .contract-print-container p {
              margin: 0 !important;
              orphans: auto !important;
              widows: auto !important;
            }
            .contract-print-container h2 {
              border-bottom: none !important;
              padding-bottom: 0 !important;
            }
            .contract-print-container a::after {
              content: none !important;
            }
          }
        `}</style>

        {/* PÁGINA 1 - CONTRATO */}
        <div className="contract-page" style={{ fontFamily: 'Times New Roman, serif', padding: '5mm 0' }}>
          {/* Cabeçalho com Logo */}
          <div className="text-center" style={{ marginBottom: '12px' }}>
            {content.schoolLogo && (
              <div style={{ marginBottom: '8px' }}>
                <img 
                  src={content.schoolLogo} 
                  alt="Logo da escola" 
                  style={{ 
                    maxHeight: '50px', 
                    maxWidth: '180px', 
                    margin: '0 auto',
                    display: 'block'
                  }} 
                />
              </div>
            )}
            <h1 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '4px' }}>
              CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS
            </h1>
            <p style={{ fontSize: '11pt', fontWeight: 'bold', margin: 0 }}>
              {content.schoolName?.toUpperCase() || 'CIRCUITO KIDS'}
            </p>
          </div>

          {/* Partes do contrato */}
          <div style={{ fontSize: '10pt', lineHeight: '1.5', textAlign: 'justify', marginBottom: '12px' }}>
            <p style={{ marginBottom: '8px' }}>Pelo presente instrumento particular, de um lado:</p>
            
            <p style={{ marginBottom: '8px' }}>
              <strong>CONTRATADA:</strong> {content.schoolName || 'CIRCUITO KIDS'}, CNPJ nº {content.schoolCnpj || '____________________'}, {content.schoolAddress || '__________________________________________________'}.
            </p>
            
            <p style={{ marginBottom: '8px' }}>
              <strong>CONTRATANTE:</strong> {content.guardianName || '___________________________________________'}, 
              responsável pelo(a) aluno(a) <strong>{content.studentName || '___________________________________________'}</strong>
              {content.studentSex && `, sexo ${content.studentSex === 'M' ? 'masculino' : 'feminino'}`}
              {content.studentAge !== null && content.studentAge !== undefined && `, ${content.studentAge} anos`}, 
              CPF nº {content.guardianCpf || '____________________'}.
            </p>
            
            <p style={{ margin: 0 }}>
              As partes celebram o presente contrato nos termos do ECA (Lei nº 8.069/90) e da LGPD (Lei nº 13.709/18):
            </p>
          </div>

          {/* Cláusulas */}
          <div style={{ fontSize: '9pt', lineHeight: '1.4' }}>
            {content.clauses.map((clause, index) => (
              <div key={index} style={{ marginBottom: '6px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '9pt' }}>
                  CLÁUSULA {index + 1}ª – {clause.title.toUpperCase()}
                </p>
                <p style={{ textAlign: 'justify', margin: 0 }}>{clause.content}</p>
              </div>
            ))}
          </div>

          {/* Local, Data e Assinaturas */}
          <div style={{ fontSize: '10pt', marginTop: '20px' }}>
            <p style={{ marginBottom: '20px' }}>
              {city}, {formattedDate}.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                {content.schoolSignatureUrl ? (
                  <div>
                    <img 
                      src={content.schoolSignatureUrl} 
                      alt="Assinatura da contratada" 
                      style={{ 
                        maxHeight: '50px', 
                        maxWidth: '180px', 
                        margin: '0 auto 4px',
                        display: 'block'
                      }} 
                    />
                    <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>{content.schoolRepresentativeName || content.schoolName || 'CIRCUITO KIDS'}</p>
                      <p style={{ fontSize: '9pt', margin: 0 }}>(CONTRATADA)</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>{content.schoolName || 'CIRCUITO KIDS'}</p>
                    <p style={{ fontSize: '9pt', margin: 0 }}>(CONTRATADA)</p>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                {content.signatureImage ? (
                  <div>
                    <img 
                      src={content.signatureImage} 
                      alt="Assinatura digital" 
                      style={{ 
                        maxHeight: '50px', 
                        maxWidth: '180px', 
                        margin: '0 auto 4px',
                        display: 'block'
                      }} 
                    />
                    <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>{content.guardianName || 'RESPONSÁVEL LEGAL'}</p>
                      <p style={{ fontSize: '9pt', margin: 0 }}>(CONTRATANTE)</p>
                      {content.signedAt && (
                        <p style={{ fontSize: '8pt', margin: '2px 0 0', color: '#666' }}>
                          Assinado em {new Date(content.signedAt).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>{content.guardianName || 'RESPONSÁVEL LEGAL'}</p>
                    <p style={{ fontSize: '9pt', margin: 0 }}>(CONTRATANTE)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Hash de verificação do documento */}
            {content.signatureHash && (
              <div style={{ marginTop: '10px', fontSize: '8pt', color: '#888', textAlign: 'center' }}>
                <p style={{ margin: 0 }}>Verificação: {content.signatureHash.substring(0, 20)}...</p>
              </div>
            )}
          </div>
        </div>

        {/* PÁGINA 2 - ANEXOS */}
        <div className="annex-page" style={{ fontFamily: 'Times New Roman, serif', padding: '2mm 0' }}>
          {/* Logo no topo dos anexos */}
          {content.schoolLogo && (
            <div className="text-center" style={{ marginBottom: '6px' }}>
              <img 
                src={content.schoolLogo} 
                alt="Logo da escola" 
                style={{ 
                  maxHeight: '40px', 
                  maxWidth: '150px', 
                  margin: '0 auto',
                  display: 'block'
                }} 
              />
            </div>
          )}
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '12px' }}>
            ANEXOS DO CONTRATO
          </h2>

          {/* Anexo I */}
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO I – REFORÇO ESCOLAR (1º A 5º ANO)
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc', lineHeight: '1.4' }}>
              <li>Modalidade: Plano Semestral (06 meses)</li>
              <li>Opções de Frequência e Valores:</li>
            </ul>
            <table style={{ fontSize: '10pt', marginLeft: '20px', marginTop: '4px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ border: '1px solid #d1d5db', padding: '3px 12px' }}>Frequência</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '3px 12px' }}>Valor Mensal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>2x na semana</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>R$ 200,00</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>3x na semana</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>R$ 250,00</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>5x na semana</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px 12px' }}>R$ 300,00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Anexo II */}
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO II – ROBÓTICA EDUCACIONAL
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc', lineHeight: '1.4' }}>
              <li>Frequência: 02 vezes na semana</li>
              <li>Plano: Anual (12 meses)</li>
              <li>Valor Mensal: R$ 250,00</li>
            </ul>
          </div>

          {/* Anexo III */}
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO III – SOROBAN (ÁBACO JAPONÊS)
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc', lineHeight: '1.4' }}>
              <li>Frequência: 02 vezes na semana</li>
              <li>Duração: Estimada em 18 meses (10 níveis no total)</li>
              <li>Valor Mensal: R$ 250,00</li>
              <li>Material Didático (obrigatório): consultar valores</li>
            </ul>
          </div>

          {/* Modalidade Contratada */}
          {content.courseName && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '10px', 
              border: '2px solid #374151', 
              borderRadius: '4px',
              backgroundColor: '#f9fafb'
            }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '6px' }}>
                ✓ MODALIDADE CONTRATADA:
              </h3>
              <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc', lineHeight: '1.5' }}>
                <li><strong>Curso:</strong> {content.courseName}</li>
                <li><strong>Turma:</strong> {content.classGroupName || '-'}</li>
                <li><strong>Horário:</strong> {content.schedule || '-'}</li>
                <li><strong>Duração do Contrato:</strong> {content.contractDurationLabel || `${content.installments} meses`}</li>
                <li><strong>Valor Mensal:</strong> R$ {content.installmentValue?.toFixed(2).replace('.', ',') || '-'}</li>
                <li><strong>Número de Parcelas:</strong> {content.installments}x</li>
                <li><strong>Valor Total:</strong> R$ {content.totalValue?.toFixed(2).replace('.', ',') || '-'}</li>
              </ul>
            </div>
          )}

          {/* Credenciais LMS */}
          {content.lmsCredentials && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '10px', 
              border: '2px solid #2563eb', 
              borderRadius: '4px',
              backgroundColor: '#eff6ff'
            }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px', color: '#1e40af' }}>
                🖥️ ACESSO À PLATAFORMA DE ENSINO (LMS)
              </h3>
              <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                <ul style={{ fontSize: '10pt', listStyleType: 'none', margin: 0, padding: 0, lineHeight: '1.5' }}>
                  <li style={{ marginBottom: '2px' }}><strong>Matrícula:</strong> {content.lmsCredentials.matricula}</li>
                  <li style={{ marginBottom: '2px' }}><strong>E-mail:</strong> {content.lmsCredentials.email}</li>
                  <li><strong>Senha:</strong> {content.lmsCredentials.password}</li>
                </ul>
              </div>
              <p style={{ fontSize: '9pt', marginTop: '4px', color: '#6b7280', fontStyle: 'italic' }}>
                * Altere a senha no primeiro acesso.
              </p>
            </div>
          )}

          {/* Credenciais Soroban */}
          {content.sorobanCredentials && (
            <div style={{ 
              marginBottom: '10px', 
              padding: '10px', 
              border: '2px solid #d97706', 
              borderRadius: '4px',
              backgroundColor: '#fffbeb'
            }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px', color: '#b45309' }}>
                🧮 ACESSO À PLATAFORMA SOROBAN
              </h3>
              <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                <ul style={{ fontSize: '10pt', listStyleType: 'none', margin: 0, padding: 0, lineHeight: '1.5' }}>
                  <li style={{ marginBottom: '2px' }}><strong>Matrícula:</strong> {content.sorobanCredentials.matricula}</li>
                  <li style={{ marginBottom: '2px' }}><strong>E-mail:</strong> {content.sorobanCredentials.email}</li>
                  <li style={{ marginBottom: '2px' }}><strong>Senha:</strong> {content.sorobanCredentials.password}</li>
                  <li><strong>Nível:</strong> {content.sorobanCredentials.level || 1}</li>
                </ul>
              </div>
              <p style={{ fontSize: '9pt', marginTop: '4px', color: '#6b7280', fontStyle: 'italic' }}>
                * Altere a senha no primeiro acesso.
              </p>
            </div>
          )}

        </div>

        {/* PÁGINA 3 - SYLLABUS SOROBAN (apenas para alunos Soroban) */}
        {content.sorobanCredentials && (
          <div className="annex-page" style={{ fontFamily: 'Times New Roman, serif', padding: '5mm 0' }}>
            {/* Logo no topo do syllabus */}
            {content.schoolLogo && (
              <div className="text-center" style={{ marginBottom: '12px' }}>
                <img 
                  src={content.schoolLogo} 
                  alt="Logo da escola" 
                  style={{ 
                    maxHeight: '50px', 
                    maxWidth: '180px', 
                    margin: '0 auto',
                    display: 'block'
                  }} 
                />
              </div>
            )}
            <h2 style={{ fontSize: '16pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px' }}>
              GRADE CURRICULAR - SOROBAN
            </h2>
            <div style={{ textAlign: 'center' }}>
              <img 
                src={sorobanSyllabus} 
                alt="Syllabus Soroban - Comparativo Abacus Book vs Anzan Book" 
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }} 
              />
            </div>
            <div style={{ marginTop: '20px', fontSize: '11pt', color: '#6b7280', textAlign: 'center' }}>
              <p>Este documento apresenta a progressão dos níveis do curso de Soroban.</p>
              <p style={{ fontStyle: 'italic', marginTop: '8px' }}>díg = dígitos | lin = linhas | Mult = multiplicação | Div = divisão</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ContractPrintView.displayName = 'ContractPrintView';
