import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText, 
  Calendar,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: UserPlus, label: 'Nova Matrícula', path: '/matricula' },
  { icon: Users, label: 'Alunos', path: '/alunos' },
  { icon: GraduationCap, label: 'Turmas', path: '/turmas' },
  { icon: BookOpen, label: 'Cursos', path: '/cursos' },
  { icon: Calendar, label: 'Horários', path: '/horarios' },
  { icon: FileText, label: 'Contratos', path: '/contratos' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">EduGestor</h1>
            <p className="text-xs text-muted-foreground">Sistema Escolar</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
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

      <div className="p-4 border-t border-border">
        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm font-medium text-foreground">Precisa de ajuda?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Acesse nossa central de suporte
          </p>
        </div>
      </div>
    </aside>
  );
}
