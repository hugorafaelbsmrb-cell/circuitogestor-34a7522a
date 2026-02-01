-- Tabela para armazenar dispositivos IoT (lâmpadas, tomadas, etc.)
CREATE TABLE public.iot_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuya_device_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'lamp',
  room TEXT,
  is_online BOOLEAN DEFAULT false,
  is_on BOOLEAN DEFAULT false,
  last_status JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para agendamentos de automação
CREATE TABLE public.iot_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'turn_off',
  time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas para iot_devices
CREATE POLICY "Authenticated users can view iot_devices" 
ON public.iot_devices FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert iot_devices" 
ON public.iot_devices FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update iot_devices" 
ON public.iot_devices FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete iot_devices" 
ON public.iot_devices FOR DELETE 
USING (is_admin(auth.uid()));

-- Políticas para iot_schedules
CREATE POLICY "Authenticated users can view iot_schedules" 
ON public.iot_schedules FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert iot_schedules" 
ON public.iot_schedules FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update iot_schedules" 
ON public.iot_schedules FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete iot_schedules" 
ON public.iot_schedules FOR DELETE 
USING (is_admin(auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_iot_devices_updated_at
BEFORE UPDATE ON public.iot_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_iot_schedules_updated_at
BEFORE UPDATE ON public.iot_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_iot_devices_category ON public.iot_devices(category);
CREATE INDEX idx_iot_devices_room ON public.iot_devices(room);
CREATE INDEX idx_iot_schedules_device_id ON public.iot_schedules(device_id);
CREATE INDEX idx_iot_schedules_is_active ON public.iot_schedules(is_active);