import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface IoTDevice {
  id: string;
  tuya_device_id: string;
  name: string;
  category: string;
  room: string | null;
  is_online: boolean | null;
  is_on: boolean | null;
  last_status: Json | null;
  last_sync_at: string | null;
}

export function useTuyaDevices() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('iot_devices')
        .select('*')
        .order('room', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dispositivos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const syncDevices = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('tuya-control', {
        body: { action: 'list_devices' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      await fetchDevices();
      
      toast({
        title: 'Sincronizado',
        description: `${data.devices?.length || 0} dispositivos encontrados`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDevices, toast]);

  const controlDevice = useCallback(async (
    deviceId: string, 
    tuyaDeviceId: string, 
    command: string, 
    value: boolean
  ) => {
    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, is_on: value } : d
    ));

    try {
      const { data, error } = await supabase.functions.invoke('tuya-control', {
        body: { 
          action: 'control',
          deviceId: tuyaDeviceId,
          command,
          value,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

    } catch (error: any) {
      // Revert optimistic update
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, is_on: !value } : d
      ));
      
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateDeviceRoom = useCallback(async (deviceId: string, room: string) => {
    try {
      const { error } = await supabase
        .from('iot_devices')
        .update({ room })
        .eq('id', deviceId);

      if (error) throw error;
      
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, room } : d
      ));
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar sala',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateDeviceName = useCallback(async (deviceId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('iot_devices')
        .update({ name })
        .eq('id', deviceId);

      if (error) throw error;
      
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, name } : d
      ));
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar nome',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const testConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('tuya-control', {
        body: { action: 'test_connection' },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: 'Conexão OK',
        description: 'Credenciais Tuya válidas',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Falha na conexão',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    devices,
    isLoading,
    isSyncing,
    fetchDevices,
    syncDevices,
    controlDevice,
    updateDeviceRoom,
    updateDeviceName,
    testConnection,
  };
}
