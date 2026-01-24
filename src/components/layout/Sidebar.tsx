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
  MessageSquare,
  ClipboardCheck,
  Package,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useSystemBranding } from '@/hooks/useSystemBranding';


const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permissionKey: 'dashboard', adminOnly: false },
  { icon: UserPlus, label: 'Nova Matrícula', path: '/matricula', permissionKey: 'enrollment', adminOnly: false },
  { icon: Users, label: 'Alunos', path: '/alunos', permissionKey: 'students', adminOnly: false },
  { icon: UsersRound, label: 'Responsáveis', path: '/responsaveis', permissionKey: 'guardians', adminOnly: false },
  { icon: UserCheck, label: 'Leads', path: '/leads', permissionKey: 'leads', adminOnly: false },
  { icon: GraduationCap, label: 'Turmas', path: '/turmas', permissionKey: 'classes', adminOnly: false },
  { icon: BookOpen, label: 'Cursos', path: '/cursos', permissionKey: 'courses', adminOnly: false },
  { icon: Calendar, label: 'Horários', path: '/horarios', permissionKey: 'schedules', adminOnly: false },
  { icon: Wallet, label: 'Financeiro', path: '/financeiro', permissionKey: 'financial', adminOnly: false },
  { icon: CreditCard, label: 'Carnês', path: '/carnes', permissionKey: 'carnes', adminOnly: false },
  { icon: FileText, label: 'Contratos', path: '/contratos', permissionKey: 'contracts', adminOnly: false },
  { icon: Percent, label: 'Descontos', path: '/descontos', permissionKey: 'discounts', adminOnly: false },
  { icon: ClipboardList, label: 'Relatórios', path: '/relatorios', permissionKey: 'reports', adminOnly: false },
  { icon: ClipboardCheck, label: 'Alocação Alunos', path: '/alocacao-alunos', permissionKey: 'reports', adminOnly: false },
  { icon: Package, label: 'Inventário', path: '/inventario', permissionKey: 'inventory', adminOnly: false },
  { icon: Monitor, label: 'Alunos LMS', path: '/lms-alunos', permissionKey: 'lms', adminOnly: false },
  { icon: BookOpen, label: 'Alunos Soroban', path: '/soroban-alunos', permissionKey: 'soroban', adminOnly: false },
  { icon: FileText, label: 'Config. Contrato', path: '/contrato-config', permissionKey: 'contract_config', adminOnly: false },
  { icon: Shield, label: 'Usuários', path: '/usuarios', permissionKey: 'users', adminOnly: true },
  { icon: MessageSquare, label: 'WhatsApp', path: '/whatsapp-config', permissionKey: 'whatsapp', adminOnly: true },
  { icon: Settings, label: 'Configurações', path: '/configuracoes', permissionKey: 'settings', adminOnly: true },
];

export function Sidebar() {
  const location = useLocation();
  const { profile } = useAuthContext();
  const { branding } = useSystemBranding();
  
  const isAdmin = profile?.role === 'admin';
  const permissions = profile?.permissions || {};
  
  const visibleMenuItems = menuItems.filter(item => {
    // Admin-only items
    if (item.adminOnly && !isAdmin) return false;
    
    // Check module permissions (admins have all permissions)
    if (isAdmin) return true;
    
    // For non-admins, check if they have permission for this module
    const hasPermission = permissions[item.permissionKey];
    return hasPermission !== false; // Default to true if not set
  });

  return (
    <aside className="w-64 bg-card border-r border-border h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          {branding.logo ? (
            <img 
              src={branding.logo} 
              alt={branding.name} 
              className="w-10 h-10 rounded-xl object-contain"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-foreground">{branding.name}</h1>
            <p className="text-xs text-muted-foreground">Sistema Escolar</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isEnrollment = item.path === '/matricula';
          
          if (isEnrollment) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all',
                  'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg',
                  isActive && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'sidebar-item',
                isActive && 'sidebar-item-active'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
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
    </aside>
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
