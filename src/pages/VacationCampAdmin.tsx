import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Loader2, Palmtree, Settings2, Trash2, Users, Wallet, CheckCircle2, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Camp {
  id: string; name: string; slug: string; status: string;
  start_date: string | null; end_date: string | null;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

interface StatRow {
  payment_status: string;
  qtd: number;
  total: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmado", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  received: { label: "Recebido", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-200" },
  reserved: { label: "Reservado", color: "bg-sky-100 text-sky-700 border-sky-200" },
  overdue: { label: "Vencido", color: "bg-rose-100 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border" },
  refunded: { label: "Estornado", color: "bg-muted text-muted-foreground border-border" },
};

const PAID_STATUSES = ["paid", "received", "confirmed"];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function VacationCampAdmin() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newCamp, setNewCamp] = useState({ name: "", slug: "" });
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [campFilter, setCampFilter] = useState<string>("all");

  const loadStats = async (campId: string) => {
    setStatsLoading(true);
    let q = supabase
      .from("vacation_camp_enrollments")
      .select("payment_status, amount, amount_override");
    if (campId !== "all") q = q.eq("camp_id", campId);
    const { data } = await q;
    const map = new Map<string, { qtd: number; total: number }>();
    (data || []).forEach((r: any) => {
      const status = r.payment_status || "pending";
      const value = Number(r.amount_override ?? r.amount ?? 0);
      const cur = map.get(status) || { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += value;
      map.set(status, cur);
    });
    setStats(
      Array.from(map.entries())
        .map(([payment_status, v]) => ({ payment_status, ...v }))
        .sort((a, b) => a.payment_status.localeCompare(b.payment_status))
    );
    setStatsLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("vacation_camps").select("*").order("created_at", { ascending: false });
    setCamps(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { loadStats(campFilter); }, [campFilter]);

  const totalQtd = stats.reduce((s, r) => s + r.qtd, 0);
  const totalValor = stats.reduce((s, r) => s + r.total, 0);
  const recebido = stats
    .filter((r) => PAID_STATUSES.includes(r.payment_status))
    .reduce((s, r) => s + r.total, 0);
  const aReceber = totalValor - recebido;

  const create = async () => {
    if (!newCamp.name.trim()) return toast.error("Nome obrigatório");
    const slug = (newCamp.slug || slugify(newCamp.name)).trim();
    if (!slug) return toast.error("Slug inválido");
    setCreating(true);
    const { error } = await supabase.from("vacation_camps").insert({
      name: newCamp.name, slug, status: "draft",
      hero_title: newCamp.name,
      cta_text: "Garantir vaga",
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Colônia criada");
    setOpen(false);
    setNewCamp({ name: "", slug: "" });
    load();
  };

  const togglePublish = async (camp: Camp) => {
    const next = camp.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("vacation_camps").update({ status: next }).eq("id", camp.id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Publicada" : "Despublicada");
    load();
  };

  const remove = async (camp: Camp) => {
    if (!confirm(`Excluir "${camp.name}"? Isso removerá pacotes, programação e inscritos.`)) return;
    const { error } = await supabase.from("vacation_camps").delete().eq("id", camp.id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    load();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/colonia/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palmtree className="w-6 h-6 text-primary" />
            Colônia de Férias
          </h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie edições da colônia</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nova edição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova colônia</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={newCamp.name}
                  onChange={(e) => setNewCamp({ name: e.target.value, slug: slugify(e.target.value) })}
                  placeholder="Ex: Colônia de Julho 2026"
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={newCamp.slug}
                  onChange={(e) => setNewCamp({ ...newCamp, slug: slugify(e.target.value) })}
                  placeholder="colonia-julho-2026"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  /colonia/{newCamp.slug || "..."}
                </p>
              </div>
              <Button onClick={create} disabled={creating} className="w-full">
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Painel de acompanhamento financeiro */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Acompanhamento financeiro
            </h2>
            <p className="text-xs text-muted-foreground">Inscrições e valores por status de pagamento</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Edição:</Label>
            <Select value={campFilter} onValueChange={setCampFilter}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as edições</SelectItem>
                {camps.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> Inscrições</div>
                <div className="text-2xl font-bold mt-1">{totalQtd}</div>
              </Card>
              <Card className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50">
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Recebido</div>
                <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{fmtBRL(recebido)}</div>
              </Card>
              <Card className="p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200/50">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> A receber</div>
                <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{fmtBRL(aReceber)}</div>
              </Card>
              <Card className="p-3 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 text-xs text-primary"><Wallet className="w-3.5 h-3.5" /> Total geral</div>
                <div className="text-2xl font-bold mt-1 text-primary">{fmtBRL(totalValor)}</div>
              </Card>
            </div>

            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma inscrição ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 font-medium text-right">Quantidade</th>
                      <th className="py-2 px-2 font-medium text-right">Valor</th>
                      <th className="py-2 px-2 font-medium text-right">% do total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((r) => {
                      const meta = STATUS_LABEL[r.payment_status] || { label: r.payment_status, color: "bg-muted text-muted-foreground border-border" };
                      const pct = totalValor > 0 ? (r.total / totalValor) * 100 : 0;
                      return (
                        <tr key={r.payment_status} className="border-b last:border-0">
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                          </td>
                          <td className="py-2 px-2 text-right font-medium">{r.qtd}</td>
                          <td className="py-2 px-2 text-right font-medium">{fmtBRL(r.total)}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">{totalQtd}</td>
                      <td className="py-2 px-2 text-right">{fmtBRL(totalValor)}</td>
                      <td className="py-2 px-2 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </Card>


      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : camps.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhuma colônia criada ainda.
        </Card>
      ) : (
        <div className="grid gap-3">
          {camps.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge variant={c.status === "published" ? "default" : "secondary"}>
                    {c.status === "published" ? "Publicada" : c.status === "closed" ? "Encerrada" : "Rascunho"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">/colonia/{c.slug}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyLink(c.slug)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <a href={`/colonia/${c.slug}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5" /></Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => togglePublish(c)}>
                  {c.status === "published" ? "Despublicar" : "Publicar"}
                </Button>
                <Link to={`/colonia-admin/${c.id}`}>
                  <Button size="sm"><Settings2 className="w-3.5 h-3.5 mr-1" /> Editar</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
