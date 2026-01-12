import { useState, useEffect } from 'react';
import { MessageCircle, ChevronDown, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

interface OverduePayment {
  id: string;
  value: number;
  due_date: string;
  bank_slip_url: string | null;
  invoice_url: string | null;
  description: string;
  installment_number: number | null;
}

interface TemplateVariables {
  nome_responsavel?: string;
  nome_aluno?: string;
  nome_curso?: string;
  valor?: string;
  vencimento?: string;
  parcela?: string;
  nome_escola?: string;
}

interface WhatsAppTemplateSelectorProps {
  phone: string;
  variables: TemplateVariables;
  guardianId?: string;
  category?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost';
  buttonSize?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export default function WhatsAppTemplateSelector({
  phone,
  variables,
  guardianId,
  category,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className = '',
  showLabel = true,
}: WhatsAppTemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [overduePayments, setOverduePayments] = useState<OverduePayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (guardianId) {
        fetchOverduePayments(guardianId);
      }
    }
  }, [isOpen, guardianId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .like('key', 'whatsapp_template_%')
      .order('key');

    if (!error && data) {
      const parsedTemplates: WhatsAppTemplate[] = data
        .map(setting => {
          try {
            const parsed = JSON.parse(setting.value || '{}');
            return {
              id: setting.id,
              name: parsed.name || setting.key.replace('whatsapp_template_', ''),
              category: parsed.category || 'general',
              message: parsed.message || '',
              is_active: parsed.is_active !== false,
            };
          } catch {
            return null;
          }
        })
        .filter((t): t is WhatsAppTemplate => t !== null && t.is_active);

      // Filter by category if specified
      if (category) {
        setTemplates(parsedTemplates.filter(t => t.category === category || t.category === 'general'));
      } else {
        setTemplates(parsedTemplates);
      }
    }
    setIsLoading(false);
  };

  const fetchOverduePayments = async (guardianId: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('payments')
      .select('id, value, due_date, bank_slip_url, invoice_url, description, installment_number')
      .eq('guardian_id', guardianId)
      .eq('status', 'pending')
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (!error && data) {
      setOverduePayments(data);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  };

  const applyVariables = (message: string, payment?: OverduePayment) => {
    let result = message
      .replace(/{nome_responsavel}/g, variables.nome_responsavel || '')
      .replace(/{nome_aluno}/g, variables.nome_aluno || '')
      .replace(/{nome_curso}/g, variables.nome_curso || '')
      .replace(/{nome_escola}/g, variables.nome_escola || 'Nossa Escola');

    if (payment) {
      const valorFormatado = payment.value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const vencimentoFormatado = new Date(payment.due_date).toLocaleDateString('pt-BR');
      const linkBoleto = payment.invoice_url || payment.bank_slip_url || '';

      result = result
        .replace(/{valor}/g, valorFormatado)
        .replace(/{vencimento}/g, vencimentoFormatado)
        .replace(/{parcela}/g, payment.installment_number?.toString() || '')
        .replace(/{link_boleto}/g, linkBoleto);
    } else {
      result = result
        .replace(/{valor}/g, variables.valor || '')
        .replace(/{vencimento}/g, variables.vencimento || '')
        .replace(/{parcela}/g, variables.parcela || '')
        .replace(/{link_boleto}/g, '');
    }

    return result;
  };

  const openWhatsApp = (template: WhatsAppTemplate, payment?: OverduePayment) => {
    const formattedPhone = formatPhone(phone);
    const message = encodeURIComponent(applyVariables(template.message, payment));
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
    setIsOpen(false);
  };

  const openWhatsAppDirect = () => {
    const formattedPhone = formatPhone(phone);
    const message = encodeURIComponent(`Olá ${variables.nome_responsavel || ''}, tudo bem?`);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
    setIsOpen(false);
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      lead: 'Lead',
      lead_followup: 'Acompanhamento',
      enrollment: 'Matrícula',
      payment_reminder: 'Lembrete',
      payment_overdue: 'Atraso',
      payment_confirmed: 'Confirmado',
      general: 'Geral',
    };
    return labels[cat] || cat;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          className={`gap-2 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700 ${className}`}
        >
          <MessageCircle className="w-4 h-4" />
          {showLabel && 'WhatsApp'}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-popover z-50">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <>
            <DropdownMenuLabel>Enviar Mensagem</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={openWhatsAppDirect}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Mensagem Rápida
            </DropdownMenuItem>
            
            {templates.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Templates
                </DropdownMenuLabel>
                {templates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => openWhatsApp(template)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 truncate">{template.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getCategoryLabel(template.category)}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {overduePayments.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Cobranças em Atraso ({overduePayments.length})
                </DropdownMenuLabel>
                {overduePayments.map((payment) => {
                  const overdueTemplate = templates.find(t => t.category === 'payment_overdue');
                  if (!overdueTemplate) return null;
                  
                  return (
                    <DropdownMenuItem
                      key={payment.id}
                      onClick={() => openWhatsApp(overdueTemplate, payment)}
                      className="text-destructive hover:text-destructive"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="flex-1 truncate">
                          {new Date(payment.due_date).toLocaleDateString('pt-BR')} - {' '}
                          {payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {(payment.invoice_url || payment.bank_slip_url) && (
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            {templates.length === 0 && (
              <div className="px-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum template configurado
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure em WhatsApp Config
                </p>
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
