import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SchoolProvider } from "@/contexts/SchoolContext";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Enrollment from "./pages/Enrollment";
import Students from "./pages/Students";
import Classes from "./pages/Classes";
import Courses from "./pages/Courses";
import Schedules from "./pages/Schedules";
import Contracts from "./pages/Contracts";
import ContractConfig from "./pages/ContractConfig";
import Carnes from "./pages/Carnes";
import Financial from "./pages/Financial";
import Leads from "./pages/Leads";
import Discounts from "./pages/Discounts";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/matricula" element={<Enrollment />} />
                <Route path="/alunos" element={<Students />} />
                <Route path="/turmas" element={<Classes />} />
                <Route path="/cursos" element={<Courses />} />
                <Route path="/horarios" element={<Schedules />} />
                <Route path="/financeiro" element={<Financial />} />
                <Route path="/carnes" element={<Carnes />} />
                <Route path="/contratos" element={<Contracts />} />
                <Route path="/contrato-config" element={<ContractConfig />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/descontos" element={<Discounts />} />
                <Route path="/relatorios" element={<Reports />} />
                <Route path="/usuarios" element={<Users />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SchoolProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SchoolProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
