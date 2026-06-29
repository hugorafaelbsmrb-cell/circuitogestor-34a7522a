import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, Image as ImageIcon, Trash2, CheckCircle2, Camera } from "lucide-react";
import { processImage } from "@/utils/photoProcessor";

const sb: any = supabase;

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

export default function VacationCampPublicUpload() {
  const { slug } = useParams<{ slug: string }>();
  const [camp, setCamp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dayLabel, setDayLabel] = useState("");
  const [activityTag, setActivityTag] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("vacation_camps").select("id, name, slug, album_logo_url, album_title, album_frame_color, public_uploads_enabled, theme_primary_color").eq("slug", slug).maybeSingle();
      setCamp(data);
      setLoading(false);
      try {
        const saved = localStorage.getItem("vc_uploader");
        if (saved) {
          const j = JSON.parse(saved);
          setName(j.name || ""); setPhone(j.phone || "");
        }
      } catch {}
    })();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!camp) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Colônia não encontrada.</div>;
  if (!camp.public_uploads_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold">Envio público indisponível</h1>
          <p className="text-sm text-muted-foreground">O envio de fotos pelos pais ainda não foi liberado para esta colônia.</p>
          <Link to={`/colonia/${camp.slug}/album`}><Button variant="outline" size="sm">Ver álbum</Button></Link>
        </Card>
      </div>
    );
  }

  const primary = camp.theme_primary_color || "#f97316";

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const list: PendingPhoto[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f), status: "pending",
    }));
    setPending(p => [...list, ...p]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (pid: string) => setPending(p => p.filter(x => x.id !== pid));

  const uploadAll = async () => {
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome"); return; }
    if (!pending.length) return;
    setUploading(true);
    try { localStorage.setItem("vc_uploader", JSON.stringify({ name, phone })); } catch {}

    let done = 0;
    for (const item of pending) {
      if (item.status === "done") continue;
      setPending(p => p.map(x => x.id === item.id ? { ...x, status: "uploading" } : x));
      try {
        const processed = await processImage(item.file, {
          logoUrl: camp.album_logo_url,
          frameColor: camp.album_frame_color || primary,
          eventTitle: camp.album_title || camp.name,
          watermark: !!camp.album_logo_url,
          frame: false,
        });
        const fileName = `${camp.slug}-pub-${Date.now()}-${item.file.name.replace(/[^a-z0-9.]+/gi, "_")}`.replace(/\.[^.]+$/, ".jpg");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vacation-camp-photo-upload-public`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({
            campSlug: camp.slug,
            fileName,
            base64: processed.dataUrl,
            contentType: "image/jpeg",
            dayLabel: dayLabel || null,
            activityTag: activityTag || null,
            uploaderName: name.trim(),
            uploaderPhone: phone.trim() || null,
            hasWatermark: !!camp.album_logo_url,
            hasFrame: false,
            width: processed.width,
            height: processed.height,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        setPending(p => p.map(x => x.id === item.id ? { ...x, status: "done" } : x));
        done++;
      } catch (e: any) {
        setPending(p => p.map(x => x.id === item.id ? { ...x, status: "error", errorMsg: e.message } : x));
        toast.error(`Falha em ${item.file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    setSentCount(c => c + done);
    if (done > 0) toast.success(`${done} foto(s) enviada(s)! Obrigado 💛`);
    setTimeout(() => setPending(p => p.filter(x => x.status !== "done")), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3 pt-2">
          {camp.album_logo_url ? (
            <img src={camp.album_logo_url} alt="" className="w-12 h-12 object-contain rounded" />
          ) : (
            <div className="w-12 h-12 rounded flex items-center justify-center text-white" style={{ background: primary }}>
              <Camera className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Envie suas fotos</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{camp.album_title || camp.name}</p>
          </div>
        </div>

        <Card className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Seu nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Como devemos te chamar" />
            </div>
            <div>
              <Label>WhatsApp (opcional)</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Dia (opcional)</Label>
              <Input value={dayLabel} onChange={e => setDayLabel(e.target.value)} placeholder="Ex.: Dia 1 — 06/07" />
            </div>
            <div>
              <Label>Atividade (opcional)</Label>
              <Input value={activityTag} onChange={e => setActivityTag(e.target.value)} placeholder="Ex.: Piscina" />
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
          <Button
            onClick={() => fileRef.current?.click()}
            className="w-full h-14 text-base"
            style={{ background: primary }}
          >
            <Upload className="w-5 h-5 mr-2" /> Selecionar fotos do dispositivo
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">Você pode enviar várias fotos de uma vez. A marca d'água da colônia é aplicada automaticamente.</p>
        </Card>

        {pending.length > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">{pending.length} foto(s) prontas</h2>
              <Button onClick={uploadAll} disabled={uploading} style={{ background: primary }}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Enviar agora
              </Button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {pending.map(p => (
                <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                  <img src={p.previewUrl} className="w-full h-full object-cover" alt="" />
                  {p.status === "uploading" && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>}
                  {p.status === "done" && <div className="absolute inset-0 bg-emerald-600/70 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-white" /></div>}
                  {p.status === "error" && <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-[10px] text-white p-1 text-center">{p.errorMsg}</div>}
                  {p.status === "pending" && (
                    <button onClick={() => removePending(p.id)} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {sentCount > 0 && (
          <Card className="p-4 flex items-center gap-3 bg-emerald-50 border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-5 h-5" />
            <div className="flex-1 text-sm">
              <strong>{sentCount}</strong> foto(s) enviada(s) nesta sessão. Obrigado por compartilhar!
            </div>
            <Badge variant="secondary"><ImageIcon className="w-3 h-3 mr-1" />álbum</Badge>
          </Card>
        )}

        <div className="text-center pt-2">
          <Link to={`/colonia/${camp.slug}/album`} className="text-sm underline text-muted-foreground">Ver álbum público</Link>
        </div>
      </div>
    </div>
  );
}
