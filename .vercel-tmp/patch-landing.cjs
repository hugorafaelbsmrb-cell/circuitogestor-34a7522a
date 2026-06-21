const fs = require('fs');
const path = require('path');

let content = fs.readFileSync(path.join(__dirname, '../src/pages/VacationCampLanding.tsx'), 'utf8');

// 1. Add useCallback to import
content = content.replace(
  "import { useEffect, useMemo, useState } from \"react\";",
  "import { useEffect, useMemo, useState, useCallback } from \"react\";"
);

// 2. Add countdown + highlight state/logic after selectedPkg line
const logicBlock = `
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
  }, [camp?.start_date, camp?.end_date, schedule, now]);`;

content = content.replace(
  "  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);\n",
  "  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);" + logicBlock + "\n"
);

// 3. Add countdown UI sections after </header>
const countdownUI = `
      {/* COUNTDOWN */}
      {countdown && (
        <section className="relative -mt-10 z-20">
          <div className="container max-w-4xl mx-auto px-6">
            <Card
              className="p-6 md:p-8 shadow-2xl border-0 overflow-hidden relative"
              style={{
                background: \`linear-gradient(135deg, \${theme}ee, \${theme}dd 60%, \${theme})\`,
              }}
            >
              <div className="absolute top-0 right-0 opacity-10">
                <Timer className="w-32 h-32 -translate-y-8 translate-x-8" />
              </div>
              <h3 className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-4 text-center">
                ⏳ Contagem Regressiva
              </h3>
              <div className="grid grid-cols-4 gap-3 md:gap-5 text-center">
                {[
                  { v: countdown.days, l: "Dias" },
                  { v: countdown.hours, l: "Horas" },
                  { v: countdown.minutes, l: "Minutos" },
                  { v: countdown.seconds, l: "Segundos" },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <div className="text-3xl md:text-5xl font-black text-white tabular-nums drop-shadow-md">
                      {String(v).padStart(2, "0")}
                    </div>
                    <div className="text-white/70 text-xs md:text-sm font-medium mt-1">{l}</div>
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-xs text-center mt-4">
                para o início da melhor colônia de férias do universo! 🚀
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* DESTAQUE DO DIA (durante o evento) */}
      {todayHighlight && (
        <section className="relative -mt-6 z-20">
          <div className="container max-w-2xl mx-auto px-6">
            <Card
              className="p-6 shadow-xl border-0 overflow-hidden relative animate-in fade-in slide-in-from-top-4"
              style={{
                background: \`linear-gradient(135deg, \${theme}18, \${theme}0a)\`,
                borderLeft: \`4px solid \${theme}\`,
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
      )}`;

content = content.replace(
  "      </header>\n\n      {/* HIGHLIGHTS */}",
  "      </header>\n" + countdownUI + "\n\n      {/* HIGHLIGHTS */}"
);

fs.writeFileSync(path.join(__dirname, '../src/pages/VacationCampLanding.tsx'), content);
console.log('Patches applied successfully!');
