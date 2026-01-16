import { forwardRef } from 'react';
import { format } from 'date-fns';
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
  gradeLevel?: { id: string; label: string; description: string } | null;
  installments: number;
  installmentValue: number;
  totalValue: number;
  clauses: { title: string; content: string }[];
  createdAt: string;
  city?: string;
}

interface ContractPrintViewProps {
  content: ContractContent;
}

export const ContractPrintView = forwardRef<HTMLDivElement, ContractPrintViewProps>(
  ({ content }, ref) => {
    return (
      <div 
        ref={ref} 
        className="bg-white text-black p-8 max-w-4xl mx-auto print:p-4"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold mb-2">
            CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS – {content.schoolName?.toUpperCase() || 'CIRCUITO KIDS'}
          </h1>
        </div>

        {/* Parties */}
        <div className="mb-6 text-justify leading-relaxed text-sm">
          <p className="mb-4">Pelo presente instrumento particular, de um lado:</p>
          
          <p className="mb-4">
            <strong>CONTRATADA:</strong> {content.schoolName || 'CIRCUITO KIDS'}, pessoa jurídica de direito privado, 
            inscrita no CNPJ nº {content.schoolCnpj || '____________________'}, 
            com sede à {content.schoolAddress || '__________________________________________________'}.
          </p>
          
          <p className="mb-4">
            <strong>CONTRATANTE:</strong> {content.guardianName || '___________________________________________'}, 
            responsável legal pelo(a) aluno(a) {content.studentName || '___________________________________________'}, 
            CPF nº {content.guardianCpf || '____________________'}
            {content.guardianRg && `, RG nº ${content.guardianRg}`}.
          </p>
          
          <p className="mb-4">
            As partes resolvem celebrar o presente contrato nos termos do ECA (Lei nº 8.069/90) e da LGPD 
            (Lei nº 13.709/18), conforme as cláusulas abaixo:
          </p>
        </div>

        {/* Clauses */}
        <div className="mb-6 text-sm">
          {content.clauses.map((clause, index) => (
            <div key={index} className="mb-4">
              <p className="font-bold">CLÁUSULA {index + 1}ª – {clause.title.toUpperCase()}</p>
              <p className="text-justify leading-relaxed">{clause.content}</p>
            </div>
          ))}
        </div>

        {/* Signature Section */}
        <div className="mt-8 text-sm">
          <p className="mb-8">
            Local e data: {content.city || '___________________________________________'}
          </p>

          <div className="flex justify-between mt-12">
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold">{content.schoolName || 'CIRCUITO KIDS'} (CONTRATADA)</p>
              </div>
            </div>
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold">RESPONSÁVEL LEGAL (CONTRATANTE)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Break for Annex */}
        <div className="page-break-before mt-12 pt-8 border-t-2 border-dashed border-gray-400">
          <h2 className="text-lg font-bold text-center mb-6">ANEXOS DO CONTRATO</h2>

          {/* Annex I */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">ANEXO I – REFORÇO ESCOLAR (1 A 5 ANOS)</h3>
            <ul className="list-disc ml-6 text-sm space-y-1">
              <li>Modalidade: Plano Semestral (06 meses)</li>
              <li>Opções de Frequência e Valores:</li>
            </ul>
            <table className="mt-2 ml-6 text-sm border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">Frequência</th>
                  <th className="border border-gray-300 px-4 py-2">Valor Mensal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-1">2x na semana</td>
                  <td className="border border-gray-300 px-4 py-1">R$ 200,00</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-1">3x na semana</td>
                  <td className="border border-gray-300 px-4 py-1">R$ 250,00</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-1">5x na semana</td>
                  <td className="border border-gray-300 px-4 py-1">R$ 300,00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Annex II */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">ANEXO II – ROBÓTICA EDUCACIONAL</h3>
            <ul className="list-disc ml-6 text-sm space-y-1">
              <li>Frequência: 02 vezes na semana</li>
              <li>Plano: Anual (12 meses)</li>
              <li>Valor Mensal: R$ 250,00</li>
            </ul>
          </div>

          {/* Annex III */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">ANEXO III – SOROBAN (ÁBACO JAPONÊS)</h3>
            <ul className="list-disc ml-6 text-sm space-y-1">
              <li>Frequência: 02 vezes na semana</li>
              <li>Duração: Estimada em 18 meses (10 níveis no total)</li>
              <li>Valor Mensal: R$ 250,00</li>
              <li>Material Didático (obrigatório): consultar valores</li>
            </ul>
          </div>

          {/* Contracted Course */}
          {content.courseName && (
            <div className="mb-6 p-4 border border-gray-300 rounded bg-gray-50">
              <h3 className="font-bold mb-2">MODALIDADE CONTRATADA:</h3>
              <ul className="list-disc ml-6 text-sm space-y-1">
                <li>Curso: {content.courseName}</li>
                <li>Turma: {content.classGroupName || '-'}</li>
                <li>Horário: {content.schedule || '-'}</li>
                <li>Duração: {content.courseDuration || '-'}</li>
                <li>Valor Mensal: R$ {content.installmentValue?.toFixed(2).replace('.', ',') || '-'}</li>
                <li>Número de Parcelas: {content.installments}x</li>
                <li>Valor Total: R$ {content.totalValue?.toFixed(2).replace('.', ',') || '-'}</li>
              </ul>
            </div>
          )}

          {/* Signature on Annex */}
          <div className="flex justify-between mt-12">
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold text-sm">{content.schoolName || 'CIRCUITO KIDS'} (CONTRATADA)</p>
              </div>
            </div>
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold text-sm">RESPONSÁVEL LEGAL (CONTRATANTE)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ContractPrintView.displayName = 'ContractPrintView';
