import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface IoTSchedule {
  id: string;
  device_id: string | null;
  name: string;
  action: string;
  time: string;
  days_of_week: number[];
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

interface CreateScheduleData {
  device_id: string;
  name: string;
  action: 'turn_on' | 'turn_off';
  time: string;
  days_of_week: number[];
}

export function useIoTSchedules() {
  const [schedules, setSchedules] = useState<IoTSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('iot_schedules')
        .select('*')
        .order('time', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar agendamentos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createSchedule = useCallback(async (scheduleData: CreateScheduleData) => {
    try {
      const { data, error } = await supabase
        .from('iot_schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (error) throw error;
      
      setSchedules(prev => [...prev, data]);
      
      toast({
        title: 'Agendamento criado',
        description: `${scheduleData.name} configurado com sucesso`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao criar agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<IoTSchedule>) => {
    try {
      const { error } = await supabase
        .from('iot_schedules')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setSchedules(prev => prev.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ));
      
      toast({
        title: 'Atualizado',
        description: 'Agendamento atualizado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar agendamento',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const deleteSchedule = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('iot_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSchedules(prev => prev.filter(s => s.id !== id));
      
      toast({
        title: 'Removido',
        description: 'Agendamento removido com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao remover agendamento',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const toggleSchedule = useCallback(async (id: string, isActive: boolean) => {
    await updateSchedule(id, { is_active: isActive });
  }, [updateSchedule]);

  return {
    schedules,
    isLoading,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
  };
}
