import { forwardRef } from 'react';
import { format } from 'date-fns';
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
  gradeLevel?: { id: string; label: string; description: string } | null;
  installments: number;
  installmentValue: number;
  totalValue: number;
  clauses: { title: string; content: string }[];
  createdAt: string;
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
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{content.schoolName}</h1>
          <p className="text-sm">CNPJ: {content.schoolCnpj}</p>
          <p className="text-sm">{content.schoolAddress}</p>
        </div>

        <h2 className="text-xl font-bold text-center mb-6 uppercase">
          Contrato de Prestação de Serviços Educacionais
        </h2>

        {/* Parties */}
        <div className="mb-6 text-justify leading-relaxed">
          <p className="mb-4">
            Pelo presente instrumento particular, de um lado <strong>{content.schoolName}</strong>, 
            inscrita no CNPJ sob nº {content.schoolCnpj}, com sede em {content.schoolAddress}, 
            doravante denominada <strong>CONTRATADA</strong>, e de outro lado:
          </p>
          <p className="mb-4">
            <strong>{content.guardianName}</strong>, inscrito(a) no CPF sob nº {content.guardianCpf}, 
            residente em {content.guardianAddress}, doravante denominado(a) <strong>CONTRATANTE</strong>, 
            responsável financeiro pelo(a) menor:
          </p>
          <p className="mb-4">
            <strong>{content.studentName}</strong>, nascido(a) em {' '}
            {content.studentBirthDate ? format(new Date(content.studentBirthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-'}, 
            doravante denominado(a) <strong>ALUNO(A)</strong>.
          </p>
        </div>

        {/* Course Info */}
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h3 className="font-bold mb-2">DADOS DO CURSO</h3>
          <p><strong>Curso:</strong> {content.courseName}</p>
          <p><strong>Duração:</strong> {content.courseDuration}</p>
          <p><strong>Turma:</strong> {content.classGroupName}</p>
          {content.gradeLevel && (
            <p><strong>Série:</strong> {content.gradeLevel.label} ({content.gradeLevel.description})</p>
          )}
          <p><strong>Horário:</strong> {content.schedule}</p>
        </div>

        {/* Financial Info */}
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h3 className="font-bold mb-2">DADOS FINANCEIROS</h3>
          <p><strong>Valor da Mensalidade:</strong> R$ {content.installmentValue.toFixed(2).replace('.', ',')}</p>
          <p><strong>Número de Parcelas:</strong> {content.installments}x</p>
          <p><strong>Valor Total:</strong> R$ {content.totalValue.toFixed(2).replace('.', ',')}</p>
        </div>

        {/* Clauses */}
        <div className="mb-6">
          <h3 className="font-bold mb-4 text-center">CLÁUSULAS E CONDIÇÕES</h3>
          {content.clauses.map((clause, index) => (
            <div key={index} className="mb-4">
              <p className="font-bold">CLÁUSULA {index + 1}ª - {clause.title}</p>
              <p className="text-justify leading-relaxed">{clause.content}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12">
          <p className="text-center mb-8">
            E por estarem justas e contratadas, as partes assinam o presente contrato em 2 (duas) vias 
            de igual teor e forma, na presença de 2 (duas) testemunhas.
          </p>
          
          <p className="text-center mb-12">
            {format(new Date(content.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>

          <div className="flex justify-between mt-16">
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold">{content.schoolName}</p>
                <p className="text-sm">CONTRATADA</p>
              </div>
            </div>
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p className="font-bold">{content.guardianName}</p>
                <p className="text-sm">CONTRATANTE</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-12">
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p>Testemunha 1</p>
                <p className="text-sm">CPF:</p>
              </div>
            </div>
            <div className="text-center w-2/5">
              <div className="border-t border-black pt-2">
                <p>Testemunha 2</p>
                <p className="text-sm">CPF:</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ContractPrintView.displayName = 'ContractPrintView';
