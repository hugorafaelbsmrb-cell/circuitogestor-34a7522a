import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SignaturePad, SignaturePadRef } from '@/components/contracts/SignaturePad';
import { FileText, PenLine, Loader2, AlertTriangle, CheckCircle2, Shield, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSystemBranding } from '@/hooks/useSystemBranding';

interface ContractData {
  id: string;
  student_id: string;
  guardian_id: string;
  course_id: string;
  total_value: number;
  installment_count: number;
  status: string;
  signed_at: string | null;
  contract_content: {
    studentName?: string;
    courseName?: string;
    guardianName?: string;
    clauses?: { title: string; content: string }[];
    [key: string]: any;
  };
}

export default function ContractSign() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const { branding } = useSystemBranding();
  const signatureRef = useRef<SignaturePadRef>(null);

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const addDebug = (msg: string) => {
    console.log('[ContractSign]', msg);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    addDebug('Iniciando carregamento...');
    addDebug(`Token: ${token ? token.substring(0, 8) + '...' : 'nenhum'}`);
    
    // Timeout para evitar loading infinito no Safari
    const timeoutId = setTimeout(() => {
      if (loading) {
        addDebug('TIMEOUT - Loading demorou mais que 10s');
        setLoading(false);
        if (!contract && !error) {
          setError('Tempo esgotado ao carregar contrato. Por favor, recarregue a página.');
        }
      }
    }, 10000);
    
    const fetchContract = async () => {
      if (!token) {
        addDebug('ERRO: Token não fornecido');
        setError('Token inválido');
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      addDebug('Buscando contrato no banco...');
      
      try {
        addDebug('Executando query...');
        const { data, error: fetchError } = await supabase
          .from('contracts')
          .select('*')
          .eq('signature_token', token)
          .maybeSingle();

        addDebug(`Query completada: ${data ? 'dados recebidos' : 'sem dados'}, erro: ${fetchError?.message || 'nenhum'}`);
        
        if (fetchError || !data) {
          addDebug(`ERRO: ${fetchError?.message || 'Contrato não encontrado'}`);
          setError('Contrato não encontrado ou link expirado.');
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        if (data.signed_at) {
          addDebug('Contrato já assinado');
          setContract(data as ContractData);
          setSigned(true);
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        addDebug('Registrando visualização...');
        // Log view event
        const { error: logError } = await supabase.from('contract_signature_logs').insert({
          contract_id: data.id,
          action: 'viewed',
          ip_address: 'public',
          user_agent: navigator.userAgent,
        });
        
        if (logError) {
          addDebug(`Aviso: Log falhou - ${logError.message}`);
        }

        addDebug('Contrato carregado com sucesso!');
        setContract(data as ContractData);
      } catch (err) {
        addDebug(`ERRO CATCH: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        setError('Erro ao carregar contrato.');
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    fetchContract();
    
    return () => clearTimeout(timeoutId);
  }, [token]);

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
      
      console.log('[ContractSign] Starting signature process for token:', token);
      
      // Generate hash from contract content
      const hashContent = JSON.stringify({
        id: contract.id,
        studentName: contract.contract_content?.studentName,
        courseName: contract.contract_content?.courseName,
        totalValue: contract.total_value,
        signedAt: new Date().toISOString(),
      });
      
      const encoder = new TextEncoder();
      const data = encoder.encode(hashContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('[ContractSign] Hash generated, calling edge function...');

      // Update contract with signature via edge function for IP capture
      const response = await supabase.functions.invoke('contract-sign', {
        body: {
          token,
          signatureImage,
          signatureHash: contractHash,
          userAgent: navigator.userAgent,
        },
      });
      
      console.log('[ContractSign] Edge function response:', response);

      if (response.error) {
        console.error('[ContractSign] Edge function error:', response.error);
        throw response.error;
      }

      toast({
        title: 'Contrato assinado!',
        description: 'A assinatura digital foi registrada com sucesso.',
      });

      setSigned(true);
    } catch (error) {
      console.error('Error signing contract:', error);
      toast({
        title: 'Erro ao assinar',
        description: error instanceof Error ? error.message : 'Não foi possível registrar a assinatura. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  // Debug panel component
  const DebugPanel = () => (
    debugInfo.length > 0 && (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 text-green-400 p-3 text-xs font-mono max-h-32 overflow-y-auto z-50">
        <p className="text-yellow-400 font-bold mb-1">🔧 Debug Safari:</p>
        {debugInfo.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando contrato...</p>
        </div>
        <DebugPanel />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl border border-border shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Link Inválido</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <DebugPanel />
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl border border-border shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Contrato Assinado!</h1>
          <p className="text-muted-foreground mb-4">
            O contrato de {contract?.contract_content?.studentName} foi assinado digitalmente com sucesso.
          </p>
          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
            <p className="text-sm text-success">
              Você receberá uma cópia do contrato por e-mail ou WhatsApp em breve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const content = contract?.contract_content;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      {/* Header */}
      <header className="bg-card border-b border-border py-4">
        <div className="container mx-auto px-4 flex items-center justify-center">
          {branding?.logo ? (
            <img src={branding.logo} alt={branding.name || 'Logo'} className="h-10 object-contain" />
          ) : (
            <h1 className="text-xl font-bold text-primary">{branding?.name || 'Sistema de Matrículas'}</h1>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden">
          {/* Title */}
          <div className="bg-primary/5 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Assinatura Digital</h1>
                <p className="text-sm text-muted-foreground">Contrato de Prestação de Serviços Educacionais</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Contract Summary */}
            <div className="bg-secondary/30 rounded-lg p-4 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Resumo do Contrato
              </h2>
              
              <div className="grid gap-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Aluno(a)</span>
                  <span className="font-medium">{content?.studentName || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Curso</span>
                  <span className="font-medium">{content?.courseName || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Responsável</span>
                  <span className="font-medium">{content?.guardianName || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Valor Total</span>
                  <span className="font-bold text-lg text-primary">
                    R$ {contract?.total_value?.toFixed(2).replace('.', ',') || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contract Clauses Preview */}
            {content?.clauses && content.clauses.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-semibold text-foreground">Cláusulas do Contrato</h2>
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-4 bg-secondary/20">
                  {content.clauses.map((clause, index) => (
                    <div key={index} className="mb-3 last:mb-0">
                      <p className="text-sm font-medium text-foreground">
                        Cláusula {index + 1}ª – {clause.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{clause.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg text-xs text-muted-foreground">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Esta assinatura é juridicamente vinculante. Serão registrados a data, hora, 
                endereço IP e dispositivo utilizado para fins de auditoria e segurança.
              </p>
            </div>

            {/* Sign Button */}
            <Button 
              onClick={handleSign} 
              disabled={isSigning || !accepted}
              className="w-full gap-2"
              size="lg"
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
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {branding?.name || 'Sistema de Matrículas'}</p>
      </footer>
      
      <DebugPanel />
    </div>
  );
}
