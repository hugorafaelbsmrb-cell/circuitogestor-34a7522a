import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, CalendarDays, MapPin, Users, Sparkles, Check, Copy,
  Sun, Palette, Music, Gamepad2, BookOpen, Smile, Trophy, Pizza,
  Camera, Heart, Star, Rocket, Zap, Leaf, Droplets, Wand2,
} from "lucide-react";
import { formatCPF, formatPhone, isValidCPF } from "@/utils/validators";

const ICON_MAP: Record<string, any> = {
  Sparkles, Sun, Palette, Music, Gamepad2, BookOpen, Smile, Trophy,
  Pizza, Camera, Heart, Star, Rocket, Zap, Leaf, Droplets, Wand2, CalendarDays,
};

interface Camp {
  id: string; name: string; slug: string; description: string | null;
  hero_title: string | null; hero_subtitle: string | null; hero_image_url: string | null;
  gallery: any; highlights: any; faq: any;
  start_date: string | null; end_date: string | null; location: string | null;
  age_min: number | null; age_max: number | null;
  theme_color: string | null; cta_text: string | null; whatsapp_number: string | null;
  terms_text: string | null;
}
interface Pkg {
  id: string; name: string; description: string | null; price: number; original_price: number | null;
  max_slots: number | null; sold_count: number; active: boolean;
  payment_methods: string[]; max_installments: number; due_days: number; includes: any;
}
interface ScheduleItem {
  id: string; day_label: string; time_label: string | null; title: string;
  description: string | null; icon: string | null; sort_order: number;
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "";

export default function VacationCampLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [camp, setCamp] = useState<Camp | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase.from("vacation_camps").select("*").eq("slug", slug).maybeSingle();
      if (!c) { setLoading(false); return; }
      setCamp(c as any);
      const [{ data: pk }, { data: sc }] = await Promise.all([
        supabase.from("vacation_camp_packages").select("*").eq("camp_id", c.id).eq("active", true).order("sort_order"),
        supabase.from("vacation_camp_schedule").select("*").eq("camp_id", c.id).order("sort_order"),
      ]);
      setPackages((pk || []) as any);
      setSchedule((sc || []) as any);
      setLoading(false);
    })();
  }, [slug]);

  const scheduleByDay = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    schedule.forEach((s) => {
      map[s.day_label] = map[s.day_label] || [];
      map[s.day_label].push(s);
    });
    return map;
  }, [schedule]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!camp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Colônia não encontrada.</p>
      </div>
    );
  }

  const theme = camp.theme_color || "#f97316";
  const highlights = (camp.highlights as any[]) || [];
  const gallery = (camp.gallery as string[]) || [];
  const faq = (camp.faq as any[]) || [];

  const openCheckout = (pkg: Pkg) => {
    setSelectedPkg(pkg);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--camp" as any]: theme }}>
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: `linear-gradient(135deg, ${theme}, ${theme}cc 60%, hsl(var(--background)))`,
          }}
        />
        {camp.hero_image_url && (
          <img
            src={camp.hero_image_url}
            alt={camp.name}
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
          />
        )}
        <div className="relative container max-w-6xl mx-auto px-6 py-20 md:py-32">
          <Badge className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur">
            <Sparkles className="w-3 h-3 mr-1" /> Colônia de Férias
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow mb-4 max-w-3xl">
            {camp.hero_title || camp.name}
          </h1>
          {camp.hero_subtitle && (
            <p className="text-lg md:text-2xl text-white/90 max-w-2xl mb-8">{camp.hero_subtitle}</p>
          )}
          <div className="flex flex-wrap gap-3 text-white/90 text-sm mb-8">
            {(camp.start_date || camp.end_date) && (
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full">
                <CalendarDays className="w-4 h-4" />
                {fmtDate(camp.start_date)} {camp.end_date ? `a ${fmtDate(camp.end_date)}` : ""}
              </span>
            )}
            {camp.location && (
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full">
                <MapPin className="w-4 h-4" /> {camp.location}
              </span>
            )}
            {(camp.age_min || camp.age_max) && (
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full">
                <Users className="w-4 h-4" /> {camp.age_min ?? "?"} a {camp.age_max ?? "?"} anos
              </span>
            )}
          </div>
          <Button
            size="lg"
            className="text-base font-semibold shadow-lg"
            style={{ background: "white", color: theme }}
            onClick={() => document.getElementById("pacotes")?.scrollIntoView({ behavior: "smooth" })}
          >
            {camp.cta_text || "Garantir vaga"}
          </Button>
        </div>
      </header>

      {/* HIGHLIGHTS */}
      {highlights.length > 0 && (
        <section className="container max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {highlights.map((h: any, i: number) => {
              const Icon = ICON_MAP[h.icon] || Sparkles;
              return (
                <Card key={i} className="p-5 text-center hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div
                    className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${theme}22`, color: theme }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm">{h.title}</div>
                  {h.description && <div className="text-xs text-muted-foreground mt-1">{h.description}</div>}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* DESCRIÇÃO */}
      {camp.description && (
        <section className="container max-w-3xl mx-auto px-6 py-8">
          <p className="text-lg leading-relaxed text-muted-foreground text-center">{camp.description}</p>
        </section>
      )}

      {/* PROGRAMAÇÃO */}
      {schedule.length > 0 && (
        <section className="container max-w-5xl mx-auto px-6 py-14">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-2">Programação</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Tem diversão o dia todo</h2>
          </div>
          <div className="space-y-8">
            {Object.entries(scheduleByDay).map(([day, items]) => (
              <div key={day} className="relative">
                <div
                  className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-4"
                  style={{ background: `${theme}22`, color: theme }}
                >
                  {day}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((it) => {
                    const Icon = ICON_MAP[it.icon || "Sparkles"] || Sparkles;
                    return (
                      <Card key={it.id} className="p-4 flex gap-3 hover:shadow-md transition-all">
                        <div
                          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
                          style={{ background: `${theme}1a`, color: theme }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            {it.time_label && (
                              <span className="text-xs font-mono font-semibold" style={{ color: theme }}>
                                {it.time_label}
                              </span>
                            )}
                            <span className="font-semibold text-sm">{it.title}</span>
                          </div>
                          {it.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GALERIA */}
      {gallery.length > 0 && (
        <section className="container max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Olha como é</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PACOTES */}
      <section id="pacotes" className="container max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-2">Escolha seu pacote</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Garanta a vaga</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((p) => {
            const left = p.max_slots ? Math.max(0, p.max_slots - p.sold_count) : null;
            const soldOut = left === 0;
            const includes = (p.includes as string[]) || [];
            return (
              <Card key={p.id} className="p-6 flex flex-col relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: theme }}
                />
                <h3 className="text-xl font-bold">{p.name}</h3>
                {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                <div className="mt-4">
                  {p.original_price && p.original_price > p.price && (
                    <div className="text-sm text-muted-foreground line-through">{fmtBRL(Number(p.original_price))}</div>
                  )}
                  <div className="text-3xl font-bold" style={{ color: theme }}>{fmtBRL(Number(p.price))}</div>
                </div>
                {includes.length > 0 && (
                  <ul className="mt-4 space-y-2 flex-1">
                    {includes.map((inc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme }} />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {left !== null && (
                  <div className="text-xs text-muted-foreground mt-4">
                    {soldOut ? "Esgotado" : `${left} vagas restantes`}
                  </div>
                )}
                <Button
                  className="mt-5 w-full text-white"
                  style={{ background: theme }}
                  disabled={soldOut}
                  onClick={() => openCheckout(p)}
                >
                  {soldOut ? "Esgotado" : "Quero esse"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="container max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Perguntas frequentes</h2>
          <div className="space-y-3">
            {faq.map((q: any, i: number) => (
              <Card key={i} className="p-5">
                <div className="font-semibold">{q.question}</div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{q.answer}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="border-t mt-14 py-8 text-center text-sm text-muted-foreground">
        {camp.terms_text && <p className="max-w-2xl mx-auto px-6 mb-4 whitespace-pre-line">{camp.terms_text}</p>}
        {camp.whatsapp_number && (
          <a
            href={`https://wa.me/${camp.whatsapp_number.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 underline"
          >
            Falar no WhatsApp
          </a>
        )}
      </footer>

      {checkoutOpen && selectedPkg && camp && (
        <CheckoutDialog
          camp={camp}
          pkg={selectedPkg}
          theme={theme}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
        />
      )}
    </div>
  );
}

function CheckoutDialog({
  camp, pkg, theme, open, onOpenChange,
}: { camp: Camp; pkg: Pkg; theme: string; open: boolean; onOpenChange: (b: boolean) => void }) {
  const [step, setStep] = useState<"form" | "payment">("form");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    guardian_name: "", guardian_phone: "", guardian_email: "", guardian_cpf: "",
    child_name: "", child_age: "", payment_method: (pkg.payment_methods?.[0] || "PIX").toUpperCase(),
    installments: 1, notes: "",
  });

  const methods = (pkg.payment_methods || ["PIX"]).map((m) => m.toUpperCase());

  const submit = async () => {
    if (!form.guardian_name.trim() || !form.guardian_phone.trim() || !form.guardian_cpf.trim() || !form.child_name.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!isValidCPF(form.guardian_cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vacation-camp-checkout", {
        body: {
          camp_slug: camp.slug,
          package_id: pkg.id,
          ...form,
          child_age: form.child_age ? parseInt(form.child_age) : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setStep("payment");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar inscrição");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === "form" ? `Inscrição — ${pkg.name}` : "Quase lá!"}</DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-3">
            <div>
              <Label>Nome do responsável *</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone *</Label>
                <Input
                  value={form.guardian_phone}
                  onChange={(e) => setForm({ ...form, guardian_phone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  value={form.guardian_cpf}
                  onChange={(e) => setForm({ ...form, guardian_cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} />
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <Label>Nome completo da criança *</Label>
                <Input value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} />
              </div>
              <div>
                <Label>Idade *</Label>
                <Input type="number" value={form.child_age} onChange={(e) => setForm({ ...form, child_age: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {methods.includes("PIX") && <SelectItem value="PIX">PIX</SelectItem>}
                  {methods.includes("BOLETO") && <SelectItem value="BOLETO">Boleto</SelectItem>}
                  {methods.includes("CREDIT_CARD") && <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {form.payment_method === "CREDIT_CARD" && pkg.max_installments > 1 && (
              <div>
                <Label>Parcelas</Label>
                <Select value={String(form.installments)} onValueChange={(v) => setForm({ ...form, installments: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: pkg.max_installments }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1}x de {fmtBRL(Number(pkg.price) / (i + 1))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm">
                Total: <strong style={{ color: theme }}>{fmtBRL(Number(pkg.price))}</strong>
              </div>
              <Button onClick={submit} disabled={loading} style={{ background: theme }} className="text-white">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Finalizar inscrição
              </Button>
            </div>
          </div>
        )}

        {step === "payment" && result?.payment && (
          <PaymentInstructions payment={result.payment} theme={theme} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentInstructions({ payment, theme }: { payment: any; theme: string }) {
  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado!");
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Inscrição registrada! Conclua o pagamento abaixo para confirmar a vaga.
      </p>
      {payment.billingType === "PIX" && payment.pixEncodedImage && (
        <div className="text-center">
          <img
            src={`data:image/png;base64,${payment.pixEncodedImage}`}
            alt="QR Code PIX"
            className="w-56 h-56 mx-auto rounded-lg border bg-white p-2"
          />
          {payment.pixPayload && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-mono break-all bg-muted p-2 rounded">{payment.pixPayload}</div>
              <Button size="sm" variant="outline" onClick={() => copy(payment.pixPayload)} className="w-full">
                <Copy className="w-3 h-3 mr-2" /> Copiar código PIX
              </Button>
            </div>
          )}
        </div>
      )}
      {payment.billingType === "BOLETO" && payment.bankSlipUrl && (
        <a href={payment.bankSlipUrl} target="_blank" rel="noreferrer">
          <Button className="w-full text-white" style={{ background: theme }}>
            Abrir boleto
          </Button>
        </a>
      )}
      {payment.billingType === "CREDIT_CARD" && payment.invoiceUrl && (
        <a href={payment.invoiceUrl} target="_blank" rel="noreferrer">
          <Button className="w-full text-white" style={{ background: theme }}>
            Pagar com cartão
          </Button>
        </a>
      )}
      {payment.invoiceUrl && payment.billingType !== "CREDIT_CARD" && (
        <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="block text-xs text-center text-muted-foreground underline">
          Ver fatura completa
        </a>
      )}
    </div>
  );
}
