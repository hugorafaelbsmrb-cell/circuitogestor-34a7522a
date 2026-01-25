import { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Pencil, Trash2, GripVertical, Eye, Save, FileText, PenLine, Loader2 } from 'lucide-react';
import { useSchool, ContractClause } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignaturePad, SignaturePadRef } from '@/components/contracts/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function ContractConfig() {
  const { contractConfig, contractClauses, updateContractConfig, addContractClause, updateContractClause, deleteContractClause } = useSchool();
  const { toast } = useToast();
  const signatureRef = useRef<SignaturePadRef>(null);
  const [isClauseDialogOpen, setIsClauseDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<ContractClause | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [clauseFormData, setClauseFormData] = useState({
    title: '',
    content: '',
    clause_order: 1,
    is_active: true,
  });
  const [configFormData, setConfigFormData] = useState({
    school_name: contractConfig?.school_name || '',
    school_cnpj: contractConfig?.school_cnpj || '',
    school_address: contractConfig?.school_address || '',
    representative_name: (contractConfig as any)?.representative_name || '',
  });
  const [currentSignatureUrl, setCurrentSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (contractConfig) {
      setConfigFormData({
        school_name: contractConfig.school_name || '',
        school_cnpj: contractConfig.school_cnpj || '',
        school_address: contractConfig.school_address || '',
        representative_name: (contractConfig as any)?.representative_name || '',
      });
      setCurrentSignatureUrl((contractConfig as any)?.representative_signature_url || null);
    }
  }, [contractConfig]);

  const sortedClauses = [...contractClauses].sort((a, b) => a.clause_order - b.clause_order);

  const resetClauseForm = () => {
    setClauseFormData({
      title: '',
      content: '',
      clause_order: contractClauses.length + 1,
      is_active: true,
    });
    setEditingClause(null);
  };

  const handleOpenClauseDialog = (clause?: ContractClause) => {
    if (clause) {
      setEditingClause(clause);
      setClauseFormData({
        title: clause.title,
        content: clause.content,
        clause_order: clause.clause_order,
        is_active: clause.is_active,
      });
    } else {
      resetClauseForm();
    }
    setIsClauseDialogOpen(true);
  };

  const handleClauseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClause) {
      updateContractClause(editingClause.id, clauseFormData);
    } else {
      addContractClause(clauseFormData);
    }
    setIsClauseDialogOpen(false);
    resetClauseForm();
  };

  const handleDeleteClause = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta cláusula?')) {
      deleteContractClause(id);
    }
  };

  const handleSaveConfig = () => {
    updateContractConfig({
      school_name: configFormData.school_name,
      school_cnpj: configFormData.school_cnpj,
      school_address: configFormData.school_address,
      representative_name: configFormData.representative_name,
    } as any);
    toast({
      title: 'Dados salvos',
      description: 'As informações da escola foram atualizadas.',
    });
  };

  const handleSaveSignature = async () => {
    if (!contractConfig) return;
    
    if (signatureRef.current?.isEmpty()) {
      toast({
        title: 'Assinatura vazia',
        description: 'Por favor, desenhe a assinatura antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSignature(true);

    try {
      const signatureDataUrl = signatureRef.current?.toDataURL() || '';
      
      // Convert base64 to blob
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      
      // Upload to storage
      const fileName = `school-signature-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('system-branding')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('system-branding')
        .getPublicUrl(fileName);

      // Update contract config with signature URL
      const { error: updateError } = await supabase
        .from('contract_config')
        .update({ 
          representative_signature_url: urlData.publicUrl,
          representative_name: configFormData.representative_name,
        })
        .eq('id', contractConfig.id);

      if (updateError) throw updateError;

      setCurrentSignatureUrl(urlData.publicUrl);
      
      toast({
        title: 'Assinatura salva',
        description: 'A assinatura da contratada foi salva com sucesso.',
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a assinatura. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSignature(false);
    }
  };

  const handleClearSignature = async () => {
    signatureRef.current?.clear();
    
    if (currentSignatureUrl && contractConfig) {
      try {
        // Remove signature URL from database
        await supabase
          .from('contract_config')
          .update({ representative_signature_url: null })
          .eq('id', contractConfig.id);
        
        setCurrentSignatureUrl(null);
        
        toast({
          title: 'Assinatura removida',
          description: 'A assinatura foi removida com sucesso.',
        });
      } catch (error) {
        console.error('Error removing signature:', error);
      }
    }
  };

  const toggleClauseActive = (clause: ContractClause) => {
    updateContractClause(clause.id, { is_active: !clause.is_active });
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configuração do Contrato</h1>
        <p className="page-subtitle">Personalize as cláusulas e informações do contrato</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* School Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" />
              Dados da Escola
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">Nome da Escola</Label>
              <Input
                id="school_name"
                value={configFormData.school_name}
                onChange={(e) => setConfigFormData({ ...configFormData, school_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_cnpj">CNPJ</Label>
              <Input
                id="school_cnpj"
                value={configFormData.school_cnpj}
                onChange={(e) => setConfigFormData({ ...configFormData, school_cnpj: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_address">Endereço</Label>
              <Textarea
                id="school_address"
                value={configFormData.school_address}
                onChange={(e) => setConfigFormData({ ...configFormData, school_address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representative_name">Nome do Representante</Label>
              <Input
                id="representative_name"
                value={configFormData.representative_name}
                onChange={(e) => setConfigFormData({ ...configFormData, representative_name: e.target.value })}
                placeholder="Nome que aparecerá abaixo da assinatura"
              />
            </div>
            <Button onClick={handleSaveConfig} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Salvar Dados
            </Button>

            {/* Assinatura da Contratada */}
            <div className="pt-4 border-t">
              <Label className="flex items-center gap-2 mb-2">
                <PenLine className="w-4 h-4" />
                Assinatura da Contratada
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Esta assinatura será exibida em todos os contratos gerados.
              </p>
              
              {currentSignatureUrl ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-3 bg-secondary/30">
                    <img 
                      src={currentSignatureUrl} 
                      alt="Assinatura atual" 
                      className="max-h-16 mx-auto"
                    />
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Assinatura atual
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleClearSignature}
                    className="w-full"
                  >
                    Remover e Desenhar Nova
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <SignaturePad ref={signatureRef} height={120} />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => signatureRef.current?.clear()}
                      className="flex-1"
                    >
                      Limpar
                    </Button>
                    <Button 
                      onClick={handleSaveSignature}
                      disabled={isSavingSignature}
                      className="flex-1 gap-2"
                    >
                      {isSavingSignature ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Salvar Assinatura
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clauses Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              Cláusulas do Contrato
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="w-4 h-4" />
                    Visualizar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Prévia do Contrato</DialogTitle>
                  </DialogHeader>
                  <div className="prose prose-sm max-w-none">
                    <h2 className="text-center text-lg font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS</h2>
                    <div className="my-4 p-4 bg-secondary/30 rounded-lg">
                      <p className="font-semibold">{contractConfig?.school_name}</p>
                      <p className="text-sm text-muted-foreground">CNPJ: {contractConfig?.school_cnpj}</p>
                      <p className="text-sm text-muted-foreground">{contractConfig?.school_address}</p>
                    </div>
                    <p className="text-muted-foreground italic">[Dados do contratante e aluno serão preenchidos automaticamente]</p>
                    {sortedClauses
                      .filter(c => c.is_active)
                      .map((clause, index) => (
                        <div key={clause.id} className="mb-4">
                          <h3 className="font-semibold">
                            Cláusula {index + 1}ª - {clause.title}
                          </h3>
                          <p className="text-sm">{clause.content}</p>
                        </div>
                      ))}
                    <p className="text-center mt-8 text-muted-foreground">[Local e data]</p>
                    <div className="flex justify-between mt-8">
                      <div className="text-center">
                        <div className="border-t border-foreground w-48 mx-auto mb-2" />
                        <p className="text-sm">CONTRATANTE</p>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-foreground w-48 mx-auto mb-2" />
                        <p className="text-sm">CONTRATADO</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isClauseDialogOpen} onOpenChange={setIsClauseDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2" onClick={() => handleOpenClauseDialog()}>
                    <Plus className="w-4 h-4" />
                    Nova Cláusula
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingClause ? 'Editar Cláusula' : 'Nova Cláusula'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleClauseSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clauseTitle">Título</Label>
                      <Input
                        id="clauseTitle"
                        value={clauseFormData.title}
                        onChange={(e) => setClauseFormData({ ...clauseFormData, title: e.target.value })}
                        placeholder="Ex: Objeto do Contrato"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clauseContent">Conteúdo</Label>
                      <Textarea
                        id="clauseContent"
                        value={clauseFormData.content}
                        onChange={(e) => setClauseFormData({ ...clauseFormData, content: e.target.value })}
                        placeholder="Descreva o conteúdo da cláusula..."
                        rows={5}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="clauseOrder">Ordem</Label>
                        <Input
                          id="clauseOrder"
                          type="number"
                          min="1"
                          value={clauseFormData.clause_order}
                          onChange={(e) => setClauseFormData({ ...clauseFormData, clause_order: parseInt(e.target.value) || 1 })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ativa</Label>
                        <div className="flex items-center h-10">
                          <Switch
                            checked={clauseFormData.is_active}
                            onCheckedChange={(checked) => setClauseFormData({ ...clauseFormData, is_active: checked })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsClauseDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingClause ? 'Salvar' : 'Criar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedClauses.map((clause) => (
                <div
                  key={clause.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    clause.is_active ? 'bg-card border-border' : 'bg-muted/50 border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted-foreground pt-1">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs font-medium w-6">{clause.clause_order}.</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground">{clause.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{clause.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={clause.is_active}
                      onCheckedChange={() => toggleClauseActive(clause)}
                      className="data-[state=checked]:bg-success"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenClauseDialog(clause)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClause(clause.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
