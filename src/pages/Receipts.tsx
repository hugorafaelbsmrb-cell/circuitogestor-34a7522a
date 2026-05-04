import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Download, Receipt as ReceiptIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StudentOption {
  id: string;
  name: string;
  guardian_id: string;
  guardian_name: string;
  guardian_cpf: string;
}

interface ContractConfig {
  school_name: string;
  school_cnpj: string;
  school_address: string;
  representative_name: string | null;
  representative_signature_url: string | null;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function valueToWords(value: number): string {
  // Simplified writer for typical currency values
  const reais = Math.floor(value);
  const cents = Math.round((value - reais) * 100);
  const numToWords = (n: number): string => {
    if (n === 0) return 'zero';
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    const below1000 = (num: number): string => {
      if (num === 100) return 'cem';
      let result = '';
      const h = Math.floor(num / 100);
      const rest = num % 100;
      if (h > 0) result += hundreds[h];
      if (rest > 0) {
        if (result) result += ' e ';
        if (rest < 10) result += units[rest];
        else if (rest < 20) result += teens[rest - 10];
        else {
          const t = Math.floor(rest / 10);
          const u = rest % 10;
          result += tens[t];
          if (u > 0) result += ' e ' + units[u];
        }
      }
      return result;
    };

    let result = '';
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000);
      result += (thousands === 1 ? 'mil' : below1000(thousands) + ' mil');
      const rest = n % 1000;
      if (rest > 0) result += (rest < 100 ? ' e ' : ', ') + below1000(rest);
    } else {
      result = below1000(n);
    }
    return result;
  };

  let text = `${numToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`;
  if (cents > 0) {
    text += ` e ${numToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`;
  }
  return text;
}

export default function Receipts() {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [studentId, setStudentId] = useState<string>('');
  const [monthlyValue, setMonthlyValue] = useState<string>('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [startMonth, setStartMonth] = useState<string>('0');
  const [endMonth, setEndMonth] = useState<string>('11');
  const [city, setCity] = useState<string>('');
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set([0,1,2,3,4,5,6,7,8,9,10,11]));
  const [useCustomPayer, setUseCustomPayer] = useState(false);
  const [customPayerName, setCustomPayerName] = useState('');
  const [customPayerCpf, setCustomPayerCpf] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const next = new Set<number>();
    const s = parseInt(startMonth);
    const e = parseInt(endMonth);
    for (let i = Math.min(s, e); i <= Math.max(s, e); i++) next.add(i);
    setSelectedMonths(next);
  }, [startMonth, endMonth]);

  async function loadData() {
    setLoading(true);
    try {
      const [enrollRes, configRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student:students(id,name), guardian:guardians(id,name,cpf)')
          .eq('status', 'active'),
        supabase.from('contract_config').select('*').limit(1).maybeSingle(),
      ]);

      if (enrollRes.error) throw enrollRes.error;
      const opts: StudentOption[] = [];
      const seen = new Set<string>();
      (enrollRes.data || []).forEach((e: any) => {
        if (!e.student || !e.guardian) return;
        if (seen.has(e.student.id)) return;
        seen.add(e.student.id);
        opts.push({
          id: e.student.id,
          name: e.student.name,
          guardian_id: e.guardian.id,
          guardian_name: e.guardian.name,
          guardian_cpf: e.guardian.cpf,
        });
      });
      opts.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(opts);
      setConfig(configRes.data as any);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const selectedStudent = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);

  function toggleMonth(idx: number) {
    const next = new Set(selectedMonths);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedMonths(next);
  }

  async function loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function generateReceipts() {
    if (!selectedStudent) {
      toast({ title: 'Selecione um aluno', variant: 'destructive' });
      return;
    }
    const value = parseFloat(monthlyValue.replace(',', '.'));
    if (!value || value <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    if (selectedMonths.size === 0) {
      toast({ title: 'Selecione ao menos um mês', variant: 'destructive' });
      return;
    }
    if (!config) {
      toast({ title: 'Configuração de contrato não encontrada', variant: 'destructive' });
      return;
    }

    const payerName = useCustomPayer ? customPayerName.trim() : selectedStudent.guardian_name;
    const payerCpf = useCustomPayer ? customPayerCpf.trim() : selectedStudent.guardian_cpf;
    if (useCustomPayer && (!payerName || !payerCpf)) {
      toast({ title: 'Informe nome e CPF do responsável pagador', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const [signatureDataUrl, logoDataUrl, brandingRes] = await Promise.all([
        config.representative_signature_url ? loadImageAsDataUrl(config.representative_signature_url) : Promise.resolve(null),
        (async () => {
          const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'system_logo')
            .maybeSingle();
          const logoUrl = (data as any)?.value;
          return logoUrl ? await loadImageAsDataUrl(logoUrl) : null;
        })(),
        supabase.from('app_settings').select('value').eq('key', 'system_name').maybeSingle(),
      ]);
      const systemName = (brandingRes.data as any)?.value || config.school_name;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const months = Array.from(selectedMonths).sort((a,b) => a-b);
      const yearNum = parseInt(year);

      // System brand palette (orange primary + warm neutrals)
      const navy: [number, number, number] = [28, 25, 23];      // deep neutral (foreground)
      const gold: [number, number, number] = [247, 115, 22];    // primary orange
      const ink: [number, number, number] = [41, 37, 36];       // text
      const muted: [number, number, number] = [120, 113, 108];  // muted-foreground
      const soft: [number, number, number] = [253, 240, 230];   // primary-muted/cream

      months.forEach((monthIdx, i) => {
        if (i > 0) doc.addPage();

        // ===== TOP BAND (navy header) =====
        doc.setFillColor(...navy);
        doc.rect(0, 0, pageW, 42, 'F');

        // Gold accent strip
        doc.setFillColor(...gold);
        doc.rect(0, 42, pageW, 1.2, 'F');

        // Logo (left)
        if (logoDataUrl) {
          try {
            doc.addImage(logoDataUrl, 'AUTO', margin, 10, 22, 22);
          } catch {}
        }

        // Title block (center-right of header)
        const titleX = logoDataUrl ? margin + 30 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('RECIBO', titleX, 22);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...gold);
        doc.text('DE PAGAMENTO DE MENSALIDADE ESCOLAR', titleX, 27);
        doc.setTextColor(220, 220, 230);
        doc.setFontSize(7);
        doc.text('Documento hábil para comprovação junto à Receita Federal', titleX, 32);

        // Receipt number (right side)
        const receiptNo = `Nº ${yearNum}/${String(monthIdx + 1).padStart(2, '0')}-${selectedStudent.id.substring(0, 4).toUpperCase()}`;
        doc.setFontSize(8);
        doc.setTextColor(220, 220, 230);
        doc.text('Recibo', pageW - margin, 18, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(receiptNo, pageW - margin, 24, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...gold);
        doc.text(`${MONTHS[monthIdx].toUpperCase()} / ${yearNum}`, pageW - margin, 30, { align: 'right' });

        // ===== VALUE HIGHLIGHT CARD =====
        let y = 56;
        doc.setFillColor(...soft);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, 'F');
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.4);
        doc.line(margin + 2, y + 2, margin + 2, y + 20); // gold left bar

        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('VALOR RECEBIDO', margin + 7, y + 7);

        doc.setTextColor(...navy);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(`R$ ${value.toFixed(2).replace('.', ',')}`, margin + 7, y + 17);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        const wordsText = `(${valueToWords(value)})`;
        const wordsLines = doc.splitTextToSize(wordsText, 80);
        doc.text(wordsLines, pageW - margin - 4, y + 12, { align: 'right' });

        y += 32;

        // ===== TWO-COLUMN PARTIES =====
        const colW = (pageW - 2 * margin - 6) / 2;
        const drawParty = (x: number, label: string, lines: string[]) => {
          doc.setTextColor(...gold);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text(label, x, y);
          doc.setDrawColor(...gold);
          doc.setLineWidth(0.3);
          doc.line(x, y + 1.5, x + 18, y + 1.5);

          let ly = y + 7;
          doc.setTextColor(...ink);
          lines.forEach((line, idx) => {
            if (idx === 0) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(...muted);
            }
            const wrapped = doc.splitTextToSize(line, colW);
            doc.text(wrapped, x, ly);
            ly += wrapped.length * 4.2 + 1;
          });
          return ly;
        };

        const yLeft = drawParty(margin, 'RECEBEDOR', [
          config.school_name,
          `CNPJ ${config.school_cnpj}`,
          config.school_address,
        ]);
        const yRight = drawParty(margin + colW + 6, 'PAGADOR', [
          payerName,
          `CPF ${payerCpf}`,
          'Responsável financeiro',
        ]);

        y = Math.max(yLeft, yRight) + 6;

        // Divider
        doc.setDrawColor(220, 220, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        // Student / Reference card
        doc.setTextColor(...gold);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('REFERENTE A', margin, y);
        doc.line(margin, y + 1.5, margin + 18, y + 1.5);
        y += 7;

        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Aluno(a)', margin, y);
        doc.text('Competência', margin + colW + 6, y);
        y += 5;
        doc.setTextColor(...ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(selectedStudent.name, margin, y);
        doc.text(`${MONTHS[monthIdx]} / ${yearNum}`, margin + colW + 6, y);
        y += 12;

        // ===== DECLARATION =====
        doc.setTextColor(...ink);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const body = `Declaramos, para os devidos fins, ter recebido de ${payerName}, inscrito(a) no CPF sob o nº ${payerCpf}, a importância de R$ ${value.toFixed(2).replace('.', ',')} (${valueToWords(value)}), referente ao pagamento da mensalidade escolar do(a) aluno(a) ${selectedStudent.name}, relativa ao mês de ${MONTHS[monthIdx]} de ${yearNum}.`;
        const bodyLines = doc.splitTextToSize(body, pageW - 2 * margin);
        doc.text(bodyLines, margin, y, { align: 'justify', maxWidth: pageW - 2 * margin });
        y += bodyLines.length * 5 + 4;

        doc.setFontSize(8.5);
        doc.setTextColor(...muted);
        const note = 'Para clareza e validade, firmamos o presente recibo, emitido para fins de comprovação de despesas com instrução junto à Receita Federal do Brasil, nos termos da legislação vigente do Imposto de Renda.';
        const noteLines = doc.splitTextToSize(note, pageW - 2 * margin);
        doc.text(noteLines, margin, y, { align: 'justify', maxWidth: pageW - 2 * margin });
        y += noteLines.length * 4.5 + 14;

        // City + date
        const cityName = city || '________________';
        doc.setTextColor(...ink);
        doc.setFontSize(9.5);
        doc.text(`${cityName}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, pageW / 2, y, { align: 'center' });
        y += 22;

        // ===== SIGNATURE =====
        const sigW = 75;
        const sigX = (pageW - sigW) / 2;
        if (signatureDataUrl) {
          try {
            doc.addImage(signatureDataUrl, 'PNG', sigX, y - 20, sigW, 18);
          } catch {}
        }
        doc.setDrawColor(...ink);
        doc.setLineWidth(0.3);
        doc.line(sigX, y, sigX + sigW, y);
        y += 4.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...ink);
        doc.text(config.representative_name || config.school_name, pageW / 2, y, { align: 'center' });
        y += 3.8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...muted);
        doc.text(`${config.school_name} • CNPJ ${config.school_cnpj}`, pageW / 2, y, { align: 'center' });

        // ===== FOOTER =====
        doc.setFillColor(...navy);
        doc.rect(0, pageH - 14, pageW, 14, 'F');
        doc.setFillColor(...gold);
        doc.rect(0, pageH - 15.2, pageW, 1.2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(systemName, margin, pageH - 6);
        doc.setTextColor(...gold);
        doc.text(`Recibo ${i + 1} de ${months.length}`, pageW / 2, pageH - 6, { align: 'center' });
        doc.setTextColor(220, 220, 230);
        doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - margin, pageH - 6, { align: 'right' });
      });

      const fileName = `Recibos_${selectedStudent.name.replace(/\s+/g, '_')}_${yearNum}.pdf`;
      doc.save(fileName);
      toast({ title: 'Recibos gerados!', description: `${months.length} recibo(s) emitido(s).` });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar recibos', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <ReceiptIcon className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Recibos para Imposto de Renda</h1>
          <p className="text-sm text-muted-foreground">
            Gere recibos assinados das mensalidades pagas para comprovação no IR.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Recibo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Aluno</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aluno..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.guardian_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor da Mensalidade (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 450,00"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
              />
            </div>
          </div>

          {selectedStudent && (
            <div className="bg-muted/50 p-3 rounded-md text-sm space-y-2">
              <p><strong>Responsável cadastrado:</strong> {selectedStudent.guardian_name}</p>
              <p><strong>CPF:</strong> {selectedStudent.guardian_cpf}</p>
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <Checkbox
                  checked={useCustomPayer}
                  onCheckedChange={(v) => setUseCustomPayer(!!v)}
                />
                <span>Emitir recibo em nome de outro responsável</span>
              </label>
              {useCustomPayer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label>Nome do pagador</Label>
                    <Input
                      value={customPayerName}
                      onChange={(e) => setCustomPayerName(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label>CPF do pagador</Label>
                    <Input
                      value={customPayerCpf}
                      onChange={(e) => setCustomPayerCpf(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Ano</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div>
              <Label>Mês inicial</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês final</Label>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Meses a emitir ({selectedMonths.size} selecionado(s))</Label>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {MONTHS.map((m, i) => (
                <label key={i} className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedMonths.has(i)}
                    onCheckedChange={() => toggleMonth(i)}
                  />
                  <span className="text-sm">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Cidade (para data do recibo)</Label>
            <Input
              placeholder="Ex: São Paulo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {config && !config.representative_signature_url && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm">
              ⚠️ Nenhuma assinatura do administrador cadastrada. Configure em <strong>Config. Contrato</strong> para que os recibos saiam assinados.
            </div>
          )}

          <Button
            onClick={generateReceipts}
            disabled={loading || !studentId || !monthlyValue}
            className="w-full"
            size="lg"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Gerar Recibos em PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
