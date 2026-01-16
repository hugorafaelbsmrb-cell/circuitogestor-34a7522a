import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Database types
export interface DbGuardian {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  address: string;
  address_number: string;
  province: string;
  postal_code: string;
  asaas_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbStudent {
  id: string;
  name: string;
  birth_date: string;
  guardian_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  guardian?: DbGuardian;
}

export interface DbCourse {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSchedule {
  id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  available_slots: number;
  created_at: string;
}

export interface DbClassGroup {
  id: string;
  name: string;
  course_id: string;
  schedule_id: string;
  max_students: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  course?: DbCourse;
  schedule?: DbSchedule;
}

export interface DbEnrollment {
  id: string;
  student_id: string;
  class_group_id: string;
  guardian_id: string;
  enrollment_date: string;
  status: string;
  contract_generated: boolean;
  contract_signed_at: string | null;
  created_at: string;
  updated_at: string;
  student?: DbStudent;
  class_group?: DbClassGroup;
  guardian?: DbGuardian;
}

export interface DbContract {
  id: string;
  enrollment_id: string;
  guardian_id: string;
  student_id: string;
  course_id: string;
  contract_content: unknown;
  total_value: number;
  installment_count: number;
  status: string;
  signed_at: string | null;
  created_at: string;
}

export interface DbPayment {
  id: string;
  enrollment_id: string | null;
  guardian_id: string;
  contract_id: string | null;
  asaas_payment_id: string | null;
  asaas_installment_id: string | null;
  description: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  billing_type: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  installment_number: number | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
  guardian?: DbGuardian;
  enrollment?: DbEnrollment;
}

export interface DbCarne {
  id: string;
  enrollment_id: string | null;
  guardian_id: string;
  contract_id: string | null;
  asaas_installment_id: string;
  description: string;
  total_value: number;
  installment_count: number;
  first_due_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbContractConfig {
  id: string;
  school_name: string;
  school_cnpj: string;
  school_address: string;
  created_at: string;
  updated_at: string;
}

export interface DbContractClause {
  id: string;
  title: string;
  content: string;
  clause_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbDiscount {
  id: string;
  name: string;
  description: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSchoolData() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [guardians, setGuardians] = useState<DbGuardian[]>([]);
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [schedules, setSchedules] = useState<DbSchedule[]>([]);
  const [classGroups, setClassGroups] = useState<DbClassGroup[]>([]);
  const [enrollments, setEnrollments] = useState<DbEnrollment[]>([]);
  const [contracts, setContracts] = useState<DbContract[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [carnes, setCarnes] = useState<DbCarne[]>([]);
  const [contractConfig, setContractConfig] = useState<DbContractConfig | null>(null);
  const [contractClauses, setContractClauses] = useState<DbContractClause[]>([]);
  const [discounts, setDiscounts] = useState<DbDiscount[]>([]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        guardiansRes,
        studentsRes,
        coursesRes,
        schedulesRes,
        classGroupsRes,
        enrollmentsRes,
        contractsRes,
        paymentsRes,
        carnesRes,
        contractConfigRes,
        contractClausesRes,
        discountsRes,
      ] = await Promise.all([
        supabase.from('guardians').select('*').order('name'),
        supabase.from('students').select('*').order('name'),
        supabase.from('courses').select('*').order('name'),
        supabase.from('schedules').select('*'),
        supabase.from('class_groups').select('*').order('name'),
        supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('due_date', { ascending: false }),
        supabase.from('carnes').select('*').order('created_at', { ascending: false }),
        supabase.from('contract_config').select('*').single(),
        supabase.from('contract_clauses').select('*').order('clause_order'),
        supabase.from('discounts').select('*').order('name'),
      ]);

      if (guardiansRes.data) setGuardians(guardiansRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (schedulesRes.data) setSchedules(schedulesRes.data);
      if (classGroupsRes.data) setClassGroups(classGroupsRes.data);
      if (enrollmentsRes.data) setEnrollments(enrollmentsRes.data);
      if (contractsRes.data) setContracts(contractsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (carnesRes.data) setCarnes(carnesRes.data);
      if (contractConfigRes.data) setContractConfig(contractConfigRes.data);
      if (contractClausesRes.data) setContractClauses(contractClausesRes.data);
      if (discountsRes.data) setDiscounts(discountsRes.data as DbDiscount[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do sistema.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Guardian CRUD
  const createGuardian = async (data: Omit<DbGuardian, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: result, error } = await supabase
      .from('guardians')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    setGuardians(prev => [...prev, result]);
    return result;
  };

  const updateGuardian = async (id: string, data: Partial<DbGuardian>) => {
    const { error } = await supabase
      .from('guardians')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setGuardians(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
  };

  // Student CRUD
  const createStudent = async (data: { name: string; birth_date: string; guardian_id: string }) => {
    const { data: result, error } = await supabase
      .from('students')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    setStudents(prev => [...prev, result]);
    return result;
  };

  const updateStudent = async (id: string, data: Partial<DbStudent>) => {
    const { error } = await supabase
      .from('students')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const deleteStudent = async (id: string) => {
    // Get student's enrollments to find related carnês and payments
    const studentEnrollments = enrollments.filter(e => e.student_id === id);
    const enrollmentIds = studentEnrollments.map(e => e.id);
    
    // Get related carnês and payments from state
    const studentCarnes = carnes.filter(c => c.enrollment_id && enrollmentIds.includes(c.enrollment_id));
    const studentPayments = payments.filter(p => 
      (p.enrollment_id && enrollmentIds.includes(p.enrollment_id)) ||
      (p.contract_id && contracts.some(c => c.student_id === id && c.id === p.contract_id))
    );
    
    // Cancel carnês in Asaas API first
    for (const carne of studentCarnes) {
      if (carne.asaas_installment_id && carne.status !== 'DELETED') {
        try {
          console.log('Cancelando carnê no Asaas:', carne.asaas_installment_id);
          const response = await supabase.functions.invoke('asaas-payment', {
            body: {
              action: 'deleteInstallment',
              data: { installmentId: carne.asaas_installment_id }
            }
          });
          
          if (response.error) {
            console.warn('Erro ao cancelar carnê no Asaas:', response.error);
          }
        } catch (err) {
          console.warn('Erro ao cancelar carnê no Asaas:', err);
          // Continue even if Asaas fails - we'll delete locally anyway
        }
      }
    }
    
    // Cancel individual payments in Asaas API
    for (const payment of studentPayments) {
      if (payment.asaas_payment_id && !payment.asaas_installment_id && payment.status === 'PENDING') {
        try {
          console.log('Cancelando boleto no Asaas:', payment.asaas_payment_id);
          const response = await supabase.functions.invoke('asaas-payment', {
            body: {
              action: 'deletePayment',
              data: { paymentId: payment.asaas_payment_id }
            }
          });
          
          if (response.error) {
            console.warn('Erro ao cancelar boleto no Asaas:', response.error);
          }
        } catch (err) {
          console.warn('Erro ao cancelar boleto no Asaas:', err);
        }
      }
    }
    
    // Delete related carnês from database
    if (enrollmentIds.length > 0) {
      const { error: carnesError } = await supabase
        .from('carnes')
        .delete()
        .in('enrollment_id', enrollmentIds);
      
      if (carnesError) {
        console.warn('Erro ao excluir carnês:', carnesError);
      }
    }
    
    // Delete related payments from database
    if (enrollmentIds.length > 0) {
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .in('enrollment_id', enrollmentIds);
      
      if (paymentsError) {
        console.warn('Erro ao excluir payments:', paymentsError);
      }
    }
    
    // Delete contract-related payments
    const studentContracts = contracts.filter(c => c.student_id === id);
    const contractIds = studentContracts.map(c => c.id);
    
    if (contractIds.length > 0) {
      const { error: contractPaymentsError } = await supabase
        .from('payments')
        .delete()
        .in('contract_id', contractIds);
      
      if (contractPaymentsError) {
        console.warn('Erro ao excluir payments de contratos:', contractPaymentsError);
      }
      
      // Delete carnês by contract_id
      const { error: contractCarnesError } = await supabase
        .from('carnes')
        .delete()
        .in('contract_id', contractIds);
      
      if (contractCarnesError) {
        console.warn('Erro ao excluir carnês de contratos:', contractCarnesError);
      }
    }
    
    // Delete related contracts
    const { error: contractError } = await supabase
      .from('contracts')
      .delete()
      .eq('student_id', id);
    
    if (contractError) throw contractError;

    // Delete related enrollments
    const { error: enrollmentError } = await supabase
      .from('enrollments')
      .delete()
      .eq('student_id', id);
    
    if (enrollmentError) throw enrollmentError;

    // Delete the student
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    setStudents(prev => prev.filter(s => s.id !== id));
    setEnrollments(prev => prev.filter(e => e.student_id !== id));
    setContracts(prev => prev.filter(c => c.student_id !== id));
    setCarnes(prev => prev.filter(c => !enrollmentIds.includes(c.enrollment_id || '') && !contractIds.includes(c.contract_id || '')));
    setPayments(prev => prev.filter(p => !enrollmentIds.includes(p.enrollment_id || '') && !contractIds.includes(p.contract_id || '')));
    
    // Refresh data to update counts
    await fetchData();
  };

  // Enrollment CRUD
  const createEnrollment = async (data: {
    student_id: string;
    class_group_id: string;
    guardian_id: string;
    status?: 'active' | 'pending' | 'cancelled';
  }) => {
    const { data: result, error } = await supabase
      .from('enrollments')
      .insert({
        ...data,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: data.status || 'active',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Increment class group student count
    await supabase
      .from('class_groups')
      .update({ current_students: classGroups.find(cg => cg.id === data.class_group_id)!.current_students + 1 })
      .eq('id', data.class_group_id);
    
    setEnrollments(prev => [result, ...prev]);
    await fetchData(); // Refresh to get updated counts
    return result;
  };

  const updateEnrollment = async (id: string, data: Partial<DbEnrollment>) => {
    const { error } = await supabase
      .from('enrollments')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setEnrollments(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  // Contract CRUD
  const createContract = async (data: {
    enrollment_id: string;
    guardian_id: string;
    student_id: string;
    course_id: string;
    contract_content: unknown;
    total_value: number;
    installment_count?: number;
  }) => {
    const { data: result, error } = await supabase
      .from('contracts')
      .insert([{
        enrollment_id: data.enrollment_id,
        guardian_id: data.guardian_id,
        student_id: data.student_id,
        course_id: data.course_id,
        contract_content: JSON.parse(JSON.stringify(data.contract_content)),
        total_value: data.total_value,
        installment_count: data.installment_count || 1,
        status: 'pending',
      }])
      .select()
      .single();
    
    if (error) throw error;
    setContracts(prev => [result as unknown as DbContract, ...prev]);
    return result as unknown as DbContract;
  };

  // Payment CRUD
  const createPayment = async (data: {
    enrollment_id?: string;
    guardian_id: string;
    contract_id?: string;
    asaas_payment_id?: string;
    asaas_installment_id?: string;
    description: string;
    value: number;
    due_date: string;
    status?: string;
    invoice_url?: string;
    bank_slip_url?: string;
    installment_number?: number;
    external_reference?: string;
  }) => {
    const { data: result, error } = await supabase
      .from('payments')
      .insert({
        ...data,
        status: data.status || 'PENDING',
        billing_type: 'BOLETO',
      })
      .select()
      .single();
    
    if (error) throw error;
    setPayments(prev => [result, ...prev]);
    return result;
  };

  const updatePayment = async (id: string, data: Partial<DbPayment>) => {
    const { error } = await supabase
      .from('payments')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  // Carnê CRUD
  const createCarne = async (data: {
    enrollment_id?: string;
    guardian_id: string;
    contract_id?: string;
    asaas_installment_id: string;
    description: string;
    total_value: number;
    installment_count: number;
    first_due_date: string;
  }) => {
    const { data: result, error } = await supabase
      .from('carnes')
      .insert({
        ...data,
        status: 'ACTIVE',
      })
      .select()
      .single();
    
    if (error) throw error;
    setCarnes(prev => [result, ...prev]);
    return result;
  };

  const updateCarne = async (id: string, data: Partial<DbCarne>) => {
    const { error } = await supabase
      .from('carnes')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setCarnes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCarne = async (id: string) => {
    // We don't actually delete, just update status to DELETED
    const { error } = await supabase
      .from('carnes')
      .update({ status: 'DELETED' })
      .eq('id', id);
    
    if (error) throw error;
    setCarnes(prev => prev.map(c => c.id === id ? { ...c, status: 'DELETED' } : c));
  };

  const refetchCarnes = async () => {
    const { data, error } = await supabase
      .from('carnes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setCarnes(data);
    }
  };

  // Course CRUD
  const createCourse = async (data: { name: string; description?: string; duration: string; price: number }) => {
    const { data: result, error } = await supabase
      .from('courses')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    setCourses(prev => [...prev, result]);
    return result;
  };

  const updateCourse = async (id: string, data: Partial<DbCourse>) => {
    const { error } = await supabase
      .from('courses')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCourse = async (id: string) => {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // Schedule CRUD
  const createSchedule = async (data: { course_id: string; day_of_week: string; start_time: string; end_time: string; available_slots?: number }) => {
    const { data: result, error } = await supabase
      .from('schedules')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    setSchedules(prev => [...prev, result]);
    return result;
  };

  const updateSchedule = async (id: string, data: Partial<DbSchedule>) => {
    const { error } = await supabase
      .from('schedules')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Class Group CRUD
  const createClassGroup = async (data: { name: string; course_id: string; schedule_id: string; max_students?: number }) => {
    const { data: result, error } = await supabase
      .from('class_groups')
      .insert({ ...data, current_students: 0 })
      .select()
      .single();
    
    if (error) throw error;
    setClassGroups(prev => [...prev, result]);
    return result;
  };

  const updateClassGroup = async (id: string, data: Partial<DbClassGroup>) => {
    const { error } = await supabase
      .from('class_groups')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setClassGroups(prev => prev.map(cg => cg.id === id ? { ...cg, ...data } : cg));
  };

  const deleteClassGroup = async (id: string) => {
    const { error } = await supabase
      .from('class_groups')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setClassGroups(prev => prev.filter(cg => cg.id !== id));
  };

  // Contract Config CRUD
  const updateContractConfig = async (data: Partial<DbContractConfig>) => {
    if (!contractConfig) return;
    const { error } = await supabase
      .from('contract_config')
      .update(data)
      .eq('id', contractConfig.id);
    
    if (error) throw error;
    setContractConfig(prev => prev ? { ...prev, ...data } : null);
  };

  // Contract Clauses CRUD
  const createContractClause = async (data: { title: string; content: string; clause_order: number; is_active?: boolean }) => {
    const { data: result, error } = await supabase
      .from('contract_clauses')
      .insert({ ...data, is_active: data.is_active ?? true })
      .select()
      .single();
    
    if (error) throw error;
    setContractClauses(prev => [...prev, result].sort((a, b) => a.clause_order - b.clause_order));
    return result;
  };

  const updateContractClause = async (id: string, data: Partial<DbContractClause>) => {
    const { error } = await supabase
      .from('contract_clauses')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    setContractClauses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c).sort((a, b) => a.clause_order - b.clause_order));
  };

  const deleteContractClause = async (id: string) => {
    const { error } = await supabase
      .from('contract_clauses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setContractClauses(prev => prev.filter(c => c.id !== id));
  };

  // Helper functions
  const getGuardianById = (id: string) => guardians.find(g => g.id === id);
  const getGuardianByCpf = (cpf: string) => guardians.find(g => g.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  const getStudentById = (id: string) => students.find(s => s.id === id);
  const getCourseById = (id: string) => courses.find(c => c.id === id);
  const getClassGroupById = (id: string) => classGroups.find(cg => cg.id === id);
  const getScheduleById = (id: string) => schedules.find(s => s.id === id);

  return {
    isLoading,
    refetch: fetchData,
    
    // Data
    guardians,
    students,
    courses,
    schedules,
    classGroups,
    enrollments,
    contracts,
    payments,
    carnes,
    contractConfig,
    contractClauses,
    discounts,
    
    // Guardian
    createGuardian,
    updateGuardian,
    
    // Student
    createStudent,
    updateStudent,
    deleteStudent,
    
    // Enrollment
    createEnrollment,
    updateEnrollment,
    
    // Contract
    createContract,
    
    // Payment
    createPayment,
    updatePayment,
    
    // Carnê
    createCarne,
    updateCarne,
    deleteCarne,
    refetchCarnes,
    
    // Course
    createCourse,
    updateCourse,
    deleteCourse,
    
    // Schedule
    createSchedule,
    updateSchedule,
    deleteSchedule,
    
    // Class Group
    createClassGroup,
    updateClassGroup,
    deleteClassGroup,
    
    // Contract Config
    updateContractConfig,
    
    // Contract Clauses
    createContractClause,
    updateContractClause,
    deleteContractClause,
    
    // Helpers
    getGuardianById,
    getGuardianByCpf,
    getStudentById,
    getCourseById,
    getClassGroupById,
    getScheduleById,
  };
}
