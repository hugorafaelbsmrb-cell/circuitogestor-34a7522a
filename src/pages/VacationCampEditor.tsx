import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, Upload, X, Search, Download, MessageCircle, CheckCircle, Send, Copy, ClipboardCheck, CreditCard } from "lucide-react";
import { formatCPF, formatPhone, normalizePhoneToWAPI } from "@/utils/validators";

const sb: any = supabase;

const ICON_OPTIONS = [
  "Sparkles","Sun","Palette","Music","Gamepad2","BookOpen","Smile","Trophy",
  "Pizza","Camera","Heart","Star","Rocket","Zap","Leaf","Droplets","Wand2","CalendarDays",
];

export default function VacationCampEditor() {
  const { id } = useParams<{ id: string }>();
  const [camp, setCamp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("vacation_camps").select("*").eq("id", id).single();
    setCamp(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading || !camp) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/colonia-admin"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{camp.name}</h1>
          <p className="text-xs text-muted-foreground font-mono">/colonia/{camp.slug}</p>
        </div>
        <Badge variant={camp.status === "published" ? "default" : "secondary"}>
          {camp.status === "published" ? "Publicada" : "Rascunho"}
        </Badge>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="hero">Hero & Imagens</TabsTrigger>
          <TabsTrigger value="schedule">Programação</TabsTrigger>
          <TabsTrigger value="packages">Pacotes</TabsTrigger>
          <TabsTrigger value="texts">Textos</TabsTrigger>
          <TabsTrigger value="enrollments">Inscritos</TabsTrigger>
          <TabsTrigger value="attendance">Presença</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab camp={camp} onSaved={load} /></TabsContent>
        <TabsContent value="hero"><HeroTab camp={camp} onSaved={load} /></TabsContent>
        <TabsContent value="schedule"><ScheduleTab campId={camp.id} /></TabsContent>
        <TabsContent value="packages"><PackagesTab campId={camp.id} /></TabsContent>
        <TabsContent value="texts"><TextsTab camp={camp} onSaved={load} /></TabsContent>
        <TabsContent value="enrollments"><EnrollmentsTab campId={camp.id} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab campId={camp.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- GERAL ---------------- */
function GeneralTab({ camp, onSaved }: { camp: any; onSaved: () => void }) {
  const [f, setF] = useState({
    name: camp.name, slug: camp.slug, description: camp.description || "",
    status: camp.status, start_date: camp.start_date || "", end_date: camp.end_date || "",
    location: camp.location || "", age_min: camp.age_min || "", age_max: camp.age_max || "",
    theme_color: camp.theme_color || "#f97316", cta_text: camp.cta_text || "Garantir vaga",
    whatsapp_number: camp.whatsapp_number || "",
    meta_pixel_id: camp.meta_pixel_id || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("vacation_camps").update({
      ...f,
      age_min: f.age_min ? parseInt(String(f.age_min)) : null,
      age_max: f.age_max ? parseInt(String(f.age_max)) : null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
    }).eq("id", camp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onSaved();
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
      </div>
      <div><Label>Descrição</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Início</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
        <div><Label>Fim</Label><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div><Label>Local</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><Label>Idade mínima</Label><Input type="number" value={f.age_min} onChange={(e) => setF({ ...f, age_min: e.target.value })} /></div>
        <div><Label>Idade máxima</Label><Input type="number" value={f.age_max} onChange={(e) => setF({ ...f, age_max: e.target.value })} /></div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <Label>Cor do tema</Label>
          <div className="flex gap-2">
            <Input type="color" value={f.theme_color} onChange={(e) => setF({ ...f, theme_color: e.target.value })} className="w-16 p-1" />
            <Input value={f.theme_color} onChange={(e) => setF({ ...f, theme_color: e.target.value })} />
          </div>
        </div>
        <div><Label>Texto do CTA</Label><Input value={f.cta_text} onChange={(e) => setF({ ...f, cta_text: e.target.value })} /></div>
        <div><Label>WhatsApp (rodapé)</Label><Input value={f.whatsapp_number} onChange={(e) => setF({ ...f, whatsapp_number: e.target.value })} placeholder="5511999999999" /></div>
      </div>
      <div>
        <Label>Meta Pixel ID</Label>
        <Input
          value={f.meta_pixel_id}
          onChange={(e) => setF({ ...f, meta_pixel_id: e.target.value })}
          placeholder="Ex: 1234567890123456"
        />
        <p className="text-xs text-muted-foreground mt-1">ID do Pixel do Facebook/Meta para rastreamento da landing page.</p>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicada</SelectItem>
            <SelectItem value="closed">Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
    </Card>
  );
}

/* ---------------- HERO & IMAGENS ---------------- */
function HeroTab({ camp, onSaved }: { camp: any; onSaved: () => void }) {
  const [hero, setHero] = useState({
    hero_title: camp.hero_title || "",
    hero_subtitle: camp.hero_subtitle || "",
    hero_image_url: camp.hero_image_url || "",
  });
  const [gallery, setGallery] = useState<string[]>(camp.gallery || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, target: "hero" | "gallery") => {
    setUploading(true);
    const path = `${camp.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await sb.storage.from("camp-images").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = sb.storage.from("camp-images").getPublicUrl(path);
    const url = data.publicUrl;
    if (target === "hero") setHero({ ...hero, hero_image_url: url });
    else setGallery([...gallery, url]);
    setUploading(false);
    toast.success("Upload concluído");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("vacation_camps").update({ ...hero, gallery }).eq("id", camp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onSaved();
  };

  return (
    <Card className="p-5 space-y-4">
      <div><Label>Título principal</Label><Input value={hero.hero_title} onChange={(e) => setHero({ ...hero, hero_title: e.target.value })} /></div>
      <div><Label>Subtítulo</Label><Textarea rows={2} value={hero.hero_subtitle} onChange={(e) => setHero({ ...hero, hero_subtitle: e.target.value })} /></div>
      <div>
        <Label>Imagem de fundo (hero)</Label>
        <div className="flex items-center gap-3 mt-2">
          {hero.hero_image_url && <img src={hero.hero_image_url} className="w-24 h-16 object-cover rounded" />}
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "hero")} />
            <Button asChild variant="outline" size="sm"><span><Upload className="w-3.5 h-3.5 mr-2" />Enviar</span></Button>
          </label>
          {hero.hero_image_url && <Button size="sm" variant="ghost" onClick={() => setHero({ ...hero, hero_image_url: "" })}><X className="w-3.5 h-3.5" /></Button>}
        </div>
      </div>
      <div>
        <Label>Galeria</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {gallery.map((u, i) => (
            <div key={i} className="relative aspect-square group">
              <img src={u} className="w-full h-full object-cover rounded" />
              <button onClick={() => setGallery(gallery.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="aspect-square border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "gallery")} />
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
          </label>
        </div>
      </div>
      <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
    </Card>
  );
}

/* ---------------- PROGRAMAÇÃO ---------------- */
function ScheduleTab({ campId }: { campId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("vacation_camp_schedule").select("*").eq("camp_id", campId).order("sort_order");
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [campId]);

  const openNew = () => {
    setEditing({ day_label: "", time_label: "", title: "", description: "", icon: "Sparkles", sort_order: items.length });
    setOpen(true);
  };
  const openEdit = (it: any) => { setEditing(it); setOpen(true); };

  const save = async () => {
    const payload = { ...editing, camp_id: campId };
    delete payload.id;
    const { error } = editing.id
      ? await sb.from("vacation_camp_schedule").update(payload).eq("id", editing.id)
      : await sb.from("vacation_camp_schedule").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir item?")) return;
    await sb.from("vacation_camp_schedule").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{items.length} atividades</p>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
      </div>
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{it.day_label}</Badge>
                  {it.time_label && <span className="text-xs font-mono text-muted-foreground">{it.time_label}</span>}
                  <span className="font-semibold">{it.title}</span>
                </div>
                {it.description && <p className="text-xs text-muted-foreground mt-1">{it.description}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(it)}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} atividade</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dia (rótulo)</Label><Input value={editing.day_label} onChange={(e) => setEditing({ ...editing, day_label: e.target.value })} placeholder="Segunda 08/07" /></div>
                <div><Label>Horário</Label><Input value={editing.time_label || ""} onChange={(e) => setEditing({ ...editing, time_label: e.target.value })} placeholder="09h" /></div>
              </div>
              <div><Label>Título</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone</Label>
                  <Select value={editing.icon} onValueChange={(v) => setEditing({ ...editing, icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Ordem</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- PACOTES ---------------- */
function PackagesTab({ campId }: { campId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const { data } = await sb.from("vacation_camp_packages").select("*").eq("camp_id", campId).order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { load(); }, [campId]);

  const openNew = () => {
    setEditing({
      name: "", description: "", price: 0, original_price: null, max_slots: null, active: true,
      payment_methods: ["PIX", "BOLETO"], max_installments: 1, due_days: 3,
      includes: [], sort_order: items.length,
      students_only: false, price_negotiable: false,
      card_interest_free_installments: 1, card_interest_percent: 0,
    });
    setOpen(true);
  };


  const togglePm = (m: string) => {
    const pm = editing.payment_methods || [];
    setEditing({ ...editing, payment_methods: pm.includes(m) ? pm.filter((x: string) => x !== m) : [...pm, m] });
  };

  const save = async () => {
    const payload = { ...editing, camp_id: campId };
    delete payload.id; delete payload.sold_count; delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await sb.from("vacation_camp_packages").update(payload).eq("id", editing.id)
      : await sb.from("vacation_camp_packages").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir pacote?")) return;
    await sb.from("vacation_camp_packages").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{items.length} pacotes</p>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo pacote</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-2xl font-bold text-primary mt-1">R$ {Number(p.price).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.sold_count}/{p.max_slots ?? "∞"} vagas · {(p.payment_methods || []).join(", ")}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} pacote</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço</Label><Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Preço original (riscado)</Label><Input type="number" step="0.01" value={editing.original_price || ""} onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vagas máx (vazio = ∞)</Label><Input type="number" value={editing.max_slots || ""} onChange={(e) => setEditing({ ...editing, max_slots: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div><Label>Vencimento (dias)</Label><Input type="number" value={editing.due_days} onChange={(e) => setEditing({ ...editing, due_days: parseInt(e.target.value) || 3 })} /></div>
              </div>
              <div>
                <Label>Formas de pagamento</Label>
                <div className="flex gap-3 mt-2">
                  {["PIX", "BOLETO", "CREDIT_CARD"].map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={(editing.payment_methods || []).includes(m)} onChange={() => togglePm(m)} />
                      {m === "CREDIT_CARD" ? "Cartão" : m === "BOLETO" ? "Boleto" : "PIX"}
                    </label>
                  ))}
                </div>
              </div>
              {(editing.payment_methods || []).includes("CREDIT_CARD") && (
                <div className="space-y-3 rounded border p-3 bg-muted/30">
                  <div><Label>Máx. parcelas</Label><Input type="number" min={1} value={editing.max_installments} onChange={(e) => setEditing({ ...editing, max_installments: parseInt(e.target.value) || 1 })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Parcelas sem juros</Label>
                      <Input type="number" min={1} value={editing.card_interest_free_installments ?? 1} onChange={(e) => setEditing({ ...editing, card_interest_free_installments: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <Label>Juros ao mês (%)</Label>
                      <Input type="number" step="0.01" min={0} value={editing.card_interest_percent ?? 0} onChange={(e) => setEditing({ ...editing, card_interest_percent: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Ex.: 2 parcelas sem juros e 2,99% a.m. Acima do limite sem juros aplica-se a Tabela Price (juros compostos).</p>
                </div>
              )}

              <div>
                <Label>Itens incluídos (um por linha)</Label>
                <Textarea rows={4} value={(editing.includes || []).join("\n")} onChange={(e) => setEditing({ ...editing, includes: e.target.value.split("\n").filter(Boolean) })} />
              </div>
              <div className="space-y-2 rounded border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Switch checked={!!editing.students_only} onCheckedChange={(v) => setEditing({ ...editing, students_only: v })} />
                  <Label className="cursor-pointer">Exclusivo para alunos da escola</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!editing.price_negotiable} onCheckedChange={(v) => setEditing({ ...editing, price_negotiable: v })} />
                  <Label className="cursor-pointer">Preço a negociar com a secretaria</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pacotes exclusivos ou com preço negociável não aparecem para checkout — o botão leva direto ao WhatsApp da escola.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Ativo</Label>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- TEXTOS (highlights, faq, terms) ---------------- */
function TextsTab({ camp, onSaved }: { camp: any; onSaved: () => void }) {
  const [highlights, setHighlights] = useState<any[]>(camp.highlights || []);
  const [faq, setFaq] = useState<any[]>(camp.faq || []);
  const [terms, setTerms] = useState(camp.terms_text || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("vacation_camps").update({ highlights, faq, terms_text: terms }).eq("id", camp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onSaved();
  };

  return (
    <Card className="p-5 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Destaques (cards com ícone)</Label>
          <Button size="sm" variant="outline" onClick={() => setHighlights([...highlights, { icon: "Sparkles", title: "", description: "" }])}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar</Button>
        </div>
        <div className="space-y-2">
          {highlights.map((h, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Select value={h.icon} onValueChange={(v) => { const n = [...highlights]; n[i].icon = v; setHighlights(n); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Título" value={h.title} onChange={(e) => { const n = [...highlights]; n[i].title = e.target.value; setHighlights(n); }} />
              <Input placeholder="Descrição" value={h.description} onChange={(e) => { const n = [...highlights]; n[i].description = e.target.value; setHighlights(n); }} />
              <Button size="icon" variant="ghost" onClick={() => setHighlights(highlights.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>FAQ</Label>
          <Button size="sm" variant="outline" onClick={() => setFaq([...faq, { question: "", answer: "" }])}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar</Button>
        </div>
        <div className="space-y-2">
          {faq.map((q, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Pergunta" value={q.question} onChange={(e) => { const n = [...faq]; n[i].question = e.target.value; setFaq(n); }} />
                <Button size="icon" variant="ghost" onClick={() => setFaq(faq.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
              <Textarea placeholder="Resposta" rows={2} value={q.answer} onChange={(e) => { const n = [...faq]; n[i].answer = e.target.value; setFaq(n); }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Termos / regras (rodapé)</Label>
        <Textarea rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>

      <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
    </Card>
  );
}

/* ---------------- INSCRITOS ---------------- */
function EnrollmentsTab({ campId }: { campId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [pkgs, setPkgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "all", pkg: "all", q: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [payEdit, setPayEdit] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: p }] = await Promise.all([
      sb.from("vacation_camp_enrollments").select("*").eq("camp_id", campId).order("created_at", { ascending: false }),
      sb.from("vacation_camp_packages").select("id, name, price").eq("camp_id", campId).order("sort_order"),
    ]);
    setRows(e || []); setPkgs(p || []); setLoading(false);
  };
  useEffect(() => { load(); }, [campId]);

  const filtered = rows.filter((r) => {
    if (filter.status !== "all" && r.payment_status !== filter.status) return false;
    if (filter.pkg !== "all" && r.package_id !== filter.pkg) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      return (r.child_name + " " + r.guardian_name + " " + (r.guardian_phone || "")).toLowerCase().includes(q);
    }
    return true;
  });

  const pkgName = (id: string) => pkgs.find((p) => p.id === id)?.name || "—";

  const markPaid = async (r: any) => {
    if (!confirm(`Marcar inscrição de ${r.child_name} como paga manualmente?`)) return;
    await sb.from("vacation_camp_enrollments").update({
      payment_status: "confirmed", confirmed_at: new Date().toISOString(),
    }).eq("id", r.id);
    if (r.package_id) {
      const pkg = pkgs.find((p) => p.id === r.package_id);
      if (pkg) {
        await sb.from("vacation_camp_packages").update({
          sold_count: rows.filter((x) => x.package_id === r.package_id && (x.payment_status === "confirmed" || x.id === r.id)).length,
        }).eq("id", r.package_id);
      }
    }
    toast.success("Marcado como pago");
    load();
  };

  const cancel = async (r: any) => {
    if (!confirm(`Cancelar inscrição de ${r.child_name}?`)) return;
    await sb.from("vacation_camp_enrollments").update({ payment_status: "cancelled" }).eq("id", r.id);
    load();
  };

  const remove = async (r: any) => {
    if (!confirm(`Excluir inscrição de ${r.child_name}?`)) return;
    await sb.from("vacation_camp_enrollments").delete().eq("id", r.id);
    load();
  };

  const sendPaymentLink = async (r: any) => {
    if (!r.guardian_phone) return toast.error("Responsável sem telefone cadastrado");
    const t = toast.loading("Enviando link de pagamento...");
    const { data, error } = await sb.functions.invoke("vacation-camp-notify", {
      body: { event: "payment_link", enrollment_id: r.id },
    });
    toast.dismiss(t);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Falha ao enviar");
    if (data?.sent === false) return toast.error("WhatsApp não configurado");
    toast.success("Link enviado por WhatsApp");
  };

  const copyPaymentLink = (r: any) => {
    const link = `${window.location.origin}/colonia-pagamento/${r.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const exportCsv = () => {
    const header = "Criança;Idade;Responsável;Telefone;CPF;Email;Pacote;Valor;Status;Origem;Criado em\n";
    const lines = filtered.map((r) =>
      [r.child_name, r.child_age, r.guardian_name, r.guardian_phone, r.guardian_cpf, r.guardian_email, pkgName(r.package_id), r.amount, r.payment_status, r.source, r.created_at]
        .map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(";")
    ).join("\n");
    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inscritos-colonia.csv"; a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar..." className="w-56" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="exempt">Isento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.pkg} onValueChange={(v) => setFilter({ ...filter, pkg: v })}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos pacotes</SelectItem>
            {pkgs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-3.5 h-3.5 mr-2" />CSV</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5 mr-2" />Adicionar aluno nosso</Button>
        </div>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Criança</th>
                  <th className="p-2">Idade</th>
                  <th className="p-2">Responsável</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Pacote</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Origem</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-medium">{r.child_name}</td>
                    <td className="p-2">{r.child_age || "—"}</td>
                    <td className="p-2">{r.guardian_name}</td>
                    <td className="p-2 font-mono text-xs">{r.guardian_phone}</td>
                    <td className="p-2">{pkgName(r.package_id)}</td>
                    <td className="p-2">{r.amount ? `R$ ${Number(r.amount).toFixed(2)}` : "—"}</td>
                    <td className="p-2">
                      <Badge variant={r.payment_status === "confirmed" ? "default" : r.payment_status === "cancelled" ? "destructive" : "secondary"}>
                        {r.payment_status}
                      </Badge>
                    </td>
                    <td className="p-2"><Badge variant="outline">{r.source}</Badge></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {r.payment_status !== "confirmed" && r.payment_status !== "cancelled" && (
                        <>
                          <Button size="icon" variant="ghost" title="Alterar forma de pagamento" onClick={() => setPayEdit(r)}><CreditCard className="w-4 h-4 text-blue-600" /></Button>
                          <Button size="icon" variant="ghost" title="Enviar link de pagamento por WhatsApp" onClick={() => sendPaymentLink(r)}><Send className="w-4 h-4 text-primary" /></Button>
                          <Button size="icon" variant="ghost" title="Copiar link de pagamento" onClick={() => copyPaymentLink(r)}><Copy className="w-4 h-4" /></Button>
                        </>
                      )}
                      {r.payment_status !== "confirmed" && (
                        <Button size="icon" variant="ghost" title="Marcar pago" onClick={() => markPaid(r)}><CheckCircle className="w-4 h-4 text-green-600" /></Button>
                      )}
                      {r.guardian_phone && (
                        <a href={`https://wa.me/${normalizePhoneToWAPI(r.guardian_phone)}`} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="ghost" title="WhatsApp"><MessageCircle className="w-4 h-4" /></Button>
                        </a>
                      )}
                      {r.payment_status !== "cancelled" && (
                        <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancel(r)}><X className="w-4 h-4 text-orange-600" /></Button>
                      )}
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => remove(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum inscrito.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddOurStudentDialog open={addOpen} onOpenChange={setAddOpen} campId={campId} pkgs={pkgs} onAdded={load} />
      <ChangePaymentMethodDialog enrollment={payEdit} onClose={() => setPayEdit(null)} onUpdated={load} />
    </div>
  );
}

function ChangePaymentMethodDialog({ enrollment, onClose, onUpdated }: { enrollment: any; onClose: () => void; onUpdated: () => void }) {
  const [pkg, setPkg] = useState<any>(null);
  const [method, setMethod] = useState<string>("PIX");
  const [installments, setInstallments] = useState<number>(1);
  const [pixAmount, setPixAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [sendWhats, setSendWhats] = useState(true);

  useEffect(() => {
    if (!enrollment) return;
    (async () => {
      const { data } = await sb.from("vacation_camp_packages").select("*").eq("id", enrollment.package_id).maybeSingle();
      setPkg(data);
      const current = (enrollment.payment_method || "").toUpperCase();
      const allowed = (data?.payment_methods || ["PIX"]).map((m: string) => m.toUpperCase());
      setMethod(current && (allowed.includes(current) || current === "SPLIT") ? current : (allowed[0] || "PIX"));
      setInstallments(enrollment.installments || 1);
      const total = Number(enrollment.amount ?? data?.price ?? 0);
      setPixAmount(enrollment.split_pix_amount ?? Math.round(total / 2));
    })();
  }, [enrollment?.id]);

  if (!enrollment) return null;

  const total = Number(enrollment.amount ?? pkg?.price ?? 0);
  const allowed = (pkg?.payment_methods || ["PIX"]).map((m: string) => m.toUpperCase());
  const maxInst = Math.max(1, Number(pkg?.max_installments) || 1);
  const splitAvailable = allowed.includes("PIX") && allowed.includes("CREDIT_CARD");

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data, error } = await sb.functions.invoke("vacation-camp-pay-existing", {
        body: {
          action: "pay",
          enrollment_id: enrollment.id,
          payment_method: method,
          installments,
          pix_amount: method === "SPLIT" ? pixAmount : undefined,
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Falha");
      toast.success("Forma de pagamento atualizada");
      if (sendWhats && enrollment.guardian_phone) {
        const { error: ne } = await sb.functions.invoke("vacation-camp-notify", {
          body: { event: "payment_link", enrollment_id: enrollment.id },
        });
        if (ne) toast.warning("Atualizado, mas falha ao enviar WhatsApp");
        else toast.success("Link enviado por WhatsApp");
      }
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!enrollment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Alterar forma de pagamento</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-muted/40 rounded">
            <div className="font-medium">{enrollment.child_name}</div>
            <div className="text-xs text-muted-foreground">{pkg?.name} · R$ {total.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Atual: {enrollment.payment_method || "—"}</div>
          </div>

          <div>
            <Label>Nova forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowed.includes("PIX") && <SelectItem value="PIX">PIX</SelectItem>}
                {allowed.includes("CREDIT_CARD") && <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>}
                {allowed.includes("BOLETO") && <SelectItem value="BOLETO">Boleto</SelectItem>}
                {splitAvailable && <SelectItem value="SPLIT">Misto (PIX + Cartão)</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {(method === "CREDIT_CARD" || method === "SPLIT") && maxInst > 1 && (
            <div>
              <Label>Parcelas (cartão)</Label>
              <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {method === "SPLIT" && (
            <div>
              <Label>Valor no PIX (R$)</Label>
              <Input
                type="number" min={0.01} max={total - 0.01} step="0.01"
                value={pixAmount}
                onChange={(e) => setPixAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Restante no cartão: R$ {Math.max(0, total - pixAmount).toFixed(2)}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={sendWhats} onChange={(e) => setSendWhats(e.target.checked)} />
            Enviar novo link por WhatsApp ao responsável
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Atualizar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddOurStudentDialog({ open, onOpenChange, campId, pkgs, onAdded }: any) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [pkgId, setPkgId] = useState<string>("");
  const [createCharge, setCreateCharge] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  // Campos para aluno externo
  const [extGuardianName, setExtGuardianName] = useState("");
  const [extGuardianPhone, setExtGuardianPhone] = useState("");
  const [extGuardianCPF, setExtGuardianCPF] = useState("");
  const [extChildName, setExtChildName] = useState("");
  const [extChildAge, setExtChildAge] = useState("");
  const [extNotes, setExtNotes] = useState("");

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await sb.from("students").select("id, name, birth_date, guardian_id, guardians(name, phone, email, cpf)")
        .ilike("name", `%${q}%`).limit(10);
      setResults(data || []); setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Pre-fill custom amount when package changes
  useEffect(() => {
    const pkg = pkgs.find((p: any) => p.id === pkgId);
    if (pkg) setCustomAmount(String(Number(pkg.price).toFixed(2)));
    else setCustomAmount("");
  }, [pkgId, pkgs]);

  const add = async () => {
    const parsedAmount = customAmount.trim() === "" ? null : parseFloat(customAmount.replace(",", "."));
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount < 0)) {
      return toast.error("Valor inválido");
    }

    let guardianName: string, guardianPhone: string, guardianCPF: string | null, 
        childName: string, childAge: number | null, linkedStudentId: string | null;

    if (isExternal) {
      // Validação de campos obrigatórios para externo
      if (!extGuardianName.trim() || !extGuardianPhone.trim() || !extChildName.trim()) {
        return toast.error("Preencha nome do responsável, telefone e nome da criança");
      }
      guardianName = extGuardianName.trim();
      guardianPhone = extGuardianPhone.trim();
      guardianCPF = extGuardianCPF.trim() || null;
      childName = extChildName.trim();
      childAge = extChildAge.trim() ? parseInt(extChildAge) : null;
      linkedStudentId = null;
    } else {
      if (!selected || !pkgId) return toast.error("Selecione aluno e pacote");
      const g = selected.guardians;
      guardianName = g?.name || "";
      guardianPhone = g?.phone || "";
      guardianCPF = g?.cpf || null;
      childName = selected.name;
      childAge = selected.birth_date
        ? Math.floor((Date.now() - new Date(selected.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;
      linkedStudentId = selected.id;
    }

    setSaving(true);
    const enrollmentData: any = {
      camp_id: campId,
      package_id: pkgId || null,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      guardian_cpf: guardianCPF,
      child_name: childName,
      child_age: childAge,
      source: "admin",
      linked_student_id: linkedStudentId,
      payment_status: isExternal ? (createCharge ? "pending" : "confirmed") : (createCharge ? "pending" : "exempt"),
      amount_override: parsedAmount,
      payment_notes: isExternal ? "Pagamento externo combinado · " + (extNotes || "") : null,
      notes: isExternal ? extNotes || null : null,
    };

    const { data: inserted, error } = await sb.from("vacation_camp_enrollments").insert(enrollmentData).select().single();
    if (error) { setSaving(false); return toast.error(error.message); }

    // Envia link de pagamento se createCharge estiver marcado (interno OU externo)
    if (createCharge && inserted?.id && guardianPhone) {
      const { data: notifyData, error: notifyErr } = await sb.functions.invoke("vacation-camp-notify", {
        body: { event: "payment_link", enrollment_id: inserted.id },
      });
      if (notifyErr || notifyData?.error) {
        toast.warning("Aluno adicionado, mas falha ao enviar link");
      } else if (notifyData?.sent === false) {
        toast.warning("Aluno adicionado. WhatsApp não configurado.");
      } else {
        toast.success("Aluno adicionado e link de pagamento enviado por WhatsApp");
      }
    } else if (isExternal && !createCharge) {
      toast.success("Aluno externo adicionado (pagamento já confirmado)!");
    } else if (!isExternal && !createCharge) {
      toast.success("Aluno adicionado à colônia");
    }
    setSaving(false);
    resetForm();
    onAdded();
  };

  const resetForm = () => {
    onOpenChange(false); setSelected(null); setQ(""); setPkgId("");
    setCreateCharge(false); setCustomAmount(""); setIsExternal(false);
    setExtGuardianName(""); setExtGuardianPhone(""); setExtGuardianCPF("");
    setExtChildName(""); setExtChildAge(""); setExtNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isExternal ? "Adicionar aluno externo" : "Adicionar aluno nosso"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Toggle externo */}
          <label className="flex items-center gap-2 text-sm cursor-pointer bg-muted/50 p-3 rounded-lg">
            <input type="checkbox" checked={isExternal} onChange={(e) => { setIsExternal(e.target.checked); setSelected(null); setQ(""); setResults([]); }} />
            <span className="font-medium">Aluno externo</span>
            <span className="text-xs text-muted-foreground">— pais que não estão no sistema, preços negociados</span>
          </label>

          {isExternal ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nome do responsável *</Label>
                  <Input value={extGuardianName} onChange={(e) => setExtGuardianName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input value={extGuardianPhone} onChange={(e) => setExtGuardianPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CPF (opcional)</Label>
                  <Input value={extGuardianCPF} onChange={(e) => setExtGuardianCPF(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Nome da criança *</Label>
                  <Input value={extChildName} onChange={(e) => setExtChildName(e.target.value)} placeholder="Nome" />
                </div>
              </div>
              <div>
                <Label>Idade</Label>
                <Input type="number" value={extChildAge} onChange={(e) => setExtChildAge(e.target.value)} placeholder="Idade" />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={extNotes} onChange={(e) => setExtNotes(e.target.value)} placeholder="Negociação, valores combinados..." />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Buscar aluno</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome..." />
                </div>
                {searching && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
                {results.length > 0 && !selected && (
                  <div className="border rounded mt-1 max-h-48 overflow-y-auto">
                    {results.map((s) => (
                      <button key={s.id} onClick={() => { setSelected(s); setQ(s.name); setResults([]); }}
                        className="block w-full text-left px-3 py-2 hover:bg-muted text-sm">
                        {s.name} <span className="text-muted-foreground text-xs">— {s.guardians?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selected && (
                <Card className="p-3 bg-muted/50">
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">Resp.: {selected.guardians?.name} · {selected.guardians?.phone}</div>
                </Card>
              )}
            </>
          )}
          <div>
            <Label>Pacote</Label>
            <Select value={pkgId} onValueChange={setPkgId}>
              <SelectTrigger><SelectValue placeholder="Escolha o pacote" /></SelectTrigger>
              <SelectContent>{pkgs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor a cobrar (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={isExternal ? "Valor negociado com os pais" : "Sobrescreve o preço do pacote"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isExternal ? "Preencha o valor acordado ou deixe em branco para isento." : "Sobrescreve o preço do pacote. Deixe em branco para isento."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={createCharge} onChange={(e) => setCreateCharge(e.target.checked)} />
            {isExternal
              ? "Gerar cobrança e enviar link de pagamento por WhatsApp"
              : "Enviar link de pagamento ao responsável (PIX ou cartão). Se desmarcado, fica como isento."
            }
          </label>
          <Button onClick={add} disabled={saving || (!isExternal && !selected) || (!isExternal && !pkgId)} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== PRESENÇA ==========
function AttendanceTab({ campId }: { campId: string }) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [dayUseOnly, setDayUseOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: s }, { data: a }] = await Promise.all([
      sb.from("vacation_camp_enrollments").select("*, vacation_camp_packages(name)").eq("camp_id", campId).neq("payment_status", "cancelled").order("child_name"),
      sb.from("vacation_camp_schedule").select("*").eq("camp_id", campId).order("sort_order"),
      sb.from("vacation_camp_attendance").select("*").eq("camp_id", campId),
    ]);
    setEnrollments(e || []);
    setSchedule(s || []);
    setAttendance(a || []);
    if (!selectedDay && s?.length) setSelectedDay(s[0].day_label);
    setLoading(false);
  };
  useEffect(() => { load(); }, [campId]);

  // Gera os dias a partir da schedule
  const days = schedule.map(s => ({ label: s.day_label, sort: s.sort_order }));

  // Filtra inscritos por Day Use se o toggle estiver ativo
  const filteredEnrollments = dayUseOnly
    ? enrollments.filter(e => e.vacation_camp_packages?.name?.toLowerCase().includes("day"))
    : enrollments;

  // Encontra o dia selecionado na schedule
  const currentDaySchedule = schedule.find(s => s.day_label === selectedDay);
  const isPasseio = currentDaySchedule?.day_label === "Sexta-feira 10/07";

  const toggleAttendance = async (enrollmentId: string, dayLabel: string) => {
    const existing = attendance.find(a => a.enrollment_id === enrollmentId && a.day_date === dayLabelToDate(dayLabel));
    const dayDate = dayLabelToDate(dayLabel);

    if (existing) {
      // Alterna presença
      const newPresent = !existing.present;
      await sb.from("vacation_camp_attendance").update({
        present: newPresent,
        check_in_time: newPresent ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null,
      }).eq("id", existing.id);
    } else {
      // Cria registro
      await sb.from("vacation_camp_attendance").insert({
        enrollment_id: enrollmentId,
        camp_id: campId,
        day_date: dayDate,
        present: true,
        check_in_time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }
    // Recarrega attendance
    const { data: a } = await sb.from("vacation_camp_attendance").select("*").eq("camp_id", campId);
    setAttendance(a || []);
  };

  // Marca dia específico para Day Use
  const toggleDayUse = async (enrollmentId: string, dayLabel: string) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId);
    if (!enrollment) return;
    const current = (enrollment.scheduled_days || []) as string[];
    const idx = current.indexOf(dayLabel);
    const updated = idx >= 0 ? current.filter(d => d !== dayLabel) : [...current, dayLabel];
    await sb.from("vacation_camp_enrollments").update({ scheduled_days: updated }).eq("id", enrollmentId);
    setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, scheduled_days: updated } : e));
  };

  const isPresent = (enrollmentId: string) => {
    if (!selectedDay) return false;
    const dayDate = dayLabelToDate(selectedDay);
    const a = attendance.find(x => x.enrollment_id === enrollmentId && x.day_date === dayDate);
    return a?.present || false;
  };

  const getScheduledDays = (enrollment: any) => enrollment.scheduled_days || [];

  // Contadores
  const totalConfirmed = enrollments.filter(e => e.payment_status === "confirmed" || e.payment_status === "exempt").length;
  const presentToday = attendance.filter(a => a.day_date === dayLabelToDate(selectedDay) && a.present).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold">Controle de Presença</span>
        </div>
        <Select value={selectedDay} onValueChange={setSelectedDay}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map(d => (
              <SelectItem key={d.label} value={d.label}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Switch checked={dayUseOnly} onCheckedChange={setDayUseOnly} />
          <span>Day Use apenas</span>
        </label>
        <Badge variant="secondary">
          {presentToday}/{totalConfirmed} presentes hoje
        </Badge>
        {isPasseio && (
          <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
            ⚠️ Passeio: 8h-11h30 (calça comprida e tênis)
          </Badge>
        )}
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2 w-8">✅</th>
                  <th className="p-2">Criança</th>
                  <th className="p-2">Responsável</th>
                  <th className="p-2">Pacote</th>
                  <th className="p-2">Dias agendados</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.map((e) => {
                  const present = isPresent(e.id);
                  const isDayUse = e.vacation_camp_packages?.name?.toLowerCase().includes("day");
                  const scheduled = getScheduledDays(e);
                  return (
                    <tr key={e.id} className={`border-t ${present ? "bg-green-50" : ""}`}>
                      <td className="p-2">
                        <button
                          onClick={() => toggleAttendance(e.id, selectedDay)}
                          className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                            present ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                          }`}
                        >
                          {present ? "✓" : ""}
                        </button>
                      </td>
                      <td className="p-2 font-medium">{e.child_name}</td>
                      <td className="p-2">{e.guardian_name}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{e.vacation_camp_packages?.name || "—"}</Badge>
                          {isDayUse && (
                            <span className="text-xs text-muted-foreground">
                              {scheduled.length > 0 ? `${scheduled.length} dia(s)` : "Não agendado"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {isDayUse && (
                          <div className="flex flex-wrap gap-1">
                            {days.map(d => (
                              <button
                                key={d.label}
                                onClick={() => toggleDayUse(e.id, d.label)}
                                title={d.label}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  scheduled.includes(d.label)
                                    ? "bg-primary/20 text-primary font-semibold"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {d.sort}ª
                              </button>
                            ))}
                          </div>
                        )}
                        {!isDayUse && <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredEnrollments.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum inscrito confirmado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Legenda de dias */}
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-2">📅 Dias da colônia</h4>
        <div className="flex flex-wrap gap-2">
          {days.map(d => (
            <Badge key={d.label} variant={selectedDay === d.label ? "default" : "outline"}
              className="cursor-pointer" onClick={() => setSelectedDay(d.label)}>
              {d.sort}ª — {d.label}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}

function dayLabelToDate(label: string): string {
  // Converte "Segunda-feira 06/07" -> "2026-07-06"
  const match = label.match(/(\d{2})\/(\d{2})/);
  if (match) return `2026-07-${match[1]}`;
  return "";
}
