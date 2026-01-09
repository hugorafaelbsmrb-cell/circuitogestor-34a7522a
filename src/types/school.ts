export interface Guardian {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  address: string;
}

export interface Student {
  id: string;
  name: string;
  birthDate: string;
  guardianId: string;
  guardian?: Guardian;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
}

export interface Schedule {
  id: string;
  courseId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  availableSlots: number;
}

export interface ClassGroup {
  id: string;
  name: string;
  courseId: string;
  course?: Course;
  scheduleId: string;
  schedule?: Schedule;
  maxStudents: number;
  currentStudents: number;
}

export interface Enrollment {
  id: string;
  studentId: string;
  student?: Student;
  classGroupId: string;
  classGroup?: ClassGroup;
  guardianId: string;
  guardian?: Guardian;
  enrollmentDate: string;
  status: 'active' | 'pending' | 'cancelled';
  contractGenerated: boolean;
}

export interface EnrollmentFormData {
  student: {
    name: string;
    birthDate: string;
  };
  guardian: {
    name: string;
    cpf: string;
    email: string;
    phone: string;
    address: string;
  };
  courseId: string;
  classGroupId: string;
}
