import React, { createContext, useContext, ReactNode } from 'react';
import { useSchoolData, DbGuardian, DbStudent, DbCourse, DbClassGroup, DbEnrollment, DbSchedule, DbContractClause, DbContractConfig, DbContract, DbPayment, DbCarne } from '@/hooks/useSchoolData';

// Re-export types for backward compatibility
export type Guardian = DbGuardian;
export type Student = DbStudent;
export type Course = DbCourse;
export type ClassGroup = DbClassGroup;
export type Enrollment = DbEnrollment;
export type Schedule = DbSchedule;
export type ContractClause = DbContractClause;
export type ContractConfig = DbContractConfig;
export type Contract = DbContract;
export type Payment = DbPayment;
export type Carne = DbCarne;

const SchoolContext = createContext<ReturnType<typeof useSchoolData> | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const schoolData = useSchoolData();

  return (
    <SchoolContext.Provider value={schoolData}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  
  // Add aliases for backward compatibility
  return {
    ...context,
    addCourse: context.createCourse,
    addSchedule: context.createSchedule,
    addClassGroup: context.createClassGroup,
    addContractClause: context.createContractClause,
    addStudent: context.createStudent,
    addGuardian: context.createGuardian,
    addEnrollment: context.createEnrollment,
  };
}
