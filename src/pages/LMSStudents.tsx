import { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Copy, 
  User,
  BookOpen,
  Trophy,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Unlock,
  RotateCcw,
  Settings,
  Coins,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Printer
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { supabase } from '@/integrations/supabase/client';


interface LMSProgressData {
  status?: string;
  current_module?: string;
  current_level?: string;
  current_lesson?: string;
  completion_percentage?: number;
  total_lessons?: number;
  completed_lessons?: number;
  total_xp?: number;
  coins?: number;
}

interface LMSCredential {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  email: string;
  password: string;
  matricula: string;
  lms_user_id: string | null;
  current_module: string | null;
  current_level: string | null;
  current_lesson: string | null;
  completion_percentage: number;
  last_sync_at: string | null;
  created_at: string;
  progressData?: LMSProgressData;
  student: {
    id: string;
    name: string;
    birth_date: string;
    is_active: boolean;
  } | null;
  enrollment: {
    id: string;
    status: string;
    class_group_id: string;
    enrollment_date: string;
    class_group?: {
      schedule?: {
        day_of_week: string;
      };
    };
  } | null;
  // All class days from all enrollments for this student
  all_class_days?: string[];
  earliest_enrollment_date?: string;
}

export default function LMSStudents() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const [credentials, setCredentials] = useState<LMSCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredential, setSelectedCredential] = useState<LMSCredential | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<LMSCredential | null>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'getCredentials' }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setCredentials(data.data);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do LMS.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncAll = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'syncAll' }
      });

      if (error) throw error;

      toast({
        title: 'Sincronização concluída',
        description: data?.message || 'Dados sincronizados com sucesso.',
      });

      await fetchCredentials();
    } catch (error) {
      console.error('Error syncing:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar com o LMS.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSingle = async (credentialId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: 'syncProgress', credentialId }
      });

      if (error) throw error;

      // Update the selected credential with new progress data
      if (selectedCredential && data?.data) {
        setSelectedCredential({
          ...selectedCredential,
          progressData: data.data,
          current_module: data.data.current_module,
          current_level: data.data.current_level,
          current_lesson: data.data.current_lesson,
          completion_percentage: data.data.completion_percentage,
        });
      }

      toast({
        title: 'Dados atualizados',
        description: data?.message || 'Progresso atualizado com sucesso.',
      });

      await fetchCredentials();
    } catch (error) {
      console.error('Error syncing single:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o progresso.',
        variant: 'destructive',
      });
    }
  };

  // LMS Management Actions - uses matricula (new API)
  const executeLMSAction = async (
    actionName: string, 
    credential: LMSCredential, 
    extraParams: Record<string, string> = {}
  ) => {
    setActionLoading(actionName);
    
    try {
      // New API uses matricula instead of lms_user_id
      const matricula = credential.matricula;
      
      if (!matricula) {
        toast({
          title: 'Erro',
          description: 'Matrícula não encontrada para este aluno.',
          variant: 'destructive',
        });
        return;
      }

      // Normalize params for actions that require UUIDs
      const params: Record<string, string> = { ...extraParams, matricula };

      // For unlockLevel, map to setLevel
      if (actionName === 'unlockLevel') {
        if (params.levelId === 'current') {
          const { data: progressResp, error: progressError } = await supabase.functions.invoke('lms-sync', {
            body: { action: 'syncProgress', credentialId: credential.id }
          });

          if (progressError) throw progressError;

          const currentLevelId = extractIdValue(progressResp?.data?.current_level);
          if (!currentLevelId) {
            toast({
              title: 'Nível indisponível',
              description: 'Não foi possível identificar o nível atual do aluno no LMS. Tente sincronizar o progresso e repetir a ação.',
              variant: 'destructive',
            });
            return;
          }

          params.levelId = currentLevelId;
        }
        // Map unlockLevel to setLevel (new API)
        actionName = 'setLevel';
      }

      if (actionName === 'setLevel' && params.levelId === 'next') {
        toast({
          title: 'Ação não suportada',
          description: 'O LMS exige o ID (UUID) do nível de destino. Por enquanto, esta ação não suporta "próximo" automaticamente.',
          variant: 'destructive',
        });
        return;
      }

      if (actionName === 'setModule' && params.moduleId === 'next') {
        toast({
          title: 'Ação não suportada',
          description: 'O LMS exige o ID (UUID) do módulo de destino. Por enquanto, esta ação não suporta "próximo" automaticamente.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { action: actionName, ...params }
      });

      if (error) throw error;

      toast({
        title: data?.success ? 'Ação executada' : 'Erro na ação',
        description: data?.message || 'Operação concluída.',
        variant: data?.success ? 'default' : 'destructive',
      });

      if (data?.success) {
        await syncSingle(credential.id);
      }
    } catch (error) {
      console.error(`Error executing ${actionName}:`, error);
      toast({
        title: 'Erro',
        description: `Não foi possível executar a ação: ${actionName}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockLevel = (credential: LMSCredential, levelId: string) => {
    executeLMSAction('unlockLevel', credential, { levelId });
  };

  const handleSetModule = (credential: LMSCredential, moduleId: string) => {
    executeLMSAction('setModule', credential, { moduleId });
  };

  const handleSetLevel = (credential: LMSCredential, levelId: string) => {
    executeLMSAction('setLevel', credential, { levelId });
  };

  const handleResetProgress = (credential: LMSCredential) => {
    setConfirmReset(credential);
  };

  const confirmResetProgress = async () => {
    if (!confirmReset) return;
    await executeLMSAction('resetProgress', confirmReset);
    setConfirmReset(null);
  };

  const generatePedagogicalReport = async (credential: LMSCredential) => {
    setReportLoading(credential.id);
    
    try {
      // Use the edge function proxy to call the LMS API securely
      const { data, error } = await supabase.functions.invoke('lms-sync', {
        body: { 
          action: 'getParentReport',
          matricula: credential.matricula,
          format: 'pdf_data'
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao buscar relatório');
      }

      console.log('Report data from API:', data);

      // Check if it's a PDF response
      if (data.isPdf && data.pdfBase64) {
        // Convert base64 to blob and open
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = Array.from({ length: byteCharacters.length }, (_, i) => 
          byteCharacters.charCodeAt(i)
        );
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        window.open(pdfUrl, '_blank');
        
        toast({
          title: 'Relatório gerado!',
          description: 'O PDF foi aberto em uma nova aba.',
        });
        return;
      }

      // Handle JSON response - new structure: { success, student, reports, meta }
      const studentData = data.student || {};
      const reports = data.reports || [];
      const meta = data.meta || {};
      const wasAutoGenerated = meta.auto_generated === true;
      
      const studentName = studentData.full_name || credential.student?.name || 'Aluno';
      const nickname = studentData.nickname || '';
      const currentLevel = studentData.current_level || credential.current_level || 1;
      const totalXp = studentData.total_xp || 0;

      // Helper function to get icon for section
      const getIconForSection = (icon: string) => {
        const icons: Record<string, string> = {
          'book': '📖',
          'award': '🏆',
          'brain': '🧠',
          'activity': '🎯',
          'star': '⭐',
          'globe': '🌍',
          'code': '💻',
          'default': '📋'
        };
        return icons[icon] || icons['default'];
      };

      // Build sections HTML from pdf_sections
      const buildSectionsHtml = (pdfSections: Array<{ key: string; title: string; icon?: string; content?: string; items?: Array<{ code?: string; description?: string } | string> }>) => {
        return pdfSections.map(section => {
          const icon = getIconForSection(section.icon || 'default');
          let contentHtml = '';
          
          if (section.content) {
            contentHtml = `<div class="section-content">${section.content}</div>`;
          } else if (section.items && section.items.length > 0) {
            // Handle both BNCC items (objects) and simple string items
            if (typeof section.items[0] === 'string') {
              contentHtml = `
                <div class="tags-container">
                  ${(section.items as string[]).map(item => `<span class="concept-tag">${item}</span>`).join('')}
                </div>
              `;
            } else {
              contentHtml = `
                <div class="bncc-list">
                  ${(section.items as Array<{ code?: string; description?: string }>).map(item => `
                    <div class="bncc-item">
                      <span class="bncc-code">${item.code || ''}</span>
                      <span class="bncc-desc">${item.description || ''}</span>
                    </div>
                  `).join('')}
                </div>
              `;
            }
          }
          
          return `
            <div class="pdf-section">
              <div class="pdf-section-title">${icon} ${section.title}</div>
              ${contentHtml}
            </div>
          `;
        }).join('');
      };

      const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Pedagógico - ${studentName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; padding: 0; line-height: 1.6; color: #111; }
    .container { max-width: 100%; margin: 0; background: white; }

    /* --- Tela (pré-visualização) --- */
    .header { background: #f58220; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: white; padding: 16px 24px; display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #e06b10; }
    .header-logo { background: white; padding: 6px 10px; border-radius: 6px; flex-shrink: 0; }
    .header-logo img { height: 36px; max-width: 90px; object-fit: contain; display: block; }
    .header-info { flex: 1; }
    .header-title { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .header-student { font-size: 14px; opacity: 0.95; }
    .header-meta { font-size: 11px; opacity: 0.85; margin-top: 4px; }
    .header-meta span { margin-right: 14px; }
    .content { padding: 20px 24px; }
    .level-report { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #ddd; }
    .level-report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #f58220; }
    .level-report-title { font-size: 16px; font-weight: 600; color: #333; }
    .level-report-date { font-size: 11px; color: #666; background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 4px 10px; border-radius: 12px; }
    .pdf-section { margin-bottom: 14px; }
    .pdf-section-title { font-size: 14px; font-weight: 600; color: #f58220; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .section-content { color: #444; font-size: 12px; line-height: 1.7; background: white; padding: 12px; border-radius: 6px; border-left: 3px solid #f58220; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bncc-list { display: flex; flex-direction: column; gap: 6px; }
    .bncc-item { display: flex; gap: 10px; padding: 8px; background: white; border-radius: 6px; align-items: flex-start; border: 1px solid #eee; }
    .bncc-code { background: #fff3e6; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #d35400; font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
    .bncc-desc { color: #444; font-size: 11px; }
    .tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
    .concept-tag { background: #e8f5e9; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #2e7d32; font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 500; }
    .empty-state { text-align: center; padding: 30px 20px; color: #888; }
    .empty-state p { margin-bottom: 8px; }
    .print-btn { display: block; width: 180px; margin: 16px auto; padding: 12px 24px; background: #f58220; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .print-btn:hover { background: #d35400; }
    .meta-info { text-align: center; padding: 12px; background: #f5f5f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #888; font-size: 10px; border-top: 1px solid #eee; }

    /* --- Impressão (limpo, sem “blocos”) --- */
    @media print {
      @page { size: A4; margin: 12mm 12mm 12mm 12mm; }

      html, body { background: #fff !important; color: #000 !important; }
      body { padding: 0 !important; margin: 0 !important; font-size: 10.5pt !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .print-btn { display: none !important; }

      .container { max-width: 100% !important; }
      .content { padding: 8mm 0 0 0 !important; }

      /* Cabeçalho minimalista (sem fundo/caixas) */
      .header {
        background: transparent !important;
        color: #000 !important;
        border-bottom: 1.2pt solid #000 !important;
        padding: 0 0 6mm 0 !important;
        margin: 0 0 0 0 !important;
        gap: 10mm !important;
      }
      .header-logo { background: transparent !important; padding: 0 !important; border-radius: 0 !important; }
      .header-logo img { height: 14mm !important; max-width: 45mm !important; }
      .header-title { color: #000 !important; font-size: 14pt !important; margin: 0 0 1.5mm 0 !important; }
      .header-student { color: #000 !important; font-size: 11pt !important; opacity: 1 !important; }
      .header-meta {
        color: #000 !important;
        opacity: 1 !important;
        font-size: 9.5pt !important;
        margin-top: 2mm !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8mm !important;
      }
      .header-meta span { margin-right: 0 !important; }

      /* Remove cards/cores e usa linhas para separar */
      .level-report { background: transparent !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; margin: 0 0 10mm 0 !important; }
      .level-report-header { border-bottom: 1pt solid #000 !important; padding-bottom: 2.5mm !important; margin-bottom: 4mm !important; }
      .level-report-title { color: #000 !important; font-size: 13pt !important; }
      .level-report-date { background: transparent !important; color: #000 !important; border: 1pt solid #000 !important; padding: 1.5mm 4mm !important; }

      .pdf-section { margin: 0 0 6mm 0 !important; }
      .pdf-section-title { color: #000 !important; font-size: 11pt !important; margin: 0 0 2mm 0 !important; break-after: avoid-page !important; page-break-after: avoid !important; }
      .section-content { background: transparent !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; color: #000 !important; font-size: 10pt !important; }

      .bncc-item { background: transparent !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; }
      .bncc-code { background: transparent !important; color: #000 !important; border: 1pt solid #000 !important; }
      .bncc-desc { color: #000 !important; }
      .concept-tag { background: transparent !important; color: #000 !important; border: 1pt solid #000 !important; }
      .meta-info { background: transparent !important; color: #000 !important; border-top: 1pt solid #000 !important; }

      /* IMPORTANTE: não podemos “travar” o relatório inteiro (level-report/pdf-section) em uma única página,
         senão o navegador empurra o bloco para a próxima folha e a 1ª página fica vazia.
         Mantemos anti-quebra apenas em itens pequenos e nos títulos. */
      .level-report { break-inside: auto !important; page-break-inside: auto !important; }
      .pdf-section { break-inside: auto !important; page-break-inside: auto !important; }
      .bncc-item { break-inside: avoid !important; page-break-inside: avoid !important; }
      .level-report-header, .pdf-section-title { break-after: avoid !important; page-break-after: avoid !important; }
      .section-content { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${branding.logo ? `
        <div class="header-logo">
          <img src="${branding.logo}" alt="Logo" />
        </div>
      ` : ''}
      <div class="header-info">
        <div class="header-title">Relatório Pedagógico</div>
        <div class="header-student">${studentName}${nickname ? ` (${nickname})` : ''}</div>
        <div class="header-meta">
          <span>Matrícula: ${credential.matricula}</span>
          <span>Nível: ${currentLevel}</span>
          <span>XP: ${totalXp}</span>
        </div>
      </div>
    </div>
    
    <div class="content">
      ${reports.length > 0 ? reports.map((report: { id?: string; level_name?: string; generated_at?: string; pdf_sections?: Array<{ key: string; title: string; icon?: string; content?: string; items?: Array<{ code?: string; description?: string } | string> }> }) => `
        <div class="level-report">
          <div class="level-report-header">
            <div class="level-report-title">${report.level_name || 'Relatório de Nível'}</div>
            ${report.generated_at ? `<div class="level-report-date">${new Date(report.generated_at).toLocaleDateString('pt-BR')}</div>` : ''}
          </div>
          ${report.pdf_sections ? buildSectionsHtml(report.pdf_sections) : '<p style="color: #888;">Sem seções disponíveis</p>'}
        </div>
      `).join('') : `
        <div class="empty-state">
          <p>📝 Nenhum relatório pedagógico disponível ainda.</p>
          <p style="font-size: 14px;">Os relatórios serão adicionados conforme o aluno avança nos níveis.</p>
        </div>
      `}
    </div>
    
    <div class="meta-info">
      ${wasAutoGenerated ? '<p style="color: #27ae60; margin-bottom: 4px;">✅ Relatório gerado automaticamente</p>' : ''}
      Relatório gerado em ${new Date().toLocaleString('pt-BR')}
    </div>
    
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir Relatório</button>
  </div>
</body>
</html>`;

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
      
      toast({
        title: 'Relatório gerado!',
        description: 'O relatório pedagógico foi aberto em uma nova aba.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Não foi possível gerar o relatório pedagógico.',
        variant: 'destructive',
      });
    } finally {
      setReportLoading(null);
    }
  };

  const printCredentials = (credential: LMSCredential) => {
    const studentName = credential.student?.name || 'Aluno';
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credenciais - ${studentName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
    .container { max-width: 400px; margin: 0 auto; border: 2px solid #f58220; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f58220 0%, #e06b10 100%); color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 18px; margin-bottom: 4px; }
    .header p { font-size: 12px; opacity: 0.9; }
    .content { padding: 24px; }
    .field { margin-bottom: 20px; }
    .field label { display: block; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .field .value { font-size: 18px; font-weight: 600; color: #333; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #f58220; }
    .password-box { background: #fff3e6 !important; }
    .footer { text-align: center; padding: 16px; background: #f8f9fa; font-size: 11px; color: #888; }
    @media print {
      body { padding: 20px; }
      .container { border: 2px solid #333; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Credenciais de Acesso</h1>
      <p>Circuito Kids - Plataforma de Ensino</p>
    </div>
    
    <div class="content">
      <div class="field">
        <label>Nome do Aluno</label>
        <div class="value">${studentName}</div>
      </div>
      
      <div class="field">
        <label>E-mail / Login</label>
        <div class="value">${credential.email}</div>
      </div>
      
      <div class="field">
        <label>Senha</label>
        <div class="value password-box">${credential.password}</div>
      </div>
      
      <div class="field">
        <label>Matrícula</label>
        <div class="value">${credential.matricula}</div>
      </div>
    </div>
    
    <div class="footer">
      Acesse: <strong>plataforma.circuitokids.com.br</strong>
    </div>
  </div>
  
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const printAllCredentials = () => {
    if (filteredCredentials.length === 0) {
      toast({
        title: 'Nenhum aluno',
        description: 'Não há alunos para imprimir.',
        variant: 'destructive',
      });
      return;
    }

    const cardsHtml = filteredCredentials.map(cred => `
      <div class="card">
        <div class="card-header">
          <div class="student-name">${cred.student?.name || 'Aluno'}</div>
          <div class="matricula">${cred.matricula}</div>
        </div>
        <div class="card-body">
          <div class="field">
            <span class="label">E-mail:</span>
            <span class="value">${cred.email}</span>
          </div>
          <div class="field">
            <span class="label">Senha:</span>
            <span class="value password">${cred.password}</span>
          </div>
        </div>
      </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credenciais - Todos os Alunos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f5f5f5; }
    .header { text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #f58220 0%, #e06b10 100%); color: white; border-radius: 12px; }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e0e0e0; break-inside: avoid; }
    .card-header { background: #f8f9fa; padding: 12px 16px; border-bottom: 1px solid #e0e0e0; border-left: 4px solid #f58220; }
    .student-name { font-weight: 600; font-size: 14px; color: #333; }
    .matricula { font-size: 11px; color: #888; margin-top: 2px; }
    .card-body { padding: 12px 16px; }
    .field { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .field:last-child { margin-bottom: 0; }
    .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 13px; font-weight: 500; color: #333; text-align: right; max-width: 180px; word-break: break-all; }
    .password { background: #fff3e6; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
    .footer { text-align: center; margin-top: 30px; padding: 16px; font-size: 12px; color: #888; }
    .print-btn { display: block; width: 200px; margin: 20px auto; padding: 12px 24px; background: #f58220; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .print-btn:hover { background: #d35400; }
    @media print {
      body { background: white; padding: 10px; }
      .header { margin-bottom: 20px; }
      .print-btn { display: none; }
      .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .card { border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Credenciais de Acesso</h1>
    <p>Circuito Kids - Plataforma de Ensino • ${filteredCredentials.length} alunos</p>
  </div>
  
  <div class="grid">
    ${cardsHtml}
  </div>
  
  <div class="footer">
    Acesse: <strong>plataforma.circuitokids.com.br</strong> • Gerado em ${new Date().toLocaleString('pt-BR')}
  </div>
  
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const filteredCredentials = credentials.filter(cred => 
    cred.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cred.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Map day names in Portuguese to JavaScript day numbers (0 = Sunday, 1 = Monday, etc.)
  const dayNameToNumber: Record<string, number> = {
    'Domingo': 0,
    'Segunda-feira': 1,
    'Terça-feira': 2,
    'Quarta-feira': 3,
    'Quinta-feira': 4,
    'Sexta-feira': 5,
    'Sábado': 6,
  };

  // Calculate expected lesson based on enrollment date and ALL class days of the week
  const calculateExpectedLesson = (enrollmentDate: string | undefined, classDays: string[] | undefined): number => {
    if (!enrollmentDate || !classDays || classDays.length === 0) return 0;
    
    const startDate = new Date(enrollmentDate);
    const today = new Date();
    
    // Convert day names to day numbers
    const targetDayNumbers = classDays
      .map(day => dayNameToNumber[day])
      .filter(num => num !== undefined);
    
    if (targetDayNumbers.length === 0) return 0;
    
    // Count all occurrences of any target day from enrollment to today
    let lessonCount = 0;
    const currentDate = new Date(startDate);
    
    // Iterate through each day from enrollment to today
    while (currentDate <= today) {
      if (targetDayNumbers.includes(currentDate.getDay())) {
        lessonCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return Math.max(1, lessonCount);
  };

  // Helper to safely extract string value from object or string
  function extractStringValue(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      return String(obj.name || obj.title || obj.id || '');
    }
    return String(value);
  }

  // Helper to extract UUID-like id from object or string
  function extractIdValue(value: unknown): string {
    if (!value) return '';

    if (typeof value === 'string') {
      // Only accept UUID-ish strings; otherwise it's probably a name like "Spark"
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(value) ? value : '';
    }

    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const id = obj.id;
      return typeof id === 'string' ? id : '';
    }

    return '';
  }

  // Get the current lesson number from the lesson string or object (e.g., "Aula 5" -> 5)
  function extractLessonNumber(lessonValue: unknown): number {
    const lessonString = extractStringValue(lessonValue);
    if (!lessonString) return 0;
    const match = lessonString.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Calculate progress status
  const getProgressStatus = (currentLesson: number, expectedLesson: number) => {
    if (currentLesson === 0 || expectedLesson === 0) return 'unknown';
    const diff = currentLesson - expectedLesson;
    if (diff >= 0) return 'ahead';
    if (diff >= -2) return 'ontrack';
    return 'behind';
  };

  // Calculate stats
  const totalStudents = credentials.length;
  const activeStudents = credentials.filter(c => c.student?.is_active).length;
  const avgCompletion = credentials.length > 0 
    ? credentials.reduce((sum, c) => sum + (c.completion_percentage || 0), 0) / credentials.length 
    : 0;
  const completedCount = credentials.filter(c => (c.completion_percentage || 0) >= 100).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Alunos LMS</h1>
          <p className="page-subtitle">Gerencie acessos e acompanhe o progresso no sistema de ensino</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={printAllCredentials}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir Credenciais
          </Button>
          <Button 
            onClick={syncAll} 
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Todos'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total de Alunos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeStudents}</p>
                <p className="text-sm text-muted-foreground">Alunos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <BookOpen className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgCompletion.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Média de Conclusão</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        ) : filteredCredentials.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Credenciais</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Módulo Atual</TableHead>
                <TableHead>Projeção</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCredentials.map((cred) => (
                <TableRow key={cred.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{cred.student?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          Matrícula: {cred.matricula}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cred.email}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(cred.email, 'E-mail')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {visiblePasswords.has(cred.id) ? cred.password : '••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(cred.id)}
                        >
                          {visiblePasswords.has(cred.id) ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(cred.password, 'Senha')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {(cred.completion_percentage || 0).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={cred.completion_percentage || 0} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {cred.current_module ? (
                      <div className="text-sm">
                        <p className="font-medium">{extractStringValue(cred.current_module)}</p>
                        {cred.current_lesson && (
                          <p className="text-muted-foreground text-xs">
                            Aula: {extractStringValue(cred.current_lesson)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const classDays = cred.all_class_days || [];
                      const enrollmentDate = cred.earliest_enrollment_date || cred.enrollment?.enrollment_date;
                      const expectedLesson = calculateExpectedLesson(enrollmentDate, classDays);
                      const currentLesson = extractLessonNumber(cred.current_lesson);
                      const status = getProgressStatus(currentLesson, expectedLesson);
                      const diff = currentLesson - expectedLesson;
                      
                      return (
                        <div className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            {status === 'ahead' && (
                              <Badge className="bg-success/10 text-success border-success/20">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Adiantado
                              </Badge>
                            )}
                            {status === 'ontrack' && (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <Minus className="w-3 h-3 mr-1" />
                                No prazo
                              </Badge>
                            )}
                            {status === 'behind' && (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                <TrendingDown className="w-3 h-3 mr-1" />
                                Atrasado
                              </Badge>
                            )}
                            {status === 'unknown' && (
                              <Badge variant="outline">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                N/A
                              </Badge>
                            )}
                          </div>
                          {expectedLesson > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Esperado: Aula {expectedLesson} | Atual: {currentLesson || '-'}
                              {diff !== 0 && currentLesson > 0 && (
                                <span className={diff > 0 ? 'text-success ml-1' : 'text-destructive ml-1'}>
                                  ({diff > 0 ? '+' : ''}{diff})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {cred.student?.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => syncSingle(cred.id)}
                        title="Atualizar progresso"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="Ações">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Gerenciar Aluno</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => generatePedagogicalReport(cred)}
                            disabled={reportLoading === cred.id}
                          >
                            {reportLoading === cred.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4 mr-2" />
                            )}
                            Relatório Pedagógico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => printCredentials(cred)}>
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir Credenciais
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUnlockLevel(cred, 'current')}>
                            <Unlock className="w-4 h-4 mr-2" />
                            Desbloquear Nível
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetModule(cred, 'next')}>
                            <BookOpen className="w-4 h-4 mr-2" />
                            Mover para Módulo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetLevel(cred, 'next')}>
                            <Trophy className="w-4 h-4 mr-2" />
                            Mover para Nível
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleResetProgress(cred)}
                            className="text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Resetar Progresso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCredential(cred);
                          setShowDetailsModal(true);
                        }}
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno no LMS'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Tente buscar por outro termo' 
                : 'Os alunos serão adicionados automaticamente ao matricular em cursos de robótica ou programação.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Detalhes do Aluno no LMS
            </DialogTitle>
            <DialogDescription>
              Informações de acesso, progresso e ações de gerenciamento
            </DialogDescription>
          </DialogHeader>
          
          {selectedCredential && (
            <div className="space-y-6">
              {/* Student Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dados do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedCredential.student?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matrícula</p>
                    <p className="font-medium font-mono">{selectedCredential.matricula}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Credentials */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Credenciais de Acesso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selectedCredential.email}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedCredential.email, 'E-mail')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Senha</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono">
                        {visiblePasswords.has(selectedCredential.id) 
                          ? selectedCredential.password 
                          : '••••••••'
                        }
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => togglePasswordVisibility(selectedCredential.id)}
                      >
                        {visiblePasswords.has(selectedCredential.id) ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedCredential.password, 'Senha')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Progresso no Curso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Conclusão Geral</span>
                      <span className="font-bold text-primary">
                        {(selectedCredential.progressData?.completion_percentage || selectedCredential.completion_percentage || 0).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={selectedCredential.progressData?.completion_percentage || selectedCredential.completion_percentage || 0} className="h-3" />
                  </div>
                  
                  {/* XP and Coins */}
                  {(selectedCredential.progressData?.total_xp !== undefined || selectedCredential.progressData?.coins !== undefined) && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">XP Total</p>
                          <p className="font-bold">{selectedCredential.progressData?.total_xp || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Moedas</p>
                          <p className="font-bold">{selectedCredential.progressData?.coins || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lessons Progress */}
                  {selectedCredential.progressData?.total_lessons !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Aulas Concluídas</span>
                      <span className="font-medium">
                        {selectedCredential.progressData?.completed_lessons || 0} / {selectedCredential.progressData?.total_lessons || 0}
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Módulo Atual</p>
                      <p className="font-medium">{extractStringValue(selectedCredential.progressData?.current_module || selectedCredential.current_module) || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nível</p>
                      <p className="font-medium">{extractStringValue(selectedCredential.progressData?.current_level || selectedCredential.current_level) || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aula Atual</p>
                      <p className="font-medium">{extractStringValue(selectedCredential.progressData?.current_lesson || selectedCredential.current_lesson) || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={selectedCredential.progressData?.status === 'active' ? 'default' : 'secondary'}>
                        {selectedCredential.progressData?.status || 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  {selectedCredential.last_sync_at && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <Clock className="w-3 h-3" />
                      Última sincronização: {new Date(selectedCredential.last_sync_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Management Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Ações de Gerenciamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlockLevel(selectedCredential, 'current')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'unlockLevel' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Desbloquear Nível
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetModule(selectedCredential, 'next')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'setModule' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                      Próximo Módulo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetLevel(selectedCredential, 'next')}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === 'setLevel' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trophy className="w-4 h-4" />
                      )}
                      Próximo Nível
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetProgress(selectedCredential)}
                      disabled={!!actionLoading}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      {actionLoading === 'resetProgress' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Resetar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Report Button */}
              <Button 
                onClick={() => generatePedagogicalReport(selectedCredential)}
                disabled={reportLoading === selectedCredential.id}
                variant="outline"
                className="w-full gap-2"
              >
                {reportLoading === selectedCredential.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Gerar Relatório Pedagógico
              </Button>

              <Button 
                onClick={() => syncSingle(selectedCredential.id)}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Progresso
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!confirmReset} onOpenChange={() => setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Progresso do Aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá resetar todo o progresso do aluno {confirmReset?.student?.name} no LMS. 
              Isso não pode ser desfeito. O aluno terá que recomeçar do início.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetProgress} className="bg-destructive hover:bg-destructive/90">
              Sim, Resetar Progresso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
