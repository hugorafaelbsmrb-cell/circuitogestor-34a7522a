import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar, User, FileText, Shield, Download, Printer, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Contrato Assinado Digitalmente
          </DialogTitle>
          <DialogDescription>
            Este contrato foi assinado eletronicamente e possui validade jurídica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-success/10 text-success border-success/30 px-4 py-2 text-sm">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Assinatura Digital Válida
            </Badge>
          </div>

          {/* Contract Info */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Aluno(a)</p>
                <p className="font-semibold text-base">{contract.studentName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Curso</p>
                <p className="font-medium">{contract.courseName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="font-semibold text-primary">
                  R$ {contract.totalValue.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Responsável / Signatário</p>
              <p className="font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                {contract.guardianName}
              </p>
            </div>
          </div>

          {/* Signature Image */}
          {contract.signatureImage && (
            <div className="border rounded-lg p-4 bg-white">
              <p className="text-sm text-muted-foreground mb-2 text-center">Assinatura Capturada</p>
              <div className="flex justify-center">
                <img 
                  src={contract.signatureImage} 
                  alt="Assinatura Digital" 
                  className="max-h-20 border-b-2 border-foreground/20"
                />
              </div>
            </div>
          )}

          {/* Signature Details */}
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-primary" />
              Detalhes da Assinatura Digital
            </h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Data</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formattedDate}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Horário</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formattedTime}
                </p>
              </div>
            </div>

            <div className="text-sm">
              <p className="text-muted-foreground">IP de Origem</p>
              <p className="font-mono text-xs bg-secondary/50 rounded px-2 py-1 mt-1">
                {contract.signedIp || 'Não disponível'}
              </p>
            </div>

            <div className="text-sm">
              <p className="text-muted-foreground">Dispositivo</p>
              <p className="font-medium">
                {getBrowserInfo(contract.signedUserAgent)}
              </p>
            </div>

            {contract.signatureHash && (
              <div className="text-sm">
                <p className="text-muted-foreground">Hash de Verificação (SHA-256)</p>
                <p className="font-mono text-xs bg-secondary/50 rounded px-2 py-1 mt-1 break-all">
                  {contract.signatureHash.substring(0, 32)}...
                </p>
              </div>
            )}
          </div>

          {/* Legal Notice */}
          <p className="text-xs text-muted-foreground text-center">
            Documento assinado eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-2">
          {onPrint && (
            <Button variant="outline" onClick={onPrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          )}
          {onDownload && (
            <Button onClick={onDownload} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar PDF
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
