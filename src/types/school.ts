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

export interface ContractClause {
  id: string;
  title: string;
  content: string;
  order: number;
  isActive: boolean;
}

export interface ContractConfig {
  schoolName: string;
  schoolCnpj: string;
  schoolAddress: string;
  clauses: ContractClause[];
}

// Asaas Payment Types
export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
}

export interface AsaasPayment {
  id: string;
  customerId: string;
  value: number;
  netValue: number;
  billingType: 'BOLETO';
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  dueDate: string;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  description?: string;
  externalReference?: string;
  installment?: string;
}

export interface AsaasBoleto {
  identificationField: string;
  nossoNumero: string;
  barCode: string;
}

export interface PaymentConfig {
  dueDay: number;
  installments: number;
  finePercentage: number;
  interestPercentage: number;
}
