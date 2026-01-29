import { FileCheck } from 'lucide-react';
import ReportApprovalTab from '@/components/teachers/ReportApprovalTab';

export default function PedagogicalAnalysis() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise Pedagógica</h1>
          <p className="text-muted-foreground">
            Revise e aprove relatórios de alunos antes de liberá-los para o portal de acompanhamento familiar
          </p>
        </div>
      </div>

      <ReportApprovalTab />
    </div>
  );
}
