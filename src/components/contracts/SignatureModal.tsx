import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { FileText, PenLine, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAutomationSettings } from '@/hooks/useAutomationSettings';

interface ContractSummary {
  id: string;
  studentName: string;
  courseName: string;
  guardianName: string;
  totalValue: number;
  installments: number;
}

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractSummary | null;
  onSignatureComplete: () => void;
}

export function SignatureModal({ open, onOpenChange, contract, onSignatureComplete }: SignatureModalProps) {
  const { toast } = useToast();
  const { isEnabled } = useAutomationSettings();
  const signatureRef = useRef<SignaturePadRef>(null);
  const [accepted, setAccepted] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const handleSign = async () => {
    if (!contract) return;

    if (!accepted) {
      toast({
        title: 'Aceite necessário',
        description: 'Você precisa aceitar os termos do contrato.',
        variant: 'destructive',
      });
      return;
    }

    if (signatureRef.current?.isEmpty()) {
      toast({
        title: 'Assinatura necessária',
        description: 'Por favor, desenhe sua assinatura no campo indicado.',
        variant: 'destructive',
      });
      return;
    }

    setIsSigning(true);

    try {
      const signatureImage = signatureRef.current?.toDataURL() || '';
      
      // Generate hash from contract content
      const contractHash = await generateHash(JSON.stringify({
        id: contract.id,
        studentName: contract.studentName,
        courseName: contract.courseName,
        totalValue: contract.totalValue,
        signedAt: new Date().toISOString(),
      }));

      // Update contract with signature
      const { error } = await supabase
        .from('contracts')
        .update({
          signature_image: signatureImage,
          signed_at: new Date().toISOString(),
          signed_ip: 'internal', // Will be set by edge function for public signatures
          signed_user_agent: navigator.userAgent,
          signature_hash: contractHash,
          status: 'signed',
        })
        .eq('id', contract.id);

      if (error) throw error;

      // Log the signature event
      await supabase.from('contract_signature_logs').insert({
        contract_id: contract.id,
        action: 'signed',
        ip_address: 'internal',
        user_agent: navigator.userAgent,
      });

      toast({
        title: 'Contrato assinado!',
        description: 'A assinatura digital foi registrada com sucesso.',
      });

      // Auto-send notification if automation is enabled
      if (isEnabled('auto_contract_signed_notify')) {
        try {
          await supabase.functions.invoke('send-signed-contract', {
            body: { contractId: contract.id },
          });
          toast({
            title: 'Notificação enviada!',
            description: 'O responsável foi notificado via WhatsApp.',
          });
        } catch (autoSendError) {
          console.error('Auto-send failed:', autoSendError);
          // Don't show error - signing was successful
        }
      }

      onSignatureComplete();
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Error signing contract:', error);
      toast({
        title: 'Erro ao assinar',
        description: 'Não foi possível registrar a assinatura. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  const resetState = () => {
    setAccepted(false);
    setHasDrawn(false);
    signatureRef.current?.clear();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  // Simple hash function for document verification
  const generateHash = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            Assinatura Digital do Contrato
          </DialogTitle>
          <DialogDescription>
            Revise as informações e assine digitalmente o contrato abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contract Summary */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Aluno(a)</p>
                <p className="font-medium">{contract.studentName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Curso</p>
                <p className="font-medium">{contract.courseName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="font-medium text-primary">
                  R$ {contract.totalValue.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Responsável</p>
              <p className="font-medium">{contract.guardianName}</p>
            </div>
          </div>

          {/* Terms Acceptance */}
          <div className="flex items-start space-x-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
                Li e concordo com os termos do contrato
              </Label>
              <p className="text-xs text-muted-foreground">
                Ao marcar esta opção, você declara ter lido e concordado com todas as cláusulas contratuais.
              </p>
            </div>
          </div>

          {/* Signature Pad */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              Sua Assinatura
            </Label>
            <SignaturePad 
              ref={signatureRef} 
              onEnd={() => setHasDrawn(true)}
            />
            {!hasDrawn && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Desenhe sua assinatura no campo acima usando o mouse ou toque
              </p>
            )}
            {hasDrawn && (
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Assinatura capturada
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSign} 
            disabled={isSigning || !accepted}
            className="gap-2"
          >
            {isSigning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Assinando...
              </>
            ) : (
              <>
                <PenLine className="w-4 h-4" />
                Assinar Contrato
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
