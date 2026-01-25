import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText, 
  Calendar,
  UserPlus,
  Settings,
  Wallet,
  CreditCard,
  UserCheck,
  Percent,
  LogOut,
  Shield,
  ClipboardList,
  UsersRound,
  ClipboardCheck,
  Package,
  Monitor,
  Send,
  Kanban,
  ChevronDown,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useSystemBranding } from '@/hooks/useSystemBranding';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permissionKey: string;
  adminOnly: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const menuSections: MenuSection[] = [
  {
    title: 'Principal',
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', permissionKey: 'dashboard', adminOnly: false },
      { icon: UserPlus, label: 'Nova Matrícula', path: '/matricula', permissionKey: 'enrollment', adminOnly: false },
      { icon: Kanban, label: 'Atendimento Pais', path: '/atendimento-pais', permissionKey: 'guardian_support', adminOnly: false },
    ]
  },
  {
    title: 'Cadastros',
    defaultOpen: true,
    items: [
      { icon: Users, label: 'Alunos', path: '/alunos', permissionKey: 'students', adminOnly: false },
      { icon: UsersRound, label: 'Responsáveis', path: '/responsaveis', permissionKey: 'guardians', adminOnly: false },
      { icon: UserCheck, label: 'Leads', path: '/leads', permissionKey: 'leads', adminOnly: false },
    ]
  },
  {
    title: 'Acadêmico',
    defaultOpen: true,
    items: [
      { icon: GraduationCap, label: 'Turmas', path: '/turmas', permissionKey: 'classes', adminOnly: false },
      { icon: BookOpen, label: 'Cursos', path: '/cursos', permissionKey: 'courses', adminOnly: false },
      { icon: Calendar, label: 'Horários', path: '/horarios', permissionKey: 'schedules', adminOnly: false },
      { icon: ClipboardCheck, label: 'Alocação Alunos', path: '/alocacao-alunos', permissionKey: 'reports', adminOnly: false },
    ]
  },
  {
    title: 'Plataformas',
    defaultOpen: false,
    items: [
      { icon: Monitor, label: 'Alunos LMS', path: '/lms-alunos', permissionKey: 'lms', adminOnly: false },
      { icon: BookOpen, label: 'Alunos Soroban', path: '/soroban-alunos', permissionKey: 'soroban', adminOnly: false },
      { icon: GraduationCap, label: 'Professores', path: '/professores', permissionKey: 'teachers', adminOnly: true },
    ]
  },
  {
    title: 'Financeiro',
    defaultOpen: true,
    items: [
      { icon: Wallet, label: 'Financeiro', path: '/financeiro', permissionKey: 'financial', adminOnly: false },
      { icon: CreditCard, label: 'Carnês', path: '/carnes', permissionKey: 'carnes', adminOnly: false },
      { icon: FileText, label: 'Contratos', path: '/contratos', permissionKey: 'contracts', adminOnly: false },
      { icon: Percent, label: 'Descontos', path: '/descontos', permissionKey: 'discounts', adminOnly: false },
    ]
  },
  {
    title: 'Comunicação',
    defaultOpen: false,
    items: [
      { icon: Send, label: 'Envio em Massa', path: '/envio-massa', permissionKey: 'whatsapp', adminOnly: false },
    ]
  },
  {
    title: 'Relatórios & Gestão',
    defaultOpen: false,
    items: [
      { icon: ClipboardList, label: 'Relatórios', path: '/relatorios', permissionKey: 'reports', adminOnly: false },
      { icon: Package, label: 'Inventário', path: '/inventario', permissionKey: 'inventory', adminOnly: false },
      { icon: UtensilsCrossed, label: 'Cantina', path: '/cantina-admin', permissionKey: 'canteen', adminOnly: false },
    ]
  },
  {
    title: 'Configurações',
    defaultOpen: false,
    items: [
      { icon: FileText, label: 'Config. Contrato', path: '/contrato-config', permissionKey: 'contract_config', adminOnly: false },
      { icon: Shield, label: 'Usuários', path: '/usuarios', permissionKey: 'users', adminOnly: true },
      { icon: Settings, label: 'Configurações', path: '/configuracoes', permissionKey: 'settings', adminOnly: true },
    ]
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const { profile } = useAuthContext();
  const { branding } = useSystemBranding();
  
  const isAdmin = profile?.role === 'admin';
  const permissions = profile?.permissions || {};

  const resolvePermission = (permissionKey: string): boolean | undefined => {
    if (permissionKey === 'guardian_support') {
      return permissions.guardian_support ?? permissions.guardians;
    }
    if (permissionKey === 'whatsapp') {
      return permissions.whatsapp ?? false;
    }
    return permissions[permissionKey];
  };

  const hasPermission = (item: MenuItem) => {
    if (item.adminOnly && !isAdmin) return false;
    if (isAdmin) return true;
    const hasPerm = resolvePermission(item.permissionKey);
    return hasPerm !== false;
  };

  const getVisibleSections = () => {
    return menuSections
      .map(section => ({
        ...section,
        items: section.items.filter(hasPermission)
      }))
      .filter(section => section.items.length > 0);
  };

  const visibleSections = getVisibleSections();

  const handleLinkClick = () => {
    // Close mobile sidebar when navigating
    onClose?.();
  };

  const sidebarContent = (
    <>
      <div className="p-4 lg:p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding.logo ? (
            <img 
              src={branding.logo} 
              alt={branding.name} 
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl object-contain"
            />
          ) : (
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-foreground text-sm lg:text-base">{branding.name}</h1>
            <p className="text-xs text-muted-foreground hidden lg:block">Sistema Escolar</p>
          </div>
        </div>
        
        {/* Close button for mobile */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {visibleSections.map((section) => (
          <MenuSectionComponent 
            key={section.title} 
            section={section} 
            currentPath={location.pathname}
            onLinkClick={handleLinkClick}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {profile && (
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground truncate">{profile.full_name || profile.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
          </div>
        )}
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border h-screen fixed left-0 top-0 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar as Sheet */}
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}

interface MenuSectionProps {
  section: MenuSection;
  currentPath: string;
  onLinkClick?: () => void;
}

function MenuSectionComponent({ section, currentPath, onLinkClick }: MenuSectionProps) {
  const hasActiveItem = section.items.some(item => item.path === currentPath);
  const [isOpen, setIsOpen] = useState(section.defaultOpen || hasActiveItem);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
        <span>{section.title}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 mt-1">
        {section.items.map((item) => {
          const isActive = currentPath === item.path;
          const isEnrollment = item.path === '/matricula';
          
          if (isEnrollment) {
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onLinkClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
                  isActive && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onLinkClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                isActive && 'bg-muted text-foreground font-medium'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LogoutButton() {
  const { signOut, user } = useAuthContext();

  if (!user) return null;

  return (
    <Button 
      variant="outline" 
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      onClick={() => signOut()}
    >
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}
