import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SchoolProvider } from "@/contexts/SchoolContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Enrollment from "./pages/Enrollment";
import Students from "./pages/Students";
import Classes from "./pages/Classes";
import Courses from "./pages/Courses";
import Schedules from "./pages/Schedules";
import Contracts from "./pages/Contracts";
import ContractConfig from "./pages/ContractConfig";
import Payments from "./pages/Payments";
import Financial from "./pages/Financial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SchoolProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/matricula" element={<Enrollment />} />
              <Route path="/alunos" element={<Students />} />
              <Route path="/turmas" element={<Classes />} />
              <Route path="/cursos" element={<Courses />} />
              <Route path="/horarios" element={<Schedules />} />
              <Route path="/financeiro" element={<Financial />} />
              <Route path="/pagamentos" element={<Payments />} />
              <Route path="/contratos" element={<Contracts />} />
              <Route path="/contrato-config" element={<ContractConfig />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </SchoolProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
