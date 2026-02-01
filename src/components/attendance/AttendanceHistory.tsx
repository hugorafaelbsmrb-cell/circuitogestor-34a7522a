import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  expected_time: string;
  checked_in_at: string | null;
  status: string;
  student?: {
    id: string;
    name: string;
  };
  class_group?: {
    id: string;
    name: string;
    course?: {
      id: string;
      name: string;
    };
  };
}

export function AttendanceHistory() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        student:students(id, name),
        class_group:class_groups(id, name, course:courses(id, name))
      `)
      .gte('attendance_date', format(start, 'yyyy-MM-dd'))
      .lte('attendance_date', format(end, 'yyyy-MM-dd'))
      .order('attendance_date', { ascending: false })
      .order('expected_time', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error);
    } else {
      setRecords(data as AttendanceRecord[]);
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const goToPreviousWeek = () => {
    setSelectedDate(prev => subDays(prev, 7));
  };

  const goToNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const formatTime = (time: string) => {
    if (!time) return '-';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      present: { variant: 'default', label: 'Presente' },
      late: { variant: 'secondary', label: 'Atrasado' },
      absent: { variant: 'destructive', label: 'Ausente' },
      pending: { variant: 'outline', label: 'Pendente' },
    };
    const { variant, label } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Group records by date
  const recordsByDate = records.reduce((acc, record) => {
    const date = record.attendance_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  const exportToCSV = () => {
    const headers = ['Data', 'Aluno', 'Curso', 'Turma', 'Horário Esperado', 'Chegada', 'Status'];
    const rows = records.map(r => [
      format(new Date(r.attendance_date), 'dd/MM/yyyy'),
      r.student?.name || '-',
      r.class_group?.course?.name || '-',
      r.class_group?.name || '-',
      formatTime(r.expected_time),
      formatDateTime(r.checked_in_at),
      r.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presenca-${format(weekStart, 'yyyy-MM-dd')}-${format(weekEnd, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(weekStart, 'dd MMM', { locale: ptBR })} - {format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        <Button variant="outline" onClick={exportToCSV} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Records Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : Object.keys(recordsByDate).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum registro de presença encontrado para este período.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(recordsByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayRecords]) => (
              <Card key={date}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">
                    {format(new Date(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    <Badge variant="outline" className="ml-2">
                      {dayRecords.length} registro{dayRecords.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Curso</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Esperado</TableHead>
                          <TableHead>Chegada</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {record.student?.name || '-'}
                            </TableCell>
                            <TableCell>
                              {record.class_group?.course?.name || '-'}
                            </TableCell>
                            <TableCell>
                              {record.class_group?.name || '-'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatTime(record.expected_time)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatDateTime(record.checked_in_at)}
                            </TableCell>
                            <TableCell>
                              {statusBadge(record.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
