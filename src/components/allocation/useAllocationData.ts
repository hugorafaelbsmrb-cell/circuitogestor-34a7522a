import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StudentAllocationRow, Teacher, getShift, getShortName } from './types';

export function useAllocationData() {
  const teachersQuery = useQuery({
    queryKey: ['teachers-allocation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          id,
          name,
          course_id,
          course:courses(name)
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      
      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        courseId: t.course_id,
        courseName: t.course?.name || 'Sem curso',
      })) as Teacher[];
    }
  });

  const allocationQuery = useQuery({
    queryKey: ['student-allocation'],
    queryFn: async () => {
      const { data: enrollmentSchedulesData, error: esError } = await supabase
        .from('enrollment_schedules')
        .select(`
          id,
          enrollment:enrollments(
            id,
            status,
            student:students(
              id,
              name,
              birth_date,
              is_active,
              teacher_id,
              teacher:teachers(id, name),
              guardian:guardians(name, phone)
            )
          ),
          class_group:class_groups(
            id,
            name,
            is_active,
            course:courses(id, name),
            schedule:schedules(day_of_week, start_time, end_time)
          )
        `);
      
      const filteredSchedulesData = enrollmentSchedulesData?.filter((es: any) => {
        const enrollment = es.enrollment;
        const student = enrollment?.student;
        const classGroup = es.class_group;
        
        return enrollment?.status === 'active' && 
               student?.is_active === true && 
               classGroup?.is_active === true;
      }) || [];

      const rows: StudentAllocationRow[] = [];

      if (!esError && filteredSchedulesData.length > 0) {
        filteredSchedulesData.forEach((es: any) => {
          const enrollment = es.enrollment;
          const student = enrollment?.student;
          const classGroup = es.class_group;
          const course = classGroup?.course;
          const schedule = classGroup?.schedule;
          const guardian = student?.guardian;
          const teacher = student?.teacher;

          if (student && course && classGroup && schedule) {
            rows.push({
              studentId: student.id,
              studentName: student.name,
              shortName: getShortName(student.name),
              birthDate: student.birth_date,
              guardianName: guardian?.name || '-',
              guardianPhone: guardian?.phone || '-',
              courseName: course.name,
              courseId: course.id,
              className: classGroup.name,
              dayOfWeek: schedule.day_of_week,
              startTime: schedule.start_time,
              endTime: schedule.end_time,
              enrollmentStatus: enrollment.status,
              shift: getShift(schedule.start_time),
              teacherId: student.teacher_id || undefined,
              teacherName: teacher?.name || undefined,
            });
          }
        });
      }

      return rows;
    }
  });

  return {
    teachers: teachersQuery.data || [],
    allocationData: allocationQuery.data || [],
    isLoading: allocationQuery.isLoading,
  };
}
