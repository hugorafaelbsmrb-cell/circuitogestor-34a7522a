import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check, Copy, CreditCard, QrCode, Split } from "lucide-react";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.functions.supabase.co/vacation-camp-pay-existing`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fmtBRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function calcInstallment(price: number, n: number, freeInst: number, monthlyPct: number) {
  if (n <= Math.max(1, freeInst) || monthlyPct <= 0) {
    return { perInstallment: price / n, total: price, hasInterest: false };
  }
  const i = monthlyPct / 100;
  const factor = Math.pow(1 + i, n);
  const pmt = (price * i * factor) / (factor - 1);
  return { perInstallment: pmt, total: pmt * n, hasInterest: true };
}

interface Info {
  enrollment: {
    id: string; child_name: string; guardian_name: string;
    payment_status: string; amount: number | null;
    asaas_invoice_url: string | null; asaas_pix_payload: string | null;
    payment_method: string | null;
  };
  camp: { name: string };
  package: {
    name: string; price: number; payment_methods: string[]; max_installments: number;
    card_interest_free_installments: number; card_interest_percent: number; due_days: number;
  };
}

async function callFn(body: any) {
  const r = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

export default function VacationCampPayment() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD" | "BOLETO" | "SPLIT">("PIX");
  const [installments, setInstallments] = useState(1);
  const [pixAmountStr, setPixAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    invoiceUrl: string | null;
    pixPayload: string | null;
    pixEncodedImage: string | null;
  } | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await callFn({ action: "info", enrollment_id: id });
      setInfo(data);
      const allowed = (data.package.payment_methods || []).map((m: string) => m.toUpperCase());
      const first = (allowed.includes("PIX") ? "PIX" : allowed[0]) as any;
      setMethod(first || "PIX");
      if (data.enrollment.asaas_invoice_url || data.enrollment.asaas_pix_payload) {
        setResult({
          invoiceUrl: data.enrollment.asaas_invoice_url,
          pixPayload: data.enrollment.asaas_pix_payload,
          pixEncodedImage: null,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Inscrição não encontrada");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const price = Number(info?.package.price || 0);
  const maxInst = info?.package.max_installments || 1;
  const freeInst = info?.package.card_interest_free_installments || 1;
  const monthlyPct = info?.package.card_interest_percent || 0;

  const installmentOptions = useMemo(() => {
    if (!info) return [];
    return Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => {
      const { perInstallment, total, hasInterest } = calcInstallment(price, n, freeInst, monthlyPct);
      const label = n === 1
        ? `À vista — ${fmtBRL(price)}`
        : `${n}x de ${fmtBRL(perInstallment)}${hasInterest ? " (c/ juros)" : " s/ juros"} — total ${fmtBRL(total)}`;
      return { n, label };
    });
  }, [info, price, maxInst, freeInst, monthlyPct]);

  const pay = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const data = await callFn({
        action: "pay", enrollment_id: id,
        payment_method: method,
        installments: method === "CREDIT_CARD" ? installments : 1,
      });
      setResult(data);
      toast.success("Cobrança gerada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar cobrança");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!info) {
    return <div className="min-h-screen grid place-items-center text-center p-6"><div><h1 className="text-xl font-semibold">Inscrição não encontrada</h1><p className="text-muted-foreground text-sm mt-2">Confira se o link recebido está correto.</p></div></div>;
  }

  const confirmed = info.enrollment.payment_status === "confirmed";
  const allowedMethods = (info.package.payment_methods || []).map((m) => m.toUpperCase());

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <Card className="p-6 space-y-3">
          <h1 className="text-xl font-bold">{info.camp.name}</h1>
          <p className="text-sm text-muted-foreground">
            Inscrição de <strong className="text-foreground">{info.enrollment.child_name}</strong>
          </p>
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{info.package.name}</p>
              <p className="text-2xl font-bold text-primary">{fmtBRL(price)}</p>
            </div>
            {confirmed && (
              <div className="text-green-600 flex items-center gap-1 text-sm font-medium">
                <Check className="w-4 h-4" /> Pago
              </div>
            )}
          </div>
        </Card>

        {confirmed ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Pagamento já confirmado. Em breve enviaremos as orientações da colônia. 💚
          </Card>
        ) : result ? (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold">Conclua o pagamento</h2>
            {result.pixPayload && (
              <div className="space-y-2">
                <p className="text-sm flex items-center gap-2"><QrCode className="w-4 h-4" /> PIX copia e cola:</p>
                {result.pixEncodedImage && (
                  <img src={`data:image/png;base64,${result.pixEncodedImage}`} alt="QR Code PIX" className="mx-auto w-48 h-48" />
                )}
                <div className="bg-muted p-3 rounded font-mono text-xs break-all">{result.pixPayload}</div>
                <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(result.pixPayload!); toast.success("Código PIX copiado"); }}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar código PIX
                </Button>
              </div>
            )}
            {result.invoiceUrl && (
              <a href={result.invoiceUrl} target="_blank" rel="noreferrer" className="block">
                <Button className="w-full"><CreditCard className="w-4 h-4 mr-2" /> Abrir fatura / pagar com cartão</Button>
              </a>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setResult(null)}>
              Escolher outra forma de pagamento
            </Button>
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold">Escolha a forma de pagamento</h2>
            <div className="grid grid-cols-2 gap-2">
              {allowedMethods.includes("PIX") && (
                <button onClick={() => setMethod("PIX")} className={`p-3 border-2 rounded-lg text-left transition ${method === "PIX" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <QrCode className="w-5 h-5 mb-1" />
                  <div className="font-medium">PIX</div>
                  <div className="text-xs text-muted-foreground">À vista</div>
                </button>
              )}
              {allowedMethods.includes("CREDIT_CARD") && (
                <button onClick={() => setMethod("CREDIT_CARD")} className={`p-3 border-2 rounded-lg text-left transition ${method === "CREDIT_CARD" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <CreditCard className="w-5 h-5 mb-1" />
                  <div className="font-medium">Cartão</div>
                  <div className="text-xs text-muted-foreground">Até {maxInst}x</div>
                </button>
              )}
            </div>

            {method === "CREDIT_CARD" && maxInst > 1 && (
              <div>
                <Label>Parcelamento</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {installmentOptions.map((o) => (
                      <SelectItem key={o.n} value={String(o.n)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {monthlyPct > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Até {freeInst}x sem juros. Acima disso, {monthlyPct.toString().replace(".", ",")}% ao mês.
                  </p>
                )}
              </div>
            )}

            <Button className="w-full" onClick={pay} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Gerar pagamento
            </Button>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">Pagamento processado com segurança via Asaas.</p>
      </div>
    </div>
  );
}
