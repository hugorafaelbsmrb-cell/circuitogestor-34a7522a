import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Printer,
  LayoutDashboard,
  Home,
  UserPlus,
  Users,
  GraduationCap,
  Calendar,
  DollarSign,
  MessageSquare,
  Package,
  Settings,
  FileText,
  BookOpen,
  Smartphone,
  Shield,
  Zap,
  Bell,
  Calculator,
  ClipboardList,
  UserCheck,
  Wallet,
  FileSignature,
  Send,
  Bot,
  Link,
  Palette,
  Key,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemBranding } from "@/hooks/useSystemBranding";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
}

const sections: Section[] = [
  { id: "overview", title: "1. Visão Geral", icon: LayoutDashboard },
  { id: "dashboard", title: "2. Dashboard", icon: Home },
  { id: "enrollment", title: "3. Matrículas", icon: UserPlus },
  { id: "registrations", title: "4. Cadastros", icon: Users },
  { id: "academic", title: "5. Acadêmico", icon: GraduationCap },
  { id: "platforms", title: "6. Plataformas", icon: BookOpen },
  { id: "financial", title: "7. Financeiro", icon: DollarSign },
  { id: "communication", title: "8. Comunicação", icon: MessageSquare },
  { id: "inventory", title: "9. Inventário", icon: Package },
  { id: "settings", title: "10. Configurações", icon: Settings },
  { id: "users", title: "11. Usuários", icon: Shield },
  { id: "pre-enrollment", title: "12. Pré-Matrícula", icon: ClipboardList },
  { id: "ai-integration", title: "13. IA Gemini", icon: Bot },
];

export function SystemDocumentation() {
  const [activeSection, setActiveSection] = useState("overview");
  const { branding } = useSystemBranding();
  const systemName = branding.name;
  const logoUrl = branding.logo;

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation - Hidden on print */}
      <nav className="w-56 shrink-0 no-print sticky top-4 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Índice
          </h3>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1 pr-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </nav>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl">
        {/* Print Header - Only visible on print */}
        <div className="print-header hidden print:block mb-8 text-center border-b pb-6">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-16 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold">{systemName || "CircuitoGestor"}</h1>
          <p className="text-muted-foreground">Manual do Sistema - Documentação Completa</p>
          <p className="text-sm text-muted-foreground mt-2">
            Gerado em: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* Documentation Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-12">
          
          {/* 1. Visão Geral */}
          <section id="overview" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Visão Geral do Sistema</h2>
            </div>
            
            <p className="text-muted-foreground text-lg">
              O <strong>{systemName || "CircuitoGestor"}</strong> é uma plataforma completa de gestão escolar 
              desenvolvida para escolas de cursos extracurriculares, especialmente focada em franquias educacionais.
            </p>

            <Card className="mt-4">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Principais Recursos
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Gestão completa de matrículas</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Controle financeiro integrado (Asaas)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Comunicação via WhatsApp (W-API)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Integração com plataformas LMS</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Inteligência Artificial (Google Gemini)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Contratos digitais</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Gestão de leads e pré-matrículas</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Controle patrimonial</li>
                </ul>
              </CardContent>
            </Card>

            <h4 className="font-semibold mt-6 mb-3">Estrutura de Navegação</h4>
            <p>O sistema é organizado em seções no menu lateral:</p>
            <ul className="space-y-1">
              <li><strong>Principal:</strong> Dashboard, Nova Matrícula, Atendimento</li>
              <li><strong>Cadastros:</strong> Alunos, Responsáveis, Leads</li>
              <li><strong>Acadêmico:</strong> Cursos, Turmas, Horários, Alocação</li>
              <li><strong>Plataformas:</strong> LMS, Soroban, Professores</li>
              <li><strong>Financeiro:</strong> Pagamentos, Carnês, Contratos</li>
              <li><strong>Comunicação:</strong> Envio em Massa</li>
              <li><strong>Gestão:</strong> Inventário, Relatórios</li>
              <li><strong>Sistema:</strong> Usuários, Descontos, Configurações</li>
            </ul>

            <AlertBox type="info" className="mt-4">
              O sistema possui dois perfis de acesso: <strong>Admin</strong> (acesso total) e <strong>Usuário</strong> (acesso baseado em permissões configuráveis).
            </AlertBox>
          </section>

          <Separator />

          {/* 2. Dashboard */}
          <section id="dashboard" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Dashboard</h2>
            </div>

            <p>A tela inicial apresenta uma visão consolidada do estado atual da escola.</p>

            <h4 className="font-semibold mt-4 mb-2">Estatísticas Exibidas</h4>
            <ul>
              <li><strong>Total de Alunos:</strong> Quantidade de alunos ativos no sistema</li>
              <li><strong>Matrículas Ativas:</strong> Matrículas com status ativo</li>
              <li><strong>Leads Novos:</strong> Leads capturados aguardando contato</li>
              <li><strong>Tickets Pendentes:</strong> Atendimentos aos pais em aberto</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Alertas Automáticos</h4>
            <ul>
              <li><Badge variant="destructive" className="mr-2">Urgente</Badge>Pagamentos vencidos há mais de 7 dias</li>
              <li><Badge variant="secondary" className="mr-2">Atenção</Badge>Pagamentos vencendo nos próximos 3 dias</li>
              <li><Badge variant="outline" className="mr-2">Info</Badge>Turmas com vagas disponíveis</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Ações Rápidas</h4>
            <p>Botões de acesso direto para as funcionalidades mais utilizadas: Nova Matrícula, Novo Lead, Ver Financeiro.</p>
          </section>

          <Separator />

          {/* 3. Matrículas */}
          <section id="enrollment" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Nova Matrícula</h2>
            </div>

            <p>O processo de matrícula é guiado por um wizard de <strong>7 etapas</strong>, garantindo coleta completa de informações.</p>

            <div className="space-y-4 mt-6">
              <StepCard 
                step={1} 
                title="Dados do Aluno" 
                description="Nome completo, data de nascimento e sexo do aluno. Permite buscar aluno existente ou cadastrar novo."
              />
              
              <StepCard 
                step={2} 
                title="Dados do Responsável" 
                description="Nome, CPF, e-mail, telefone e endereço completo. Inclui validação do número de WhatsApp via W-API para garantir comunicação efetiva."
              />
              
              <StepCard 
                step={3} 
                title="Seleção do Curso" 
                description="Lista de cursos ativos com preço e duração. Cada curso exibe suas informações detalhadas."
              />
              
              <StepCard 
                step={4} 
                title="Escolha de Horário e Turma" 
                description="Horários disponíveis para o curso selecionado, com indicação de vagas restantes por turma."
              />
              
              <StepCard 
                step={5} 
                title="Configuração de Pagamento" 
                description="Definição do valor, aplicação de descontos, cálculo de pro-rata para matrículas no meio do mês e quantidade de parcelas."
              />
              
              <StepCard 
                step={6} 
                title="Contrato Digital" 
                description="Geração automática do contrato com cláusulas configuráveis. Permite visualização e impressão antes da assinatura."
              />
              
              <StepCard 
                step={7} 
                title="Resumo e Conclusão" 
                description="Revisão de todos os dados antes da confirmação. Opção de gerar carnê de pagamento via Asaas."
              />
            </div>

            <AlertBox type="info" className="mt-6">
              <strong>Segundo Curso:</strong> Se o aluno já possui uma matrícula ativa, o sistema detecta automaticamente 
              e permite adicionar outro curso sem recadastrar responsável.
            </AlertBox>
          </section>

          <Separator />

          {/* 4. Cadastros */}
          <section id="registrations" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Cadastros</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Alunos</h3>
            <p>Listagem de todos os alunos cadastrados com busca por nome. Exibe:</p>
            <ul>
              <li>Nome e data de nascimento</li>
              <li>Responsável vinculado</li>
              <li>Status (ativo/inativo)</li>
              <li>Cursos matriculados</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Responsáveis</h3>
            <p>Gestão dos responsáveis financeiros dos alunos. Informações:</p>
            <ul>
              <li>Dados pessoais (nome, CPF, e-mail)</li>
              <li>Contato (telefone WhatsApp)</li>
              <li>Endereço completo (CEP, rua, número, bairro)</li>
              <li>ID do cliente no Asaas (gerado automaticamente)</li>
              <li>Alunos vinculados</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Leads</h3>
            <p>Gestão de potenciais clientes organizados em <strong>Kanban</strong> com os status:</p>
            <ul>
              <li><Badge className="mr-2 bg-blue-500">Novo</Badge>Lead recém-capturado</li>
              <li><Badge className="mr-2 bg-yellow-500">Em Contato</Badge>Em processo de negociação</li>
              <li><Badge className="mr-2 bg-purple-500">Agendado</Badge>Visita ou aula experimental marcada</li>
              <li><Badge className="mr-2 bg-green-500">Convertido</Badge>Lead convertido em matrícula</li>
              <li><Badge className="mr-2 bg-red-500">Perdido</Badge>Não fechou negócio</li>
            </ul>

            <p className="mt-4">Cada card de lead exibe:</p>
            <ul>
              <li>Nome do responsável e aluno</li>
              <li>Telefone com ação rápida para WhatsApp</li>
              <li>Curso de interesse</li>
              <li>Fonte de origem (site, indicação, etc.)</li>
              <li>Notas e observações</li>
            </ul>

            <AlertBox type="success" className="mt-4">
              <strong>Conversão Rápida:</strong> Ao converter um lead, os dados são automaticamente 
              preenchidos no formulário de matrícula.
            </AlertBox>
          </section>

          <Separator />

          {/* 5. Acadêmico */}
          <section id="academic" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">5. Acadêmico</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.1 Cursos</h3>
            <p>Cadastro e gestão dos cursos oferecidos pela escola:</p>
            <ul>
              <li><strong>Nome:</strong> Identificação do curso</li>
              <li><strong>Descrição:</strong> Detalhes sobre o conteúdo</li>
              <li><strong>Duração:</strong> Período do curso (ex: "12 meses")</li>
              <li><strong>Preço Mensal:</strong> Valor da mensalidade</li>
              <li><strong>Duração do Contrato:</strong> Meses de vigência</li>
              <li><strong>Status:</strong> Ativo/Inativo</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.2 Horários</h3>
            <p>Definição dos horários disponíveis por curso:</p>
            <ul>
              <li>Dia da semana</li>
              <li>Horário de início e término</li>
              <li>Quantidade de vagas</li>
              <li>Curso vinculado</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.3 Turmas</h3>
            <p>Agrupamento de alunos por curso e horário:</p>
            <ul>
              <li>Nome identificador (ex: "Turma A - Manhã")</li>
              <li>Curso e horário vinculados</li>
              <li>Capacidade máxima</li>
              <li>Alunos matriculados atualmente</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.4 Alocação de Alunos</h3>
            <p>Tela para visualizar e gerenciar a distribuição de alunos nas turmas. Permite:</p>
            <ul>
              <li>Visualizar ocupação por turma</li>
              <li>Transferir alunos entre turmas</li>
              <li>Identificar turmas com vagas</li>
            </ul>
          </section>

          <Separator />

          {/* 6. Plataformas */}
          <section id="platforms" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">6. Plataformas Educacionais</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">6.1 Alunos LMS (CircuitoKids)</h3>
            <p>Integração com a plataforma de ensino online:</p>
            <ul>
              <li><strong>Credenciais:</strong> E-mail, matrícula e senha de acesso</li>
              <li><strong>Progresso:</strong> Módulo atual, lição, nível</li>
              <li><strong>Conclusão:</strong> Percentual de aulas completadas</li>
              <li><strong>Sincronização:</strong> Atualização automática via webhook</li>
            </ul>

            <p className="mt-4">Funcionalidades disponíveis:</p>
            <ul>
              <li>Sincronizar progresso de todos os alunos</li>
              <li>Processar relatórios pedagógicos de tarefas</li>
              <li>Gerar credenciais para novos alunos</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">6.2 Alunos Soroban</h3>
            <p>Integração com a plataforma de ábaco japonês:</p>
            <ul>
              <li><strong>Níveis:</strong> Progresso de 1 a 12</li>
              <li><strong>Módulos:</strong> Etapas dentro de cada nível</li>
              <li><strong>Credenciais:</strong> Dados de acesso à plataforma</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">6.3 Professores</h3>
            <p>Cadastro de professores e instrutores:</p>
            <ul>
              <li>Nome, telefone e e-mail</li>
              <li>Turma vinculada</li>
              <li>Status ativo/inativo</li>
            </ul>

            <AlertBox type="info" className="mt-4">
              Os webhooks das plataformas atualizam automaticamente o progresso dos alunos 
              sem necessidade de intervenção manual.
            </AlertBox>
          </section>

          <Separator />

          {/* 7. Financeiro */}
          <section id="financial" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">7. Financeiro</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">7.1 Pagamentos</h3>
            <p>Visão geral de todas as cobranças com filtros por:</p>
            <ul>
              <li>Período (mês/ano)</li>
              <li>Status (pendente, pago, vencido)</li>
              <li>Responsável ou aluno</li>
            </ul>

            <p className="mt-4"><strong>Status de Pagamento:</strong></p>
            <ul>
              <li><Badge className="bg-yellow-500 mr-2">PENDING</Badge>Aguardando pagamento</li>
              <li><Badge className="bg-green-500 mr-2">RECEIVED</Badge>Pago via boleto</li>
              <li><Badge className="bg-green-600 mr-2">CONFIRMED</Badge>Confirmado</li>
              <li><Badge className="bg-blue-500 mr-2">RECEIVED_IN_CASH</Badge>Recebido em dinheiro</li>
              <li><Badge className="bg-red-500 mr-2">OVERDUE</Badge>Vencido</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Baixa Manual</h4>
            <p>Para pagamentos recebidos em dinheiro ou outras formas fora do Asaas:</p>
            <ol>
              <li>Localize o pagamento na lista</li>
              <li>Clique no botão "Dar Baixa"</li>
              <li>Confirme a data de recebimento</li>
              <li>O status será alterado para "RECEIVED_IN_CASH"</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">7.2 Carnês</h3>
            <p>Gestão de carnês de pagamento gerados via Asaas:</p>
            <ul>
              <li>Visualização de todos os carnês emitidos</li>
              <li>Status do carnê (ativo, encerrado)</li>
              <li>Parcelas e valores</li>
              <li>Opção de reembolso/cancelamento</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">7.3 Contratos</h3>
            <p>Gestão dos contratos gerados nas matrículas:</p>
            <ul>
              <li>Visualização e impressão do contrato</li>
              <li>Status (pendente, assinado)</li>
              <li>Geração posterior de carnê para contratos sem cobrança</li>
              <li>Dados do aluno, responsável e curso</li>
            </ul>

            <AlertBox type="warning" className="mt-4">
              <strong>Importante:</strong> O carnê só pode ser gerado após a assinatura do contrato. 
              Para contratos pendentes, primeiro conclua a assinatura.
            </AlertBox>
          </section>

          <Separator />

          {/* 8. Comunicação */}
          <section id="communication" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">8. Comunicação</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">8.1 Envio em Massa</h3>
            <p>Ferramenta para envio de mensagens WhatsApp para múltiplos destinatários:</p>

            <h4 className="font-semibold mt-4 mb-2">Seleção de Destinatários</h4>
            <ul>
              <li>Filtro por curso</li>
              <li>Seleção individual ou em lote</li>
              <li>Exclusão de destinatários específicos</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Variáveis Dinâmicas</h4>
            <p>Use as seguintes variáveis que serão substituídas automaticamente:</p>
            <ul>
              <li><code>{"{nome_responsavel}"}</code> - Nome do responsável</li>
              <li><code>{"{nome_aluno}"}</code> - Nome do aluno</li>
              <li><code>{"{nome_curso}"}</code> - Nome do curso</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Templates</h4>
            <p>Salve mensagens frequentes como templates para reutilização rápida.</p>

            <h4 className="font-semibold mt-4 mb-2">Agendamento</h4>
            <p>Agende mensagens para envio futuro, definindo data e hora específicas.</p>

            <h4 className="font-semibold mt-4 mb-2">Geração com IA</h4>
            <p>Utilize a IA para gerar mensagens automaticamente baseadas em contexto ou objetivo.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">8.2 Atendimento aos Pais</h3>
            <p>Sistema de tickets em formato Kanban para gerenciar comunicações:</p>

            <ul>
              <li><strong>Colunas por Curso:</strong> Visualização organizada por área</li>
              <li><strong>Prioridades:</strong> Normal, Alta, Urgente</li>
              <li><strong>Histórico:</strong> Acesso às mensagens anteriores do WhatsApp</li>
              <li><strong>IA Assistente:</strong> Sugestões de resposta geradas por IA</li>
              <li><strong>Respostas Rápidas:</strong> Mensagens pré-definidas para agilizar atendimento</li>
            </ul>
          </section>

          <Separator />

          {/* 9. Inventário */}
          <section id="inventory" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">9. Inventário</h2>
            </div>

            <p>Gestão do patrimônio e ativos fixos da escola.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">9.1 Ativos</h3>
            <p>Cadastro de bens patrimoniais com:</p>
            <ul>
              <li><strong>Código:</strong> Identificador único do ativo</li>
              <li><strong>Nome e Descrição:</strong> Detalhamento do bem</li>
              <li><strong>Categoria:</strong> Tipo do ativo (móveis, eletrônicos, etc.)</li>
              <li><strong>Localização:</strong> Onde o bem está alocado</li>
              <li><strong>Valor de Aquisição:</strong> Preço de compra</li>
              <li><strong>Data de Aquisição:</strong> Quando foi adquirido</li>
              <li><strong>Vida Útil:</strong> Tempo estimado de uso em anos</li>
              <li><strong>Taxa de Depreciação:</strong> Percentual anual</li>
              <li><strong>Condição:</strong> Novo, Bom, Regular, Ruim</li>
              <li><strong>Status:</strong> Ativo, Em manutenção, Baixado</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">9.2 Categorias</h3>
            <p>Configure categorias personalizadas com taxas de depreciação padrão.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">9.3 Relatórios</h3>
            <p>Gere relatórios de patrimônio com valor total, depreciação acumulada e valor atual.</p>
          </section>

          <Separator />

          {/* 10. Configurações */}
          <section id="settings" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">10. Configurações</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.1 Identidade</h3>
            <ul>
              <li><strong>Nome do Sistema:</strong> Exibido no cabeçalho e título</li>
              <li><strong>Logo:</strong> Imagem exibida no menu e relatórios</li>
              <li><strong>Favicon:</strong> Ícone na aba do navegador</li>
              <li><strong>Imagem de Login:</strong> Background da tela de autenticação</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.2 Inteligência Artificial</h3>
            <ul>
              <li><strong>Chave Google Gemini:</strong> API key para recursos de IA</li>
              <li><strong>Modelo:</strong> gemini-2.5-flash-lite (otimizado para velocidade)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.3 APIs Externas</h3>
            <ul>
              <li><strong>Asaas:</strong> Chave de API para cobranças</li>
              <li><strong>LMS:</strong> URL e token da plataforma educacional</li>
              <li><strong>Soroban:</strong> Credenciais de integração</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.4 WhatsApp (W-API)</h3>
            <ul>
              <li><strong>URL da API:</strong> Endpoint do serviço W-API</li>
              <li><strong>Token:</strong> Chave de autenticação</li>
              <li><strong>Status:</strong> Verificação de conexão</li>
              <li><strong>QR Code:</strong> Para vincular novo dispositivo</li>
              <li><strong>Respostas Rápidas:</strong> Mensagens pré-configuradas</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.5 Webhooks</h3>
            <p>URLs para integração externa:</p>
            <ul>
              <li>Webhook Asaas (notificações de pagamento)</li>
              <li>Webhook LMS (atualizações de progresso)</li>
              <li>Webhook Soroban (sincronização)</li>
              <li>Webhook W-API (mensagens recebidas)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.6 Financeiro</h3>
            <ul>
              <li><strong>Multa:</strong> Percentual para atraso</li>
              <li><strong>Juros:</strong> Taxa mensal de juros</li>
              <li><strong>Descontos:</strong> Cadastro de descontos disponíveis</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.7 Automações</h3>
            <ul>
              <li>Relatório de tarefas (homework report)</li>
              <li>Notificações automáticas de vencimento</li>
              <li>Lembretes de renovação de contrato</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.8 Contrato</h3>
            <ul>
              <li><strong>Dados da Escola:</strong> Nome, CNPJ, endereço</li>
              <li><strong>Cláusulas:</strong> Configuração do modelo de contrato</li>
            </ul>
          </section>

          <Separator />

          {/* 11. Usuários */}
          <section id="users" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">11. Usuários e Permissões</h2>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">11.1 Perfis de Acesso</h3>
            <ul>
              <li><strong>Admin:</strong> Acesso total ao sistema, pode gerenciar usuários</li>
              <li><strong>User:</strong> Acesso restrito conforme permissões configuradas</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">11.2 Criação de Usuário</h3>
            <ol>
              <li>Acesse Configurações → Usuários</li>
              <li>Clique em "Novo Usuário"</li>
              <li>Preencha e-mail, nome e senha</li>
              <li>Selecione o perfil (Admin ou User)</li>
              <li>Configure as permissões por módulo</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">11.3 Módulos de Permissão</h3>
            <ul className="grid grid-cols-2 gap-2">
              <li>Dashboard</li>
              <li>Matrículas</li>
              <li>Alunos</li>
              <li>Leads</li>
              <li>Cursos</li>
              <li>Turmas</li>
              <li>Horários</li>
              <li>Financeiro</li>
              <li>Carnês</li>
              <li>Contratos</li>
              <li>Descontos</li>
              <li>Config. Contrato</li>
            </ul>
          </section>

          <Separator />

          {/* 12. Pré-Matrícula */}
          <section id="pre-enrollment" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">12. Formulário de Pré-Matrícula</h2>
            </div>

            <p>Formulário público para captação de leads diretamente pelo site.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">12.1 URL de Acesso</h3>
            <p>O formulário está disponível em:</p>
            <code className="block p-3 bg-muted rounded-md mt-2">
              /pre-matricula
            </code>

            <h3 className="text-xl font-semibold mt-6 mb-3">12.2 Campos Coletados</h3>
            <ul>
              <li>Nome do responsável</li>
              <li>Telefone (WhatsApp)</li>
              <li>E-mail</li>
              <li>Nome do aluno</li>
              <li>Data de nascimento do aluno</li>
              <li>Curso de interesse</li>
              <li>CPF (opcional)</li>
              <li>Endereço (opcional)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">12.3 Fluxo</h3>
            <ol>
              <li>Interessado preenche o formulário</li>
              <li>Sistema cria lead com status "Novo"</li>
              <li>Lead aparece no Kanban para acompanhamento</li>
              <li>Equipe entra em contato e move para "Em Contato"</li>
              <li>Ao fechar, converte para matrícula</li>
            </ol>
          </section>

          <Separator />

          {/* 13. IA Gemini */}
          <section id="ai-integration" className="scroll-mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">13. Integração com IA (Google Gemini)</h2>
            </div>

            <p>O sistema utiliza a API do Google Gemini para funcionalidades inteligentes.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">13.1 Configuração</h3>
            <ol>
              <li>Acesse Configurações → Inteligência Artificial</li>
              <li>Obtenha sua chave em <a href="https://aistudio.google.com/apikey" target="_blank" className="text-primary hover:underline">Google AI Studio</a></li>
              <li>Cole a chave no campo "Chave API Google"</li>
              <li>Clique em Salvar</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">13.2 Funcionalidades com IA</h3>
            
            <h4 className="font-semibold mt-4 mb-2">Geração de Mensagens</h4>
            <p>No Envio em Massa, a IA pode gerar mensagens automaticamente:</p>
            <ul>
              <li>Descreva o objetivo da mensagem</li>
              <li>A IA gera um texto adequado</li>
              <li>Edite conforme necessário</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Sugestões de Resposta</h4>
            <p>No Atendimento aos Pais:</p>
            <ul>
              <li>Analisa o histórico de conversa</li>
              <li>Sugere respostas contextualizadas</li>
              <li>Gera resumo da conversa</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Relatórios Pedagógicos</h4>
            <p>Processamento automático de relatórios de tarefas:</p>
            <ul>
              <li>Professor envia relatório por WhatsApp</li>
              <li>IA processa e formata o conteúdo</li>
              <li>Mensagem personalizada enviada ao responsável</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-2">Chat Assistente</h4>
            <p>Assistente virtual para dúvidas e suporte interno.</p>

            <AlertBox type="info" className="mt-4">
              <strong>Modelo Utilizado:</strong> gemini-2.5-flash-lite - Otimizado para velocidade 
              e baixo custo, ideal para tarefas de geração de texto.
            </AlertBox>

            <h3 className="text-xl font-semibold mt-6 mb-3">13.3 Arquitetura Técnica</h3>
            <p>A chave da API é armazenada de forma segura no banco de dados e recuperada 
            dinamicamente pelas Edge Functions quando necessário, sem exposição no código fonte.</p>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t text-center text-muted-foreground print:mt-16">
            <p className="font-semibold">{systemName || "CircuitoGestor"}</p>
            <p className="text-sm mt-1">Sistema de Gestão Escolar</p>
            <p className="text-xs mt-2">Documentação gerada em {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function AlertBox({ type, children, className }: { type: "info" | "warning" | "success", children: React.ReactNode, className?: string }) {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
    warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    success: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300"
  };

  const icons = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle
  };

  const Icon = icons[type];

  return (
    <div className={cn("flex gap-3 p-4 rounded-lg border", styles[type], className)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">{children}</div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number, title: string, description: string }) {
  return (
    <div className="flex gap-4 items-start p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
