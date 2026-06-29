import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Image as ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { saveAs } from "file-saver";

const sb: any = supabase;

export default function VacationCampAlbum() {
  const { slug } = useParams<{ slug: string }>();
  const [camp, setCamp] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [actFilter, setActFilter] = useState<string>("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: c } = await sb.from("vacation_camps").select("*").eq("slug", slug).maybeSingle();
      setCamp(c);
      if (c && c.album_enabled) {
        const { data: ph } = await sb.from("vacation_camp_photos").select("*").eq("camp_id", c.id).order("created_at", { ascending: false });
        setPhotos(ph || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  const days = useMemo(() => Array.from(new Set(photos.map(p => p.day_label).filter(Boolean))) as string[], [photos]);
  const activities = useMemo(() => Array.from(new Set(photos.map(p => p.activity_tag).filter(Boolean))) as string[], [photos]);
  const filtered = useMemo(() => photos.filter(p => (!dayFilter || p.day_label === dayFilter) && (!actFilter || p.activity_tag === actFilter)), [photos, dayFilter, actFilter]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!camp) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Álbum não encontrado.</div>;
  if (!camp.album_enabled) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Álbum indisponível.</div>;

  const themeColor = camp.album_frame_color || camp.theme_color || "#f97316";

  const downloadOne = async (photo: any) => {
    try {
      const r = await fetch(photo.external_url, { mode: "cors" });
      const blob = await r.blob();
      const name = (photo.external_path?.split("/").pop()) || `foto-${photo.id}.jpg`;
      saveAs(blob, name);
    } catch {
      window.open(photo.external_url, "_blank");
    }
  };


  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${themeColor}15 0%, #fff 280px)` }}>
      <header className="px-4 py-8 md:py-12 text-center">
        {camp.album_logo_url && <img src={camp.album_logo_url} alt="logo" className="h-20 md:h-28 mx-auto mb-4 object-contain" />}
        <h1 className="text-3xl md:text-5xl font-bold" style={{ color: themeColor }}>
          {camp.album_title || `Álbum • ${camp.name}`}
        </h1>
        {camp.album_welcome_message && (
          <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">{camp.album_welcome_message}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{photos.length} foto(s) disponíveis</p>
      </header>

      <div className="px-4 max-w-6xl mx-auto pb-12">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant={dayFilter === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setDayFilter("")}>Todos os dias</Badge>
          {days.map(d => (
            <Badge key={d} variant={dayFilter === d ? "default" : "outline"} className="cursor-pointer" style={dayFilter === d ? { background: themeColor } : {}} onClick={() => setDayFilter(d)}>{d}</Badge>
          ))}
          {activities.length > 0 && <span className="mx-2 text-muted-foreground">|</span>}
          {activities.length > 0 && (
            <Badge variant={actFilter === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setActFilter("")}>Todas atividades</Badge>
          )}
          {activities.map(a => (
            <Badge key={a} variant={actFilter === a ? "default" : "outline"} className="cursor-pointer" onClick={() => setActFilter(a)}>{a}</Badge>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            Nenhuma foto encontrada.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
            {filtered.map((p, idx) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                <button onClick={() => setLightboxIdx(idx)} className="absolute inset-0">
                  <img src={p.external_url} loading="lazy" alt={p.activity_tag || ""} className="w-full h-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] p-2 text-left opacity-0 group-hover:opacity-100 transition">
                    {p.day_label}{p.activity_tag ? ` · ${p.activity_tag}` : ""}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadOne(p); }}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition"
                  title="Baixar foto"
                  style={{ color: themeColor }}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && filtered[lightboxIdx] && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 text-white p-2" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i ?? 0) - 1); }}>
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {lightboxIdx < filtered.length - 1 && (
            <button className="absolute right-4 text-white p-2" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i ?? 0) + 1); }}>
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={filtered[lightboxIdx].external_url} className="max-w-full max-h-[80vh] object-contain rounded" alt="" />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-white text-sm">{filtered[lightboxIdx].day_label}{filtered[lightboxIdx].activity_tag ? ` · ${filtered[lightboxIdx].activity_tag}` : ""}</span>
              <Button size="sm" onClick={() => downloadOne(filtered[lightboxIdx])} style={{ background: themeColor }}>
                <Download className="w-4 h-4 mr-2" /> Baixar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
