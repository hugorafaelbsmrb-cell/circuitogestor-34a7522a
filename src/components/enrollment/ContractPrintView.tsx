import { forwardRef } from 'react';

interface LMSCredentials {
  email: string;
  password: string;
  matricula: string;
}

interface ContractContent {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  schoolLogo?: string;
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
  gradeLevel?: { id: string; label: string; description: string } | null;
  installments: number;
  installmentValue: number;
  totalValue: number;
  clauses: { title: string; content: string }[];
  createdAt: string;
  city?: string;
  lmsCredentials?: LMSCredentials | null;
}

interface ContractPrintViewProps {
  content: ContractContent;
}

export const ContractPrintView = forwardRef<HTMLDivElement, ContractPrintViewProps>(
  ({ content }, ref) => {
    return (
      <div ref={ref} className="bg-white text-black">
        {/* Estilos de impressão inline */}
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 15mm 15mm 15mm 15mm;
            }
            .contract-page {
              page-break-after: always;
              page-break-inside: avoid;
            }
            .annex-page {
              page-break-before: always;
            }
          }
        `}</style>

        {/* PÁGINA 1 - CONTRATO */}
        <div className="contract-page" style={{ fontFamily: 'Times New Roman, serif' }}>
          {/* Cabeçalho com Logo */}
          <div className="text-center mb-4">
            {content.schoolLogo && (
              <div style={{ marginBottom: '8px' }}>
                <img 
                  src={content.schoolLogo} 
                  alt="Logo da escola" 
                  style={{ 
                    maxHeight: '60px', 
                    maxWidth: '200px', 
                    margin: '0 auto',
                    display: 'block'
                  }} 
                />
              </div>
            )}
            <h1 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '8px' }}>
              CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS
            </h1>
            <p style={{ fontSize: '12pt', fontWeight: 'bold' }}>
              {content.schoolName?.toUpperCase() || 'CIRCUITO KIDS'}
            </p>
          </div>

          {/* Partes */}
          <div style={{ fontSize: '11pt', lineHeight: '1.4', textAlign: 'justify', marginBottom: '12px' }}>
            <p style={{ marginBottom: '8px' }}>Pelo presente instrumento particular, de um lado:</p>
            
            <p style={{ marginBottom: '8px' }}>
              <strong>CONTRATADA:</strong> {content.schoolName || 'CIRCUITO KIDS'}, pessoa jurídica de direito privado, 
              inscrita no CNPJ nº {content.schoolCnpj || '____________________'}, 
              com sede à {content.schoolAddress || '__________________________________________________'}.
            </p>
            
            <p style={{ marginBottom: '8px' }}>
              <strong>CONTRATANTE:</strong> {content.guardianName || '___________________________________________'}, 
              responsável legal pelo(a) aluno(a) <strong>{content.studentName || '___________________________________________'}</strong>, 
              CPF nº {content.guardianCpf || '____________________'}
              {content.guardianRg && `, RG nº ${content.guardianRg}`}.
            </p>
            
            <p style={{ marginBottom: '8px' }}>
              As partes resolvem celebrar o presente contrato nos termos do ECA (Lei nº 8.069/90) e da LGPD 
              (Lei nº 13.709/18), conforme as cláusulas abaixo:
            </p>
          </div>

          {/* Cláusulas */}
          <div style={{ fontSize: '10pt', lineHeight: '1.3' }}>
            {content.clauses.map((clause, index) => (
              <div key={index} style={{ marginBottom: '6px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                  CLÁUSULA {index + 1}ª – {clause.title.toUpperCase()}
                </p>
                <p style={{ textAlign: 'justify' }}>{clause.content}</p>
              </div>
            ))}
          </div>

          {/* Assinaturas */}
          <div style={{ fontSize: '11pt', marginTop: '20px' }}>
            <p style={{ marginBottom: '30px' }}>
              Local e data: {content.city || '___________________________________________'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{content.schoolName || 'CIRCUITO KIDS'}</p>
                  <p style={{ fontSize: '9pt' }}>(CONTRATADA)</p>
                </div>
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{content.guardianName || 'RESPONSÁVEL LEGAL'}</p>
                  <p style={{ fontSize: '9pt' }}>(CONTRATANTE)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PÁGINA 2 - ANEXOS */}
        <div className="annex-page" style={{ fontFamily: 'Times New Roman, serif' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px' }}>
            ANEXOS DO CONTRATO
          </h2>

          {/* Anexo I */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO I – REFORÇO ESCOLAR (1º A 5º ANO)
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Modalidade: Plano Semestral (06 meses)</li>
              <li>Opções de Frequência e Valores:</li>
            </ul>
            <table style={{ fontSize: '10pt', marginLeft: '20px', marginTop: '4px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 12px' }}>Frequência</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 12px' }}>Valor Mensal</th>
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
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO II – ROBÓTICA EDUCACIONAL
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Frequência: 02 vezes na semana</li>
              <li>Plano: Anual (12 meses)</li>
              <li>Valor Mensal: R$ 250,00</li>
            </ul>
          </div>

          {/* Anexo III */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '4px' }}>
              ANEXO III – SOROBAN (ÁBACO JAPONÊS)
            </h3>
            <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Frequência: 02 vezes na semana</li>
              <li>Duração: Estimada em 18 meses (10 níveis no total)</li>
              <li>Valor Mensal: R$ 250,00</li>
              <li>Material Didático (obrigatório): consultar valores</li>
            </ul>
          </div>

          {/* Modalidade Contratada */}
          {content.courseName && (
            <div style={{ 
              marginBottom: '12px', 
              padding: '12px', 
              border: '2px solid #374151', 
              borderRadius: '4px',
              backgroundColor: '#f9fafb'
            }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '6px' }}>
                ✓ MODALIDADE CONTRATADA:
              </h3>
              <ul style={{ fontSize: '10pt', marginLeft: '20px', listStyleType: 'disc' }}>
                <li><strong>Curso:</strong> {content.courseName}</li>
                <li><strong>Turma:</strong> {content.classGroupName || '-'}</li>
                <li><strong>Horário:</strong> {content.schedule || '-'}</li>
                <li><strong>Duração:</strong> {content.courseDuration || '-'}</li>
                <li><strong>Valor Mensal:</strong> R$ {content.installmentValue?.toFixed(2).replace('.', ',') || '-'}</li>
                <li><strong>Número de Parcelas:</strong> {content.installments}x</li>
                <li><strong>Valor Total:</strong> R$ {content.totalValue?.toFixed(2).replace('.', ',') || '-'}</li>
              </ul>
            </div>
          )}

          {/* Credenciais LMS */}
          {content.lmsCredentials && (
            <div style={{ 
              marginBottom: '12px', 
              padding: '12px', 
              border: '2px solid #2563eb', 
              borderRadius: '4px',
              backgroundColor: '#eff6ff'
            }}>
              <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '6px', color: '#1e40af' }}>
                🖥️ ACESSO À PLATAFORMA DE ENSINO (LMS)
              </h3>
              <p style={{ fontSize: '10pt', marginBottom: '8px', color: '#374151' }}>
                O aluno terá acesso à plataforma online de ensino com os seguintes dados:
              </p>
              <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                <ul style={{ fontSize: '10pt', listStyleType: 'none', margin: 0, padding: 0 }}>
                  <li style={{ marginBottom: '4px' }}><strong>Matrícula:</strong> {content.lmsCredentials.matricula}</li>
                  <li style={{ marginBottom: '4px' }}><strong>E-mail de acesso:</strong> {content.lmsCredentials.email}</li>
                  <li><strong>Senha inicial:</strong> {content.lmsCredentials.password}</li>
                </ul>
              </div>
              <p style={{ fontSize: '9pt', marginTop: '8px', color: '#6b7280', fontStyle: 'italic' }}>
                * Recomendamos alterar a senha no primeiro acesso. Guarde estas informações em local seguro.
              </p>
            </div>
          )}

          {/* Assinaturas do Anexo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{content.schoolName || 'CIRCUITO KIDS'}</p>
                <p style={{ fontSize: '9pt' }}>(CONTRATADA)</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid black', paddingTop: '4px' }}>
                <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{content.guardianName || 'RESPONSÁVEL LEGAL'}</p>
                <p style={{ fontSize: '9pt' }}>(CONTRATANTE)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ContractPrintView.displayName = 'ContractPrintView';
