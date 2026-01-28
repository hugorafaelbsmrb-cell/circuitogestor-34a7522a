export interface StudentAllocationRow {
  studentId: string;
  studentName: string;
  shortName: string;
  birthDate: string;
  guardianName: string;
  guardianPhone: string;
  courseName: string;
  courseId: string;
  className: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enrollmentStatus: string;
  shift: 'morning' | 'afternoon';
}

export interface Teacher {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
}

export type ShiftType = 'morning' | 'afternoon';
export type ShiftFilter = 'all' | 'morning' | 'afternoon';

export interface GroupedCourseData {
  morning: Record<string, StudentAllocationRow[]>;
  afternoon: Record<string, StudentAllocationRow[]>;
  courseId: string;
}

export const DAYS_OF_WEEK = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'] as const;

export const DAY_COLORS: Record<string, string> = {
  'Segunda-feira': 'bg-blue-500',
  'Terça-feira': 'bg-green-500',
  'Quarta-feira': 'bg-purple-500',
  'Quinta-feira': 'bg-orange-500',
  'Sexta-feira': 'bg-pink-500',
};

export const DAY_SHORT_NAMES: Record<string, string> = {
  'Segunda-feira': 'Segunda',
  'Terça-feira': 'Terça',
  'Quarta-feira': 'Quarta',
  'Quinta-feira': 'Quinta',
  'Sexta-feira': 'Sexta',
};

export const getShift = (startTime: string): ShiftType => {
  const hour = parseInt(startTime.split(':')[0], 10);
  return hour < 12 ? 'morning' : 'afternoon';
};

export const getShortName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || fullName;
};
