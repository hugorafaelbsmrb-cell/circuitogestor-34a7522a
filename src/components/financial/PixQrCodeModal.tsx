import { useState, useEffect } from 'react';
import { Copy, Send, Loader2, QrCode, CheckCircle2, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAsaasPayment } from '@/hooks/useAsaasPayment';
import { useWapiMessage } from '@/hooks/useWapiMessage';

interface PixQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  paymentDescription: string;
  paymentValue: number;
  dueDate: string;
  guardianName: string;
  guardianPhone: string;
}

export function PixQrCodeModal({
  isOpen,
  onClose,
  paymentId,
  paymentDescription,
  paymentValue,
  dueDate,
  guardianName,
  guardianPhone,
}: PixQrCodeModalProps) {
  const { toast } = useToast();
  const { getPixQrCode, isLoading } = useAsaasPayment();
  const { sendMessage, isSending } = useWapiMessage();
  
  const [pixData, setPixData] = useState<{
    payload: string;
    encodedImage: string;
    expirationDate: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPixQrCode();
    }
  }, [isOpen, paymentId]);

  const fetchPixQrCode = async () => {
    const result = await getPixQrCode(paymentId);
    if (result) {
      setPixData({
        payload: result.payload,
        encodedImage: result.encodedImage,
        expirationDate: result.expirationDate,
      });
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.payload) return;
    
    navigator.clipboard.writeText(pixData.payload);
    setCopied(true);
    toast({
      title: 'Código PIX copiado!',
      description: 'Cole no app do banco para pagar.',
    });
    
    setTimeout(() => setCopied(false), 3000);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleSendWhatsApp = async () => {
    if (!pixData?.payload || !guardianPhone) {
      toast({
        title: 'Erro ao enviar',
        description: 'Dados do PIX ou telefone não disponíveis.',
        variant: 'destructive',
      });
      return;
    }

    const message = `💳 *Código PIX para Pagamento*

📋 *Descrição:* ${paymentDescription}
💰 *Valor:* ${formatCurrency(paymentValue)}
📅 *Vencimento:* ${formatDate(dueDate)}

📱 *Código PIX (Copia e Cola):*
\`\`\`
${pixData.payload}
\`\`\`

✅ Basta copiar o código acima e colar no seu aplicativo bancário!

⏰ *Validade:* ${pixData.expirationDate ? formatDate(pixData.expirationDate) : 'Até o vencimento'}`;

    const success = await sendMessage({
      phone: guardianPhone,
      message,
    });

    if (success) {
      setSent(true);
      toast({
        title: 'PIX enviado!',
        description: `Código enviado para ${guardianName}.`,
      });
      setTimeout(() => setSent(false), 5000);
    }
  };

  const handleClose = () => {
    setPixData(null);
    setCopied(false);
    setSent(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Código PIX
          </DialogTitle>
          <DialogDescription>
            {paymentDescription} - {formatCurrency(paymentValue)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando código PIX...</p>
            </div>
          ) : pixData ? (
            <>
              {/* QR Code Image */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={`data:image/png;base64,${pixData.encodedImage}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>

              {/* PIX Code (truncated) */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Código PIX (Copia e Cola):</p>
                <p className="text-sm font-mono break-all line-clamp-3">
                  {pixData.payload}
                </p>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="font-medium truncate">{guardianName}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{formatDate(dueDate)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCopyPix}
                  className="w-full gap-2"
                  variant={copied ? 'default' : 'outline'}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Código PIX
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSendWhatsApp}
                  disabled={isSending || !guardianPhone}
                  className="w-full gap-2"
                  variant={sent ? 'default' : 'secondary'}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : sent ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Enviado!
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      Enviar via WhatsApp
                    </>
                  )}
                </Button>
              </div>

              {!guardianPhone && (
                <p className="text-xs text-center text-muted-foreground">
                  Telefone do responsável não cadastrado
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <X className="w-8 h-8" />
              <p className="text-sm">Não foi possível gerar o código PIX.</p>
              <Button variant="outline" size="sm" onClick={fetchPixQrCode}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
