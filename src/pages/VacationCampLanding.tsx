import { useEffect, useMemo, useState, useCallback } from "react";
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
  Clock, Timer, PartyPopper,
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
  students_only?: boolean; price_negotiable?: boolean;
  card_interest_free_installments?: number; card_interest_percent?: number;
}

/** Computes installment value using Tabela Price compound interest. */
function calcInstallment(price: number, n: number, freeInst: number, monthlyPct: number) {
  if (n <= Math.max(1, freeInst) || monthlyPct <= 0) {
    return { perInstallment: price / n, total: price };
  }
  const i = monthlyPct / 100;
  const factor = Math.pow(1 + i, n);
  const pmt = (price * i * factor) / (factor - 1);
  return { perInstallment: pmt, total: pmt * n };
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

  // ===== COUNTDOWN =====
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!camp?.start_date) return null;
    const start = new Date(camp.start_date + "T14:00:00-03:00");
    const diff = start.getTime() - now.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
  }, [camp?.start_date, now]);

  // ===== DESTAQUE DO DIA =====
  const todayHighlight = useMemo(() => {
    if (!camp?.start_date || !camp?.end_date || schedule.length === 0) return null;
    const today = new Date();
    const start = new Date(camp.start_date + "T00:00:00-03:00");
    const end = new Date(camp.end_date + "T23:59:59-03:00");
    if (today < start || today > end) return null;
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = dayNames[today.getDay()];
    const match = schedule.find(s => s.day_label.startsWith(todayName));
    return match || null;
  }, [camp?.start_date, camp?.end_date, schedule, now]);

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

  // Divide programação em Semana 1 (sort_order <= 5) e Semana 2 (sort_order > 5)
  const week1Schedule = useMemo(() => schedule.filter(s => s.sort_order <= 5), [schedule]);
  const week2Schedule = useMemo(() => schedule.filter(s => s.sort_order > 5), [schedule]);

  const scheduleByDayW1 = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    week1Schedule.forEach((s) => { map[s.day_label] = map[s.day_label] || []; map[s.day_label].push(s); });
    return map;
  }, [week1Schedule]);

  const scheduleByDayW2 = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    week2Schedule.forEach((s) => { map[s.day_label] = map[s.day_label] || []; map[s.day_label].push(s); });
    return map;
  }, [week2Schedule]);

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
    // Facebook Pixel — InitiateCheckout
    if (typeof (window as any).fbq === 'function') {
      (window as any).fbq('track', 'InitiateCheckout', {
        content_name: pkg.name,
        value: pkg.price,
        currency: 'BRL',
      });
    }
    setSelectedPkg(pkg);
    setCheckoutOpen(true);
  };

  const heroPhotos = [
    "/images/colonia/foto1.jpg",
    "/images/colonia/foto2.jpg",
    "/images/colonia/foto3.jpg",
    "/images/colonia/foto4.jpg",
  ];
  const campLogo = "/images/colonia/logo-transparent.png";

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden" style={{ ["--camp" as any]: theme }}>
      {/* BOLAS DE FUTEBOL DECORATIVAS */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {[
          { top: "5%", left: "2%", size: 120, opacity: 0.04, rotate: 15 },
          { top: "15%", right: "3%", size: 90, opacity: 0.05, rotate: -20 },
          { top: "35%", left: "8%", size: 80, opacity: 0.04, rotate: 45 },
          { top: "50%", right: "5%", size: 140, opacity: 0.03, rotate: -10 },
          { top: "65%", left: "3%", size: 100, opacity: 0.05, rotate: 30 },
          { top: "78%", right: "8%", size: 70, opacity: 0.04, rotate: -35 },
          { top: "88%", left: "12%", size: 110, opacity: 0.03, rotate: 60 },
          { top: "10%", left: "45%", size: 60, opacity: 0.04, rotate: -15 },
          { top: "70%", left: "55%", size: 85, opacity: 0.04, rotate: 25 },
          { top: "40%", right: "30%", size: 75, opacity: 0.03, rotate: -40 },
        ].map((b, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="absolute"
            style={{
              top: b.top, left: b.left, right: b.right,
              width: b.size, height: b.size,
              opacity: b.opacity,
              transform: `rotate(${b.rotate}deg)`,
            }}
          >
            <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
            <path d="M12 1v22M1 12h22M4.5 4.5l15 15M19.5 4.5l-15 15" fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground" />
          </svg>
        ))}
      </div>

      {/* HERO */}
      <header className="relative overflow-hidden min-h-[100vh] md:min-h-[90vh] flex flex-col">
        {/* PHOTO GRID BACKGROUND */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 opacity-40 md:opacity-50">
          {heroPhotos.map((src, i) => (
            <div key={i} className="relative overflow-hidden">
              <img
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ animation: `heroZoom 25s ease-in-out ${i * 3}s infinite alternate` }}
              />
            </div>
          ))}
        </div>

        {/* GRADIENT OVERLAYS */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(180deg,
                rgba(0,0,0,0.75) 0%,
                rgba(0,0,0,0.35) 25%,
                rgba(0,0,0,0.25) 50%,
                ${theme}bb 80%,
                ${theme} 100%
              )
            `,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-multiply opacity-30"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${theme}, transparent 70%)`,
          }}
        />

        {/* NAV BAR */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm tracking-wide hidden sm:inline">
              Colônia de Férias
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white bg-white/10 backdrop-blur-md hover:bg-white/20 text-xs font-semibold"
            onClick={() => document.getElementById("pacotes")?.scrollIntoView({ behavior: "smooth" })}
          >
            Inscreva-se
          </Button>
        </nav>

        {/* HERO CONTENT */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-10 md:py-16">
          {/* LOGO */}
          <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-1000">
            <img
              src={campLogo}
              alt={camp.name}
              className="w-52 md:w-72 lg:w-80 drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.4))" }}
            />
          </div>

          {/* TITLE */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-lg mb-3 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            {camp.hero_title || camp.name}
          </h1>
          {camp.hero_subtitle && (
            <p className="text-base md:text-xl text-white/90 max-w-2xl mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              {camp.hero_subtitle}
            </p>
          )}

          {/* INFO BADGES */}
          <div className="flex flex-wrap justify-center gap-2.5 text-white/90 text-sm mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
            {(camp.start_date || camp.end_date) && (
              <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <CalendarDays className="w-4 h-4" />
                {fmtDate(camp.start_date)} {camp.end_date ? `a ${fmtDate(camp.end_date)}` : ""}
              </span>
            )}
            {camp.location && (
              <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <MapPin className="w-4 h-4" /> {camp.location}
              </span>
            )}
            {(camp.age_min || camp.age_max) && (
              <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <Users className="w-4 h-4" /> {camp.age_min ?? "?"} a {camp.age_max ?? "?"} anos
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
            <Button
              size="lg"
              className="text-base font-bold shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all duration-300"
              style={{ background: "white", color: theme }}
              onClick={() => document.getElementById("pacotes")?.scrollIntoView({ behavior: "smooth" })}
            >
              {camp.cta_text || "Garantir vaga"}
            </Button>
          </div>
        </div>

        {/* BOTTOM PHOTO STRIP (decorative) */}
        <div className="relative z-10 hidden md:grid grid-cols-4 gap-0">
          {heroPhotos.map((src, i) => (
            <div key={i} className="h-20 overflow-hidden relative group">
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, transparent 0%, ${theme}99 100%)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* HERO ZOOM ANIMATION */}
        <style>{`
          @keyframes heroZoom {
            0% { transform: scale(1); }
            100% { transform: scale(1.08); }
          }
        `}</style>
      </header>

      {/* COUNTDOWN */}
      {countdown && (
        <section className="relative -mt-10 z-20">
          <div className="container max-w-4xl mx-auto px-6">
            <Card
              className="p-6 md:p-8 shadow-2xl border-0 overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, #F7DC6F, #F1C40F 40%, #F39C12)`,
                color: '#1a1a2e',
              }}
            >
              <div className="absolute top-0 right-0 opacity-10">
                <Timer className="w-32 h-32 -translate-y-8 translate-x-8" />
              </div>
              <h3 className="text-foreground/80 text-sm font-semibold uppercase tracking-widest mb-4 text-center">
                Contagem Regressiva
              </h3>
              <div className="grid grid-cols-4 gap-3 md:gap-5 text-center">
                {[
                  { v: countdown.days, l: "Dias" },
                  { v: countdown.hours, l: "Horas" },
                  { v: countdown.minutes, l: "Minutos" },
                  { v: countdown.seconds, l: "Segundos" },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <div className="text-3xl md:text-5xl font-black text-foreground tabular-nums drop-shadow-md">
                      {String(v).padStart(2, "0")}
                    </div>
                    <div className="text-muted-foreground text-xs md:text-sm font-medium mt-1">{l}</div>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground/80 text-xs text-center mt-4">
                para o início da melhor colônia de férias do universo! 🚀
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* DESTAQUE DO DIA */}
      {todayHighlight && (
        <section className="relative -mt-6 z-20">
          <div className="container max-w-2xl mx-auto px-6">
            <Card
              className="p-6 shadow-xl border-0 overflow-hidden relative animate-in fade-in slide-in-from-top-4"
              style={{
                background: `linear-gradient(135deg, ${theme}18, ${theme}0a)`,
                borderLeft: `4px solid ${theme}`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: theme, color: "white" }}
                >
                  <PartyPopper className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-xs" style={{ background: theme, color: "white" }}>
                      HOJE 🎯
                    </Badge>
                    {todayHighlight.time_label && (
                      <span className="text-xs text-muted-foreground">{todayHighlight.time_label}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold">{todayHighlight.title}</h3>
                  {todayHighlight.description && (
                    <p className="text-sm text-muted-foreground mt-1">{todayHighlight.description}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

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

          {/* ===== SEMANA 1 ===== */}
          {week1Schedule.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                  style={{ background: `linear-gradient(135deg, ${theme}, ${theme}cc)` }}
                >
                  1
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">Semana 1</h3>
                  <p className="text-sm text-muted-foreground">06 a 10 de Julho · Tarde</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(scheduleByDayW1).map(([day, items]) => (
                  <div key={day} className="relative">
                    <div
                      className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-3"
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
            </div>
          )}

          {/* Divider */}
          {week1Schedule.length > 0 && week2Schedule.length > 0 && (
            <div className="flex items-center justify-center gap-4 my-10">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Fim de Semana</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* ===== SEMANA 2 ===== */}
          {week2Schedule.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                  style={{ background: `linear-gradient(135deg, ${theme}, ${theme}cc)` }}
                >
                  2
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">Semana 2</h3>
                  <p className="text-sm text-muted-foreground">13 a 17 de Julho · Tarde</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(scheduleByDayW2).map(([day, items]) => (
                  <div key={day} className="relative">
                    <div
                      className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-3"
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
            </div>
          )}
        </section>
      )}

      {/* GALERIA */}
      {(gallery.length > 0 || heroPhotos.length > 0) && (
        <section className="container max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Olha como é</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(gallery.length > 0 ? gallery : heroPhotos).map((url: string, i: number) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden group shadow-md">
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
            const hasStudentsOnly = packages.some((x) => x.students_only);
            const isExclusive = !!p.students_only;
            const isNegotiable = !!p.price_negotiable;
            const waNumber = camp.whatsapp_number?.replace(/\D/g, "") || "";
            const waMsg = encodeURIComponent(
              `Olá! Tenho interesse no pacote "${p.name}" da ${camp.name} e gostaria de mais informações.`
            );
            return (
              <Card key={p.id} className={`p-6 flex flex-col relative overflow-hidden ${isExclusive ? "ring-2" : ""}`} style={isExclusive ? { boxShadow: `0 0 0 2px ${theme}` } : undefined}>
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: theme }}
                />
                {isExclusive && (
                  <Badge className="self-start mb-2 text-white" style={{ background: theme }}>Exclusivo para alunos</Badge>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                <div className="mt-4">
                  {isNegotiable ? (
                    <div className="text-xl font-bold" style={{ color: theme }}>
                      Valor a negociar com a secretaria
                    </div>
                  ) : (
                    <>
                      {p.original_price && p.original_price > p.price && (
                        <div className="text-sm text-muted-foreground line-through">{fmtBRL(Number(p.original_price))}</div>
                      )}
                      <div className="text-3xl font-bold" style={{ color: theme }}>{fmtBRL(Number(p.price))}</div>
                      {hasStudentsOnly && !isExclusive && (
                        <div className="text-[11px] text-muted-foreground mt-1">Valores para público externo</div>
                      )}
                    </>
                  )}
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
                {isExclusive || isNegotiable ? (
                  waNumber ? (
                    <a
                      href={`https://wa.me/${waNumber}?text=${waMsg}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 w-full"
                    >
                      <Button className="w-full text-white" style={{ background: theme }}>
                        Falar com a secretaria
                      </Button>
                    </a>
                  ) : (
                    <Button className="mt-5 w-full text-white" style={{ background: theme }} disabled>
                      Falar com a secretaria
                    </Button>
                  )
                ) : (
                  <Button
                    className="mt-5 w-full text-white"
                    style={{ background: theme }}
                    disabled={soldOut}
                    onClick={() => openCheckout(p)}
                  >
                    {soldOut ? "Esgotado" : "Quero esse"}
                  </Button>
                )}
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

      {/* WHATSAPP FLOATING BUTTON */}
      {camp.whatsapp_number && (
        <a
          href={`https://wa.me/${camp.whatsapp_number.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 animate-in slide-in-from-bottom-4"
          style={{ background: "#25D366", color: "white" }}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="font-semibold text-sm hidden sm:inline">Fale conosco</span>
        </a>
      )}

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
      // Facebook Pixel — Lead (pré-inscrição concluída)
      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', {
          content_name: pkg.name,
          value: pkg.price,
          currency: 'BRL',
        });
      }
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
            {form.payment_method === "CREDIT_CARD" && pkg.max_installments > 1 && (() => {
              const freeInst = Math.max(1, Number(pkg.card_interest_free_installments) || 1);
              const monthlyPct = Number(pkg.card_interest_percent) || 0;
              return (
                <div>
                  <Label>Parcelas</Label>
                  <Select value={String(form.installments)} onValueChange={(v) => setForm({ ...form, installments: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: pkg.max_installments }).map((_, i) => {
                        const n = i + 1;
                        const { perInstallment, total } = calcInstallment(Number(pkg.price), n, freeInst, monthlyPct);
                        const hasInterest = n > freeInst && monthlyPct > 0;
                        return (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de {fmtBRL(perInstallment)} {hasInterest ? `(total ${fmtBRL(total)} c/ juros)` : "sem juros"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm">
                {(() => {
                  const isCC = form.payment_method === "CREDIT_CARD";
                  const freeInst = Math.max(1, Number(pkg.card_interest_free_installments) || 1);
                  const monthlyPct = Number(pkg.card_interest_percent) || 0;
                  const n = isCC ? Math.max(1, form.installments) : 1;
                  const { total } = isCC
                    ? calcInstallment(Number(pkg.price), n, freeInst, monthlyPct)
                    : { total: Number(pkg.price) };
                  return <>Total: <strong style={{ color: theme }}>{fmtBRL(total)}</strong></>;
                })()}
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
