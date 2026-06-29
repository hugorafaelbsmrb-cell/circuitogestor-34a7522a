import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Loader2, Image as ImageIcon, ExternalLink, Copy } from "lucide-react";
import { processImage } from "@/utils/photoProcessor";

const sb: any = supabase;

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  dayLabel: string;
  activityTag: string;
  scheduleId: string;
  watermark: boolean;
  frame: boolean;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

export default function VacationCampPhotos() {
  const { id } = useParams<{ id: string }>();
  const { isAuthorized, isLoading: guardLoading } = useAdminGuard();
  const [camp, setCamp] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Defaults applied to newly added files
  const [defaultDay, setDefaultDay] = useState("");
  const [defaultActivity, setDefaultActivity] = useState("");
  const [defaultScheduleId, setDefaultScheduleId] = useState("");
  const [defaultWatermark, setDefaultWatermark] = useState(true);
  const [defaultFrame, setDefaultFrame] = useState(false);

  const load = async () => {
    const { data: c } = await sb.from("vacation_camps").select("*").eq("id", id).single();
    setCamp(c);
    const { data: sched } = await sb.from("vacation_camp_schedule").select("*").eq("camp_id", id).order("date", { ascending: true });
    setSchedule(sched || []);
    const { data: ph } = await sb.from("vacation_camp_photos").select("*").eq("camp_id", id).order("created_at", { ascending: false });
    setPhotos(ph || []);
  };

  useEffect(() => { if (id) load(); }, [id]);

  if (guardLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-6">Acesso restrito.</div>;
  if (!camp) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const list: PendingPhoto[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      dayLabel: defaultDay,
      activityTag: defaultActivity,
      scheduleId: defaultScheduleId,
      watermark: defaultWatermark,
      frame: defaultFrame,
      status: "pending",
    }));
    setPending(p => [...list, ...p]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const updatePending = (pid: string, patch: Partial<PendingPhoto>) => {
    setPending(p => p.map(x => x.id === pid ? { ...x, ...patch } : x));
  };

  const removePending = (pid: string) => setPending(p => p.filter(x => x.id !== pid));

  const uploadAll = async () => {
    if (!pending.length) return;
    if (!camp.album_logo_url && (pending.some(p => p.watermark || p.frame))) {
      const cont = confirm("Você marcou marca d'água ou moldura, mas o evento não tem logo configurado. Continuar mesmo assim?");
      if (!cont) return;
    }
    setUploading(true);
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.access_token;
    if (!token) { toast.error("Sessão expirada"); setUploading(false); return; }

    for (const item of pending) {
      if (item.status === "done") continue;
      updatePending(item.id, { status: "uploading" });
      try {
        const processed = await processImage(item.file, {
          logoUrl: camp.album_logo_url,
          frameColor: camp.album_frame_color || "#f97316",
          eventTitle: camp.album_title || camp.name,
          watermark: item.watermark,
          frame: item.frame,
        });

        const fileName = `${camp.slug}-${Date.now()}-${item.file.name.replace(/[^a-z0-9.]+/gi, "_")}`.replace(/\.[^.]+$/, ".jpg");

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vacation-camp-photo-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            fileName,
            base64: processed.dataUrl,
            contentType: "image/jpeg",
            campId: camp.id,
            dayLabel: item.dayLabel || null,
            activityTag: item.activityTag || null,
            scheduleId: item.scheduleId || null,
            hasWatermark: item.watermark,
            hasFrame: item.frame,
            width: processed.width,
            height: processed.height,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        updatePending(item.id, { status: "done" });
      } catch (e: any) {
        updatePending(item.id, { status: "error", errorMsg: e.message });
        toast.error(`Falha em ${item.file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    await load();
    setTimeout(() => setPending(p => p.filter(x => x.status !== "done")), 1500);
  };

  const removePhoto = async (photoId: string) => {
    if (!confirm("Excluir esta foto?")) return;
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vacation-camp-photo-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photoId }),
    });
    if (res.ok) { toast.success("Foto removida"); load(); }
    else toast.error("Erro ao remover");
  };

  const publicUrl = `${window.location.origin}/colonia/${camp.slug}/album`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to={`/colonia-admin/${camp.id}`}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Álbum de Fotos — {camp.name}</h1>
          <p className="text-xs text-muted-foreground">Envie as fotos da colônia. Marca d'água e moldura são aplicadas antes do upload.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
          <Copy className="w-4 h-4 mr-2" /> Link público
        </Button>
        <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-2" /> Abrir álbum</Button></a>
      </div>

      {!camp.album_logo_url && (
        <Card className="p-4 bg-amber-50 border-amber-200 text-sm text-amber-900">
          Nenhuma logo do álbum configurada. Adicione em <Link to={`/colonia-admin/${camp.id}`} className="underline font-medium">Editor → Álbum</Link>.
        </Card>
      )}

      {/* Defaults + upload */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Dia padrão</Label>
            <Input value={defaultDay} onChange={e => setDefaultDay(e.target.value)} placeholder="Ex.: Dia 1 — 06/07" />
          </div>
          <div>
            <Label>Atividade padrão</Label>
            <Input value={defaultActivity} onChange={e => setDefaultActivity(e.target.value)} placeholder="Ex.: Piscina" />
          </div>
          <div>
            <Label>Programação vinculada</Label>
            <Select value={defaultScheduleId || "none"} onValueChange={v => setDefaultScheduleId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {schedule.map(s => <SelectItem key={s.id} value={s.id}>{s.date} — {s.title || s.activity || "Atividade"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={defaultWatermark} onCheckedChange={setDefaultWatermark} /> Marca d'água padrão</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={defaultFrame} onCheckedChange={setDefaultFrame} /> Moldura temática padrão</label>
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Selecionar fotos</Button>
          {pending.length > 0 && (
            <Button onClick={uploadAll} disabled={uploading} variant="default">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar {pending.length} foto(s)
            </Button>
          )}
        </div>
      </Card>

      {/* Pending list */}
      {pending.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 text-sm">Fotos a enviar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map(p => (
              <div key={p.id} className="flex gap-3 border rounded-md p-2">
                <img src={p.previewUrl} className="w-24 h-24 object-cover rounded" alt="" />
                <div className="flex-1 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.file.name}</span>
                    {p.status === "done" && <Badge className="bg-emerald-600">Enviada</Badge>}
                    {p.status === "uploading" && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />enviando</Badge>}
                    {p.status === "error" && <Badge variant="destructive" title={p.errorMsg}>erro</Badge>}
                  </div>
                  <Input className="h-8" placeholder="Dia" value={p.dayLabel} onChange={e => updatePending(p.id, { dayLabel: e.target.value })} />
                  <Input className="h-8" placeholder="Atividade" value={p.activityTag} onChange={e => updatePending(p.id, { activityTag: e.target.value })} />
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1"><Switch checked={p.watermark} onCheckedChange={v => updatePending(p.id, { watermark: v })} /> Marca</label>
                    <label className="flex items-center gap-1"><Switch checked={p.frame} onCheckedChange={v => updatePending(p.id, { frame: v })} /> Moldura</label>
                    <Button size="sm" variant="ghost" onClick={() => removePending(p.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Existing photos */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4" />Fotos publicadas ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map(ph => (
              <div key={ph.id} className="group relative aspect-square rounded-md overflow-hidden border bg-muted">
                <img src={ph.external_url} loading="lazy" className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] p-1 flex justify-between gap-1">
                  <span className="truncate">{ph.day_label || ""}{ph.activity_tag ? ` · ${ph.activity_tag}` : ""}</span>
                </div>
                <button onClick={() => removePhoto(ph.id)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
