import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  class_group_id: string | null;
  attendance_date: string;
  expected_time: string;
  checked_in_at: string | null;
  status: 'pending' | 'present' | 'absent' | 'late';
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    name: string;
    guardian_id: string;
    guardian?: {
      id: string;
      name: string;
      phone: string;
    };
  };
  class_group?: {
    id: string;
    name: string;
    course?: {
      id: string;
      name: string;
    };
    schedule?: {
      id: string;
      day_of_week: string;
      start_time: string;
      end_time: string;
    };
  };
}

interface StudentForAttendance {
  id: string;
  name: string;
  guardian_id: string;
  enrollment_id: string;
  class_group_id: string;
  class_group_name: string;
  course_name: string;
  expected_time: string;
  schedule_id: string;
  day_of_week: string;
}

const DAY_MAP: Record<string, string> = {
  'sunday': 'Domingo',
  'monday': 'Segunda',
  'tuesday': 'Terça',
  'wednesday': 'Quarta',
  'thursday': 'Quinta',
  'friday': 'Sexta',
  'saturday': 'Sábado',
  'Segunda': 'Segunda',
  'Terça': 'Terça',
  'Quarta': 'Quarta',
  'Quinta': 'Quinta',
  'Sexta': 'Sexta',
  'Sábado': 'Sábado',
  'Domingo': 'Domingo',
  // Full day names in Portuguese
  'Segunda-feira': 'Segunda',
  'Terça-feira': 'Terça',
  'Quarta-feira': 'Quarta',
  'Quinta-feira': 'Quinta',
  'Sexta-feira': 'Sexta',
};

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [studentsForToday, setStudentsForToday] = useState<StudentForAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getCurrentDayOfWeek = useCallback(() => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[new Date().getDay()];
  }, []);

  const fetchStudentsForToday = useCallback(async () => {
    const today = getCurrentDayOfWeek();
    
    // Get all enrollment schedules for today with student and class info
    const { data: scheduleData, error } = await supabase
      .from('enrollment_schedules')
      .select(`
        id,
        enrollment_id,
        class_group_id,
        enrollment:enrollments!inner(
          id,
          status,
          student:students!inner(
            id,
            name,
            guardian_id,
            is_active
          )
        ),
        class_group:class_groups!inner(
          id,
          name,
          course:courses(id, name),
          schedule:schedules!inner(
            id,
            day_of_week,
            start_time,
            end_time
          )
        )
      `);

    if (error) {
      console.error('Error fetching students for today:', error);
      return [];
    }

    // Filter for today's day and active enrollments
    const studentsToday: StudentForAttendance[] = [];
    
    for (const item of scheduleData || []) {
      const enrollment = item.enrollment as any;
      const classGroup = item.class_group as any;
      const schedule = classGroup?.schedule;
      
      if (!enrollment || !classGroup || !schedule) continue;
      if (enrollment.status !== 'active') continue;
      if (!enrollment.student?.is_active) continue;
      
      const scheduleDayNormalized = DAY_MAP[schedule.day_of_week] || schedule.day_of_week;
      if (scheduleDayNormalized !== today) continue;
      
      studentsToday.push({
        id: enrollment.student.id,
        name: enrollment.student.name,
        guardian_id: enrollment.student.guardian_id,
        enrollment_id: enrollment.id,
        class_group_id: classGroup.id,
        class_group_name: classGroup.name,
        course_name: classGroup.course?.name || 'Curso não definido',
        expected_time: schedule.start_time,
        schedule_id: schedule.id,
        day_of_week: schedule.day_of_week,
      });
    }

    // Sort by expected time, then by name
    studentsToday.sort((a, b) => {
      const timeCompare = a.expected_time.localeCompare(b.expected_time);
      if (timeCompare !== 0) return timeCompare;
      return a.name.localeCompare(b.name);
    });

    setStudentsForToday(studentsToday);
    return studentsToday;
  }, [getCurrentDayOfWeek]);

  const fetchAttendanceRecords = useCallback(async (date?: string) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        student:students(
          id,
          name,
          guardian_id,
          guardian:guardians(id, name, phone)
        ),
        class_group:class_groups(
          id,
          name,
          course:courses(id, name),
          schedule:schedules(id, day_of_week, start_time, end_time)
        )
      `)
      .eq('attendance_date', targetDate)
      .order('expected_time', { ascending: true });

    if (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }

    setRecords(data as AttendanceRecord[]);
    return data;
  }, []);

  const createAttendanceRecordsForToday = useCallback(async () => {
    const students = await fetchStudentsForToday();
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Check which records already exist
    const { data: existingRecords } = await supabase
      .from('attendance_records')
      .select('student_id, class_group_id')
      .eq('attendance_date', today);

    const existingSet = new Set(
      (existingRecords || []).map(r => `${r.student_id}-${r.class_group_id}`)
    );

    // Create records for students that don't have one yet
    const newRecords = students
      .filter(s => !existingSet.has(`${s.id}-${s.class_group_id}`))
      .map(s => ({
        student_id: s.id,
        enrollment_id: s.enrollment_id,
        class_group_id: s.class_group_id,
        attendance_date: today,
        expected_time: s.expected_time,
        status: 'pending',
      }));

    if (newRecords.length > 0) {
      const { error } = await supabase
        .from('attendance_records')
        .insert(newRecords);

      if (error) {
        console.error('Error creating attendance records:', error);
      }
    }

    await fetchAttendanceRecords(today);
  }, [fetchStudentsForToday, fetchAttendanceRecords]);

  const checkIn = useCallback(async (studentId: string, classGroupId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    
    // First, try to find existing record
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, expected_time, status')
      .eq('student_id', studentId)
      .eq('class_group_id', classGroupId)
      .eq('attendance_date', today)
      .single();

    if (existingRecord) {
      // Determine if late
      const expectedTime = parse(existingRecord.expected_time, 'HH:mm:ss', new Date());
      const isLate = now > expectedTime;
      
      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: isLate ? 'late' : 'present',
          checked_in_at: now.toISOString(),
        })
        .eq('id', existingRecord.id);

      if (error) {
        toast.error('Erro ao registrar presença');
        return false;
      }
      
      toast.success(isLate ? 'Presença registrada (atrasado)' : 'Presença registrada!');
      return true;
    }

    // Find student info to create new record
    const student = studentsForToday.find(
      s => s.id === studentId && s.class_group_id === classGroupId
    );

    if (!student) {
      toast.error('Aluno não encontrado na lista de hoje');
      return false;
    }

    const expectedTime = parse(student.expected_time, 'HH:mm:ss', new Date());
    const isLate = now > expectedTime;

    const { error } = await supabase
      .from('attendance_records')
      .insert({
        student_id: studentId,
        enrollment_id: student.enrollment_id,
        class_group_id: classGroupId,
        attendance_date: today,
        expected_time: student.expected_time,
        status: isLate ? 'late' : 'present',
        checked_in_at: now.toISOString(),
      });

    if (error) {
      if (error.code === '23505') {
        // Record exists, update it
        return await checkIn(studentId, classGroupId);
      }
      toast.error('Erro ao registrar presença');
      return false;
    }

    toast.success(isLate ? 'Presença registrada (atrasado)' : 'Presença registrada!');
    return true;
  }, [studentsForToday]);

  const undoCheckIn = useCallback(async (recordId: string) => {
    const { error } = await supabase
      .from('attendance_records')
      .update({
        status: 'pending',
        checked_in_at: null,
      })
      .eq('id', recordId);

    if (error) {
      toast.error('Erro ao desfazer presença');
      return false;
    }

    toast.success('Presença desfeita');
    return true;
  }, []);

  const markAsAbsent = useCallback(async (studentId: string, classGroupId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: 'absent' })
      .eq('student_id', studentId)
      .eq('class_group_id', classGroupId)
      .eq('attendance_date', today);

    if (error) {
      toast.error('Erro ao marcar ausência');
      return false;
    }

    toast.success('Marcado como ausente');
    return true;
  }, []);

  const getStats = useCallback((date?: string) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    const dayRecords = records.filter(r => r.attendance_date === targetDate);
    
    return {
      total: dayRecords.length,
      present: dayRecords.filter(r => r.status === 'present').length,
      late: dayRecords.filter(r => r.status === 'late').length,
      absent: dayRecords.filter(r => r.status === 'absent').length,
      pending: dayRecords.filter(r => r.status === 'pending').length,
    };
  }, [records]);

  const fetchHistoryByDateRange = useCallback(async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        student:students(id, name, guardian_id),
        class_group:class_groups(id, name, course:courses(id, name))
      `)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false })
      .order('expected_time', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    return data as AttendanceRecord[];
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchStudentsForToday();
      await fetchAttendanceRecords();
      setIsLoading(false);
    };
    loadData();
  }, [fetchStudentsForToday, fetchAttendanceRecords]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
        },
        () => {
          fetchAttendanceRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendanceRecords]);

  return {
    records,
    studentsForToday,
    isLoading,
    checkIn,
    undoCheckIn,
    markAsAbsent,
    getStats,
    fetchAttendanceRecords,
    fetchStudentsForToday,
    createAttendanceRecordsForToday,
    fetchHistoryByDateRange,
    getCurrentDayOfWeek,
  };
}
