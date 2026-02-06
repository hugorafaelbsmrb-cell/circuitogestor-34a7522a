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
import PreEnrollmentForm from "./pages/PreEnrollmentForm";
import CampaignLanding from "./pages/CampaignLanding";
import CourseLanding from "./pages/CourseLanding";
import CampaignAdmin from "./pages/CampaignAdmin";
import Students from "./pages/Students";
import Guardians from "./pages/Guardians";
import Classes from "./pages/Classes";
import Courses from "./pages/Courses";
import Schedules from "./pages/Schedules";
import Contracts from "./pages/Contracts";
import ContractSign from "./pages/ContractSign";
import ContractConfig from "./pages/ContractConfig";
import Carnes from "./pages/Carnes";
import Financial from "./pages/Financial";
import Leads from "./pages/Leads";
import Discounts from "./pages/Discounts";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import StudentAllocation from "./pages/StudentAllocation";
import WhatsAppConfig from "./pages/WhatsAppConfig";
import BulkMessages from "./pages/BulkMessages";
import GuardianSupport from "./pages/GuardianSupport";
import GuardianSupportMobile from "./pages/GuardianSupportMobile";
import Inventory from "./pages/Inventory";
import LMSStudents from "./pages/LMSStudents";
import SorobanStudents from "./pages/SorobanStudents";
import Teachers from "./pages/Teachers";
import PedagogicalAnalysis from "./pages/PedagogicalAnalysis";
import HomeworkAnalysis from "./pages/HomeworkAnalysis";
import CanteenPublic from "./pages/CanteenPublic";
import CanteenAdminPage from "./pages/CanteenAdmin";
import TeacherLogin from "./pages/TeacherLogin";
import ParentReportsPortal from "./pages/ParentReportsPortal";
import NotFound from "./pages/NotFound";
import ExternalApiManager from "./pages/ExternalApiManager";
import AttendancePublic from "./pages/AttendancePublic";
import AttendanceAdmin from "./pages/AttendanceAdmin";
import EmailClient from "./pages/EmailClient";
import IoTAutomation from "./pages/IoTAutomation";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes - no authentication required */}
          <Route path="/assinar/:token" element={<ContractSign />} />
          <Route path="/pre-matricula" element={<PreEnrollmentForm />} />
          <Route path="/campanha" element={<CampaignLanding />} />
          <Route path="/campanha/:slug" element={<CourseLanding />} />
          <Route path="/cantina" element={<CanteenPublic />} />
          <Route path="/presenca" element={
            <SchoolProvider>
              <AttendancePublic />
            </SchoolProvider>
          } />
          <Route path="/professor-login" element={<TeacherLogin />} />
          <Route path="/relatorios-pais" element={<ParentReportsPortal />} />
          
          {/* Auth route */}
          <Route path="/auth" element={
            <AuthProvider>
              <SchoolProvider>
                <Auth />
              </SchoolProvider>
            </AuthProvider>
          } />
          
          {/* Protected routes - require authentication */}
          <Route path="/*" element={
            <AuthProvider>
              <SchoolProvider>
                <ProtectedRoute>
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/matricula" element={<Enrollment />} />
                      <Route path="/alunos" element={<Students />} />
                      <Route path="/responsaveis" element={<Guardians />} />
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
                      <Route path="/alocacao-alunos" element={<StudentAllocation />} />
                      <Route path="/inventario" element={<Inventory />} />
                      <Route path="/lms-alunos" element={<LMSStudents />} />
                      <Route path="/soroban-alunos" element={<SorobanStudents />} />
                      <Route path="/professores" element={<Teachers />} />
                      <Route path="/analise-pedagogica" element={<PedagogicalAnalysis />} />
                      <Route path="/deveres-casa" element={<HomeworkAnalysis />} />
                      <Route path="/presenca-admin" element={<AttendanceAdmin />} />
                      <Route path="/usuarios" element={<Users />} />
                      <Route path="/whatsapp-config" element={<WhatsAppConfig />} />
                      <Route path="/envio-massa" element={<BulkMessages />} />
                      <Route path="/atendimento-pais" element={<GuardianSupport />} />
                      <Route path="/suporte-mobile" element={<GuardianSupportMobile />} />
                      <Route path="/cantina-admin" element={<CanteenAdminPage />} />
                      <Route path="/campanhas-admin" element={<CampaignAdmin />} />
                      <Route path="/api-externa" element={<ExternalApiManager />} />
                      <Route path="/email" element={<EmailClient />} />
                      <Route path="/automacao" element={<IoTAutomation />} />
                      <Route path="/configuracoes" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              </SchoolProvider>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
