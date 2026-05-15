import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar, User, FileText, Shield, Download, Printer, Clock, MessageCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SignedContractData {
  id: string;
  studentName: string;
  guardianName: string;
  courseName: string;
  totalValue: number;
  installments: number;
  signedAt: string;
  signatureHash: string | null;
  signatureImage: string | null;
  signedIp: string | null;
  signedUserAgent: string | null;
  zapsignSignedPdfUrl?: string | null;
}

interface SignedContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: SignedContractData | null;
  onPrint?: () => void;
  onDownload?: () => void;
}

export function SignedContractModal({ 
  open, 
  onOpenChange, 
  contract,
  onPrint,
  onDownload
}: SignedContractModalProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  if (!contract) return null;

  const signedDate = new Date(contract.signedAt);
  const formattedDate = format(signedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(signedDate, "HH:mm:ss", { locale: ptBR });

  // Extract browser info from user agent
  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Não disponível';
    if (userAgent.includes('Chrome')) return 'Google Chrome';
    if (userAgent.includes('Firefox')) return 'Mozilla Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Microsoft Edge';
    return 'Navegador Web';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Contrato Assinado
          </DialogTitle>
          <DialogDescription>
            Assinado eletronicamente com validade jurídica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-success/10 text-success border-success/30 px-3 py-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Assinatura Digital Válida
            </Badge>
          </div>

          {/* Contract Info - Compact */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Aluno(a)</p>
                <p className="font-semibold truncate">{contract.studentName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Curso</p>
                <p className="font-medium truncate">{contract.courseName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-semibold text-primary">
                  R$ {contract.totalValue.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="font-medium flex items-center gap-1.5 truncate">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {contract.guardianName}
              </p>
            </div>
          </div>

          {/* Signature Image - Compact */}
          {contract.signatureImage && (
            <div className="border rounded-lg p-3 bg-white">
              <p className="text-xs text-muted-foreground mb-1.5 text-center">Assinatura</p>
              <div className="flex justify-center">
                <img 
                  src={contract.signatureImage} 
                  alt="Assinatura Digital" 
                  className="max-h-14 border-b-2 border-foreground/20"
                />
              </div>
            </div>
          )}

          {/* Signature Details - Compact */}
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 space-y-2">
            <h4 className="font-medium flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Detalhes da Assinatura
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Data</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Horário</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formattedTime}
                </p>
              </div>
            </div>

            <div className="text-xs">
              <p className="text-muted-foreground">IP / Dispositivo</p>
              <p className="font-mono text-[10px] bg-secondary/50 rounded px-1.5 py-0.5 mt-0.5 truncate">
                {contract.signedIp || '-'} • {getBrowserInfo(contract.signedUserAgent)}
              </p>
            </div>

            {contract.signatureHash && (
              <div className="text-xs">
                <p className="text-muted-foreground">Hash (SHA-256)</p>
                <p className="font-mono text-[10px] bg-secondary/50 rounded px-1.5 py-0.5 mt-0.5 truncate">
                  {contract.signatureHash.substring(0, 40)}...
                </p>
              </div>
            )}
          </div>

          {contract.zapsignSignedPdfUrl && (
            <a
              href={contract.zapsignSignedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-success/40 bg-success/10 hover:bg-success/20 text-success font-medium text-sm py-2 transition"
            >
              <FileText className="w-4 h-4" />
              Ver PDF assinado e autenticado (ZapSign)
            </a>
          )}

          {/* Legal Notice */}
          <p className="text-[10px] text-muted-foreground text-center">
            MP 2.200-2/2001 e Lei 14.063/2020
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSendWhatsApp} 
            disabled={isSending}
            className="gap-1.5 text-success hover:text-success hover:bg-success/10"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5" />
            )}
            Enviar PDF via WhatsApp
          </Button>
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
          )}
          {onDownload && (
            <Button size="sm" onClick={onDownload} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  async function handleSendWhatsApp() {
    if (!contract) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-signed-contract', {
        body: { 
          contractId: contract.id,
          skipAutomationCheck: true // Manual send from modal, skip automation check
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Mensagem enviada!',
        description: `Contrato assinado enviado para ${contract.guardianName} via WhatsApp.`,
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Não foi possível enviar a mensagem. Verifique a configuração do WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }
}
