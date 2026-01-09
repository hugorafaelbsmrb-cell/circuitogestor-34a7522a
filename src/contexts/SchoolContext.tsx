import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Student, Guardian, Course, ClassGroup, Enrollment, Schedule, ContractClause, ContractConfig } from '@/types/school';

interface SchoolContextType {
  students: Student[];
  guardians: Guardian[];
  courses: Course[];
  classGroups: ClassGroup[];
  enrollments: Enrollment[];
  schedules: Schedule[];
  contractConfig: ContractConfig;
  addStudent: (student: Omit<Student, 'id'>) => Student;
  addGuardian: (guardian: Omit<Guardian, 'id'>) => Guardian;
  addEnrollment: (enrollment: Omit<Enrollment, 'id'>) => Enrollment;
  addCourse: (course: Omit<Course, 'id'>) => Course;
  updateCourse: (id: string, course: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  addSchedule: (schedule: Omit<Schedule, 'id'>) => Schedule;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  addClassGroup: (classGroup: Omit<ClassGroup, 'id'>) => ClassGroup;
  updateClassGroup: (id: string, classGroup: Partial<ClassGroup>) => void;
  deleteClassGroup: (id: string) => void;
  updateContractConfig: (config: Partial<ContractConfig>) => void;
  addContractClause: (clause: Omit<ContractClause, 'id'>) => ContractClause;
  updateContractClause: (id: string, clause: Partial<ContractClause>) => void;
  deleteContractClause: (id: string) => void;
  getGuardianById: (id: string) => Guardian | undefined;
  getStudentById: (id: string) => Student | undefined;
  getCourseById: (id: string) => Course | undefined;
  getClassGroupById: (id: string) => ClassGroup | undefined;
  getScheduleById: (id: string) => Schedule | undefined;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substr(2, 9);

const initialCourses: Course[] = [
  { id: '1', name: 'Inglês Básico', description: 'Curso de inglês para iniciantes', duration: '6 meses', price: 299.90 },
  { id: '2', name: 'Inglês Intermediário', description: 'Curso de inglês nível intermediário', duration: '6 meses', price: 349.90 },
  { id: '3', name: 'Espanhol Básico', description: 'Curso de espanhol para iniciantes', duration: '6 meses', price: 279.90 },
  { id: '4', name: 'Informática Kids', description: 'Introdução à informática para crianças', duration: '4 meses', price: 199.90 },
  { id: '5', name: 'Reforço Escolar', description: 'Aulas de reforço em matemática e português', duration: '3 meses', price: 249.90 },
];

const initialSchedules: Schedule[] = [
  { id: 's1', courseId: '1', dayOfWeek: 'Segunda e Quarta', startTime: '14:00', endTime: '15:30', availableSlots: 15 },
  { id: 's2', courseId: '1', dayOfWeek: 'Terça e Quinta', startTime: '16:00', endTime: '17:30', availableSlots: 15 },
  { id: 's3', courseId: '2', dayOfWeek: 'Segunda e Quarta', startTime: '16:00', endTime: '17:30', availableSlots: 12 },
  { id: 's4', courseId: '3', dayOfWeek: 'Terça e Quinta', startTime: '14:00', endTime: '15:30', availableSlots: 15 },
  { id: 's5', courseId: '4', dayOfWeek: 'Sexta', startTime: '14:00', endTime: '16:00', availableSlots: 10 },
  { id: 's6', courseId: '5', dayOfWeek: 'Sábado', startTime: '09:00', endTime: '11:00', availableSlots: 8 },
];

const initialClassGroups: ClassGroup[] = [
  { id: 'c1', name: 'Turma A - Inglês Básico', courseId: '1', scheduleId: 's1', maxStudents: 15, currentStudents: 8 },
  { id: 'c2', name: 'Turma B - Inglês Básico', courseId: '1', scheduleId: 's2', maxStudents: 15, currentStudents: 12 },
  { id: 'c3', name: 'Turma A - Inglês Intermediário', courseId: '2', scheduleId: 's3', maxStudents: 12, currentStudents: 5 },
  { id: 'c4', name: 'Turma A - Espanhol', courseId: '3', scheduleId: 's4', maxStudents: 15, currentStudents: 10 },
  { id: 'c5', name: 'Turma Kids', courseId: '4', scheduleId: 's5', maxStudents: 10, currentStudents: 7 },
  { id: 'c6', name: 'Turma Reforço', courseId: '5', scheduleId: 's6', maxStudents: 8, currentStudents: 4 },
];

const initialContractClauses: ContractClause[] = [
  { id: 'cl1', title: 'Objeto do Contrato', content: 'O presente contrato tem por objeto a prestação de serviços educacionais pelo CONTRATADO ao ALUNO, conforme curso e turma especificados.', order: 1, isActive: true },
  { id: 'cl2', title: 'Obrigações do Contratante', content: 'O CONTRATANTE se compromete a efetuar o pagamento das mensalidades até o dia 10 de cada mês, bem como acompanhar o desempenho escolar do aluno.', order: 2, isActive: true },
  { id: 'cl3', title: 'Obrigações do Contratado', content: 'O CONTRATADO se compromete a fornecer ensino de qualidade, disponibilizar material didático adequado e manter comunicação regular com o responsável.', order: 3, isActive: true },
  { id: 'cl4', title: 'Cancelamento', content: 'O cancelamento da matrícula deverá ser solicitado com antecedência mínima de 30 dias, mediante comunicação por escrito.', order: 4, isActive: true },
  { id: 'cl5', title: 'Foro', content: 'Fica eleito o foro da comarca da sede do CONTRATADO para dirimir quaisquer dúvidas oriundas do presente contrato.', order: 5, isActive: true },
];

const initialContractConfig: ContractConfig = {
  schoolName: 'EduGestor Escola de Cursos',
  schoolCnpj: '00.000.000/0001-00',
  schoolAddress: 'Rua da Educação, 123 - Centro',
  clauses: initialContractClauses,
};

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>(initialClassGroups);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [contractConfig, setContractConfig] = useState<ContractConfig>(initialContractConfig);

  const addStudent = (student: Omit<Student, 'id'>): Student => {
    const newStudent = { ...student, id: generateId() };
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const addGuardian = (guardian: Omit<Guardian, 'id'>): Guardian => {
    const newGuardian = { ...guardian, id: generateId() };
    setGuardians(prev => [...prev, newGuardian]);
    return newGuardian;
  };

  const addEnrollment = (enrollment: Omit<Enrollment, 'id'>): Enrollment => {
    const newEnrollment = { ...enrollment, id: generateId() };
    setEnrollments(prev => [...prev, newEnrollment]);
    
    setClassGroups(prev => 
      prev.map(cg => 
        cg.id === enrollment.classGroupId 
          ? { ...cg, currentStudents: cg.currentStudents + 1 }
          : cg
      )
    );
    
    return newEnrollment;
  };

  // Course CRUD
  const addCourse = (course: Omit<Course, 'id'>): Course => {
    const newCourse = { ...course, id: generateId() };
    setCourses(prev => [...prev, newCourse]);
    return newCourse;
  };

  const updateCourse = (id: string, course: Partial<Course>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...course } : c));
  };

  const deleteCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // Schedule CRUD
  const addSchedule = (schedule: Omit<Schedule, 'id'>): Schedule => {
    const newSchedule = { ...schedule, id: generateId() };
    setSchedules(prev => [...prev, newSchedule]);
    return newSchedule;
  };

  const updateSchedule = (id: string, schedule: Partial<Schedule>) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...schedule } : s));
  };

  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // ClassGroup CRUD
  const addClassGroup = (classGroup: Omit<ClassGroup, 'id'>): ClassGroup => {
    const newClassGroup = { ...classGroup, id: generateId() };
    setClassGroups(prev => [...prev, newClassGroup]);
    return newClassGroup;
  };

  const updateClassGroup = (id: string, classGroup: Partial<ClassGroup>) => {
    setClassGroups(prev => prev.map(cg => cg.id === id ? { ...cg, ...classGroup } : cg));
  };

  const deleteClassGroup = (id: string) => {
    setClassGroups(prev => prev.filter(cg => cg.id !== id));
  };

  // Contract Config
  const updateContractConfig = (config: Partial<ContractConfig>) => {
    setContractConfig(prev => ({ ...prev, ...config }));
  };

  const addContractClause = (clause: Omit<ContractClause, 'id'>): ContractClause => {
    const newClause = { ...clause, id: generateId() };
    setContractConfig(prev => ({
      ...prev,
      clauses: [...prev.clauses, newClause],
    }));
    return newClause;
  };

  const updateContractClause = (id: string, clause: Partial<ContractClause>) => {
    setContractConfig(prev => ({
      ...prev,
      clauses: prev.clauses.map(c => c.id === id ? { ...c, ...clause } : c),
    }));
  };

  const deleteContractClause = (id: string) => {
    setContractConfig(prev => ({
      ...prev,
      clauses: prev.clauses.filter(c => c.id !== id),
    }));
  };

  const getGuardianById = (id: string) => guardians.find(g => g.id === id);
  const getStudentById = (id: string) => students.find(s => s.id === id);
  const getCourseById = (id: string) => courses.find(c => c.id === id);
  const getClassGroupById = (id: string) => classGroups.find(cg => cg.id === id);
  const getScheduleById = (id: string) => schedules.find(s => s.id === id);

  return (
    <SchoolContext.Provider value={{
      students,
      guardians,
      courses,
      classGroups,
      enrollments,
      schedules,
      contractConfig,
      addStudent,
      addGuardian,
      addEnrollment,
      addCourse,
      updateCourse,
      deleteCourse,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      addClassGroup,
      updateClassGroup,
      deleteClassGroup,
      updateContractConfig,
      addContractClause,
      updateContractClause,
      deleteContractClause,
      getGuardianById,
      getStudentById,
      getCourseById,
      getClassGroupById,
      getScheduleById,
    }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
