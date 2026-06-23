import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemBranding } from "@/hooks/useSystemBranding";
import { OFICIO_TEMPLATES, type OficioTemplate } from "@/data/oficioTemplates";
import { generateOficioPDF } from "@/utils/oficioPdfGenerator";
import {
  FileText,
  Sparkles,
  Download,
  Save,
  Trash2,
  Plus,
  Loader2,
  Wand2,
  FileSignature,
  Building2,
  Calendar,
} from "lucide-react";

interface SavedOficio {
  id: string;
  number: string;
  subject: string;
  body: string;
  recipientName: string;
  recipientTitle: string;
  recipientOrg: string;
  signerName: string;
  signerRole: string;
  city: string;
  date: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "circuito_oficios_v1";
const INSTITUTION_KEY = "circuito_oficio_institution_v1";

interface InstitutionInfo {
  name: string;
  cnpj: string;
  address: string;
  defaultCity: string;
  defaultSignerName: string;
  defaultSignerRole: string;
}

function loadSaved(): SavedOficio[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(list: SavedOficio[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadInstitution(): InstitutionInfo {
  try {
    const raw = localStorage.getItem(INSTITUTION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: "",
    cnpj: "",
    address: "",
    defaultCity: "",
    defaultSignerName: "",
    defaultSignerRole: "Diretor(a)",
  };
}

function persistInstitution(i: InstitutionInfo) {
  localStorage.setItem(INSTITUTION_KEY, JSON.stringify(i));
}

function nextOficioNumber(list: SavedOficio[]) {
  const year = new Date().getFullYear();
  const sameYear = list.filter((o) => o.number.endsWith(`/${year}`));
  const max = sameYear.reduce((acc, o) => {
    const n = parseInt(o.number.split("/")[0], 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  const next = String(max + 1).padStart(3, "0");
  return `${next}/${year}`;
}

export default function Oficios() {
  const { toast } = useToast();
  const { branding } = useSystemBranding();

  const [saved, setSaved] = useState<SavedOficio[]>(loadSaved);
  const [institution, setInstitution] = useState<InstitutionInfo>(loadInstitution);
  const [contractConfig, setContractConfig] = useState<{ school_name?: string; school_cnpj?: string; school_address?: string; representative_signature_url?: string | null } | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [useSavedSignature, setUseSavedSignature] = useState(true);


  const [activeId, setActiveId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showInstitution, setShowInstitution] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"improve" | "generate">("improve");

  // Form fields
  const [form, setForm] = useState<SavedOficio>(() => createEmpty(saved));

  // Load institution defaults from contract_config when empty
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("contract_config").select("*").maybeSingle();
      if (data) {
        setContractConfig(data as any);
        setInstitution((prev) => {
          const merged = {
            ...prev,
            name: prev.name || data.school_name || branding.name || "",
            cnpj: prev.cnpj || data.school_cnpj || "",
            address: prev.address || data.school_address || "",
            defaultSignerName: prev.defaultSignerName || (data as any).representative_name || "",
          };
          persistInstitution(merged);
          return merged;
        });

        const sigUrl = (data as any).representative_signature_url as string | null;
        if (sigUrl) {
          try {
            const resp = await fetch(sigUrl);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onloadend = () => setSignatureDataUrl(reader.result as string);
            reader.readAsDataURL(blob);
          } catch (e) {
            console.warn("Falha ao carregar assinatura salva", e);
          }
        }
      } else if (branding.name && !institution.name) {
        setInstitution((prev) => {
          const merged = { ...prev, name: branding.name };
          persistInstitution(merged);
          return merged;
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.name]);


  function createEmpty(list: SavedOficio[]): SavedOficio {
    return {
      id: crypto.randomUUID(),
      number: nextOficioNumber(list),
      subject: "",
      body: "",
      recipientName: "",
      recipientTitle: "Ao(À) Senhor(a)",
      recipientOrg: "",
      signerName: institution.defaultSignerName || "",
      signerRole: institution.defaultSignerRole || "Diretor(a)",
      city: institution.defaultCity || "",
      date: new Date().toISOString().slice(0, 10),
      templateId: "em-branco",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyTemplate(t: OficioTemplate) {
    setForm((prev) => ({
      ...prev,
      subject: t.subject,
      body: t.body,
      recipientTitle: t.recipientTitle || prev.recipientTitle,
      templateId: t.id,
      updatedAt: new Date().toISOString(),
    }));
    setShowTemplates(false);
    toast({ title: "Modelo aplicado", description: t.name });
  }

  function handleNew() {
    setForm(createEmpty(saved));
    setActiveId(null);
    setShowTemplates(true);
  }

  function handleSave() {
    if (!form.subject.trim() || !form.body.trim()) {
      toast({ title: "Preencha assunto e conteúdo", variant: "destructive" });
      return;
    }
    const updated = { ...form, updatedAt: new Date().toISOString() };
    const exists = saved.some((s) => s.id === updated.id);
    const next = exists ? saved.map((s) => (s.id === updated.id ? updated : s)) : [updated, ...saved];
    setSaved(next);
    persistSaved(next);
    setActiveId(updated.id);
    toast({ title: "Ofício salvo" });
  }

  function handleLoad(o: SavedOficio) {
    setForm(o);
    setActiveId(o.id);
  }

  function handleDelete(id: string) {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    persistSaved(next);
    if (activeId === id) {
      setForm(createEmpty(next));
      setActiveId(null);
    }
    toast({ title: "Ofício removido" });
  }

  async function handleGeneratePDF() {
    if (!institution.name) {
      toast({
        title: "Configure a instituição",
        description: "Preencha os dados da instituição antes de gerar o PDF.",
        variant: "destructive",
      });
      setShowInstitution(true);
      return;
    }
    if (!form.subject.trim() || !form.body.trim()) {
      toast({ title: "Preencha assunto e conteúdo", variant: "destructive" });
      return;
    }

    try {
      const doc = generateOficioPDF({
        institutionName: institution.name,
        institutionCnpj: institution.cnpj,
        institutionAddress: institution.address,
        institutionLogo: branding.logo,
        oficioNumber: form.number,
        recipientName: form.recipientName || "—",
        recipientTitle: form.recipientTitle,
        recipientOrg: form.recipientOrg,
        subject: form.subject,
        body: form.body,
        city: form.city || institution.defaultCity || "—",
        date: form.date,
        signerName: form.signerName || institution.defaultSignerName || "—",
        signerRole: form.signerRole || institution.defaultSignerRole || "—",
        signatureImage: useSavedSignature ? signatureDataUrl : null,
      });

      doc.save(`oficio-${form.number.replace("/", "-")}.pdf`);
      toast({ title: "PDF gerado com sucesso" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  }

  async function callAI() {
    if (!aiPrompt.trim()) {
      toast({ title: "Descreva o que a IA deve fazer", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("oficio-ai", {
        body: {
          prompt: aiPrompt,
          currentContent: aiMode === "improve" ? form.body : "",
          oficioType: form.subject || "ofício institucional",
          institution: { name: institution.name, address: institution.address },
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const content = (data as any)?.content as string;
      if (!content) throw new Error("IA não retornou conteúdo");

      setForm((prev) => ({ ...prev, body: content, updatedAt: new Date().toISOString() }));
      setShowAI(false);
      setAiPrompt("");
      toast({ title: "Conteúdo atualizado pela IA" });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro na IA",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }

  const categorizedTemplates = useMemo(() => {
    const map = new Map<string, OficioTemplate[]>();
    OFICIO_TEMPLATES.forEach((t) => {
      const arr = map.get(t.category) || [];
      arr.push(t);
      map.set(t.category, arr);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <FileSignature className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Ofícios</h1>
            <p className="text-sm text-muted-foreground">Crie, edite e gere ofícios institucionais em PDF</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowInstitution(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            Instituição
          </Button>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo ofício
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Salvos</CardTitle>
            <CardDescription>{saved.length} ofício(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {saved.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum ofício salvo ainda.
              </p>
            )}
            {saved.map((o) => (
              <button
                key={o.id}
                onClick={() => handleLoad(o)}
                className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary/50 ${
                  activeId === o.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    Nº {o.number}
                  </Badge>
                  <Trash2
                    className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(o.id);
                    }}
                  />
                </div>
                <p className="text-sm font-medium truncate">{o.subject || "(sem assunto)"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {o.recipientName || "—"} · {new Date(o.date).toLocaleDateString("pt-BR")}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Editor</CardTitle>
                <CardDescription>Ofício Nº {form.number}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Modelos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAI(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Assistente IA
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button size="sm" onClick={handleGeneratePDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="conteudo">
              <TabsList>
                <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
                <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
              </TabsList>

              <TabsContent value="conteudo" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="number">Número</Label>
                    <Input
                      id="number"
                      value={form.number}
                      onChange={(e) => setForm({ ...form, number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Ex: São Paulo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Ex: Solicitação de apoio para evento institucional"
                  />
                </div>
                <div>
                  <Label htmlFor="body">Conteúdo do ofício</Label>
                  <Textarea
                    id="body"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Digite o conteúdo ou use um modelo / a IA..."
                    className="min-h-[400px] font-serif leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dica: separe parágrafos com uma linha em branco. Use [COLCHETES] para campos que você deve preencher.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="destinatario" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="rtitle">Tratamento</Label>
                  <Select
                    value={form.recipientTitle}
                    onValueChange={(v) => setForm({ ...form, recipientTitle: v })}
                  >
                    <SelectTrigger id="rtitle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ao(À) Senhor(a)">Ao(À) Senhor(a)</SelectItem>
                      <SelectItem value="Ao(À) Ilustríssimo(a) Senhor(a)">Ao(À) Ilustríssimo(a) Senhor(a)</SelectItem>
                      <SelectItem value="Ao(À) Excelentíssimo(a) Senhor(a)">Ao(À) Excelentíssimo(a) Senhor(a)</SelectItem>
                      <SelectItem value="Aos Senhores Responsáveis">Aos Senhores Responsáveis</SelectItem>
                      <SelectItem value="À Direção">À Direção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rname">Nome do destinatário</Label>
                  <Input
                    id="rname"
                    value={form.recipientName}
                    onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div>
                  <Label htmlFor="rorg">Cargo / Órgão</Label>
                  <Textarea
                    id="rorg"
                    value={form.recipientOrg}
                    onChange={(e) => setForm({ ...form, recipientOrg: e.target.value })}
                    placeholder="Ex: Secretário Municipal de Educação\nPrefeitura Municipal de..."
                    className="min-h-[80px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="assinatura" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="sname">Nome do signatário</Label>
                  <Input
                    id="sname"
                    value={form.signerName}
                    onChange={(e) => setForm({ ...form, signerName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="srole">Cargo</Label>
                  <Input
                    id="srole"
                    value={form.signerRole}
                    onChange={(e) => setForm({ ...form, signerRole: e.target.value })}
                    placeholder="Ex: Diretor(a) Pedagógico(a)"
                  />
                </div>


                <Separator />

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-primary" />
                        Assinatura digital salva
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Usa a assinatura cadastrada em Configuração de Contrato (diretoria).
                      </p>
                    </div>
                    {signatureDataUrl ? (
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useSavedSignature}
                          onChange={(e) => setUseSavedSignature(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        Usar no PDF
                      </label>
                    ) : (
                      <Badge variant="outline">Não cadastrada</Badge>
                    )}
                  </div>
                  {signatureDataUrl && (
                    <div className="bg-white rounded border p-3 flex items-center justify-center">
                      <img
                        src={signatureDataUrl}
                        alt="Assinatura"
                        className="max-h-20 object-contain"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modelos de ofício</DialogTitle>
            <DialogDescription>Escolha um modelo para começar mais rápido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {categorizedTemplates.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {cat}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <p className="font-medium text-sm mb-1">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Assistente de IA
            </DialogTitle>
            <DialogDescription>
              Descreva o que você precisa e a IA criará ou refinará o conteúdo do ofício.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={aiMode} onValueChange={(v) => setAiMode(v as any)}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="generate">Criar do zero</TabsTrigger>
                <TabsTrigger value="improve">Melhorar atual</TabsTrigger>
              </TabsList>
            </Tabs>
            <div>
              <Label htmlFor="aiprompt">Instrução para a IA</Label>
              <Textarea
                id="aiprompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  aiMode === "generate"
                    ? "Ex: Crie um ofício solicitando à prefeitura o fechamento de rua para festa junina em 24/06, das 18h às 22h, com expectativa de 300 participantes."
                    : "Ex: Deixe o tom mais formal, adicione um parágrafo sobre segurança e ajuste a saudação final."
                }
                className="min-h-[140px]"
              />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              Powered by Lovable AI · O conteúdo gerado substituirá o corpo do ofício atual.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAI(false)} disabled={aiLoading}>
              Cancelar
            </Button>
            <Button onClick={callAI} disabled={aiLoading}>
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Institution Dialog */}
      <Dialog open={showInstitution} onOpenChange={setShowInstitution}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dados da instituição</DialogTitle>
            <DialogDescription>
              Estas informações aparecem no cabeçalho dos ofícios. O logo é carregado das configurações do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da instituição</Label>
              <Input
                value={institution.name}
                onChange={(e) => setInstitution({ ...institution, name: e.target.value })}
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={institution.cnpj}
                onChange={(e) => setInstitution({ ...institution, cnpj: e.target.value })}
              />
            </div>
            <div>
              <Label>Endereço completo</Label>
              <Textarea
                value={institution.address}
                onChange={(e) => setInstitution({ ...institution, address: e.target.value })}
                className="min-h-[70px]"
              />
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cidade padrão</Label>
                <Input
                  value={institution.defaultCity}
                  onChange={(e) => setInstitution({ ...institution, defaultCity: e.target.value })}
                />
              </div>
              <div>
                <Label>Cargo padrão</Label>
                <Input
                  value={institution.defaultSignerRole}
                  onChange={(e) => setInstitution({ ...institution, defaultSignerRole: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nome do signatário padrão</Label>
              <Input
                value={institution.defaultSignerName}
                onChange={(e) => setInstitution({ ...institution, defaultSignerName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                persistInstitution(institution);
                setShowInstitution(false);
                toast({ title: "Dados salvos" });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
