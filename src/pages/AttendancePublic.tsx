import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserCheck, RefreshCw, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttendance } from '@/hooks/useAttendance';
import { AttendanceStats, PendingStudentsList } from '@/components/attendance';
import { useSystemBranding } from '@/hooks/useSystemBranding';

export default function AttendancePublic() {
  const { branding } = useSystemBranding();
  const {
    records,
    studentsForToday,
    isLoading,
    checkIn,
    undoCheckIn,
    getStats,
    fetchStudentsForToday,
    fetchAttendanceRecords,
    getCurrentDayOfWeek,
  } = useAttendance();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStudentsForToday();
    await fetchAttendanceRecords();
    setIsRefreshing(false);
  };

  const stats = getStats();
  const today = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const currentDay = getCurrentDayOfWeek();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding.logo ? (
                <img 
                  src={branding.logo} 
                  alt={branding.name} 
                  className="w-10 h-10 rounded-xl object-contain"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <School className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <div>
                <h1 className="font-semibold text-lg">{branding.name}</h1>
                <p className="text-xs text-muted-foreground">Registro de Presença</p>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Date and Stats */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold capitalize">{currentDay}</h2>
              <p className="text-muted-foreground capitalize">{today}</p>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <UserCheck className="w-5 h-5" />
              <span className="font-semibold">
                {stats.present + stats.late}/{stats.total}
              </span>
            </div>
          </div>
          
          <AttendanceStats {...stats} />
        </div>

        {/* Students List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Alunos Aguardando Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : studentsForToday.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">Nenhum aluno esperado para hoje.</p>
                <p className="text-sm">Verifique os horários configurados no sistema.</p>
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
      </main>
    </div>
  );
}
