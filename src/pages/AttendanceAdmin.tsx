import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserCheck, Clock, Settings, History, ListChecks, RefreshCw, Play, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttendance } from '@/hooks/useAttendance';
import { 
  AttendanceStats, 
  PendingStudentsList, 
  AttendanceConfigPanel, 
  AttendanceHistory 
} from '@/components/attendance';
import { toast } from 'sonner';

export default function AttendanceAdmin() {
  const {
    records,
    studentsForToday,
    isLoading,
    checkIn,
    undoCheckIn,
    getStats,
    fetchStudentsForToday,
    fetchAttendanceRecords,
    createAttendanceRecordsForToday,
    getCurrentDayOfWeek,
  } = useAttendance();

  const [activeTab, setActiveTab] = useState('pending');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStudentsForToday();
    await fetchAttendanceRecords();
    setIsRefreshing(false);
    toast.success('Lista atualizada');
  };

  const handleCreateRecords = async () => {
    setIsCreating(true);
    await createAttendanceRecordsForToday();
    setIsCreating(false);
    toast.success('Registros do dia criados');
  };

  const stats = getStats();
  const today = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const currentDay = getCurrentDayOfWeek();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="w-6 h-6" />
            Controle de Presença
          </h1>
          <p className="text-muted-foreground capitalize">
            {currentDay}, {today}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            asChild
            className="gap-2"
          >
            <Link to="/presenca">
              <ExternalLink className="w-4 h-4" />
              Marcar Presença
            </Link>
          </Button>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button
            onClick={handleCreateRecords}
            disabled={isCreating || isLoading}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Iniciar Dia
          </Button>
        </div>
      </div>

      {/* Stats */}
      <AttendanceStats {...stats} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Pendentes</span>
            {stats.pending > 0 && (
              <span className="ml-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {stats.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">Todos</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                Alunos Aguardando Check-in
              </CardTitle>
              <CardDescription>
                Clique no aluno para registrar a presença. Mostrando apenas pendentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <PendingStudentsList
                  records={records}
                  studentsForToday={studentsForToday}
                  onCheckIn={checkIn}
                  onUndo={undoCheckIn}
                  showAllStatuses={false}
                  isLoading={isLoading}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Todos os Alunos de Hoje
              </CardTitle>
              <CardDescription>
                Visualize e gerencie todos os registros de presença do dia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <PendingStudentsList
                  records={records}
                  studentsForToday={studentsForToday}
                  onCheckIn={checkIn}
                  onUndo={undoCheckIn}
                  showAllStatuses={true}
                  isLoading={isLoading}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <AttendanceHistory />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <AttendanceConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
