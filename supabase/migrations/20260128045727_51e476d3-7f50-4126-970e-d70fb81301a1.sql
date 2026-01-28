-- Criar tabela enrollment_schedules para armazenar múltiplos dias por matrícula
CREATE TABLE public.enrollment_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  class_group_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_enrollment_schedules_enrollment_id ON public.enrollment_schedules(enrollment_id);
CREATE INDEX idx_enrollment_schedules_class_group_id ON public.enrollment_schedules(class_group_id);

-- Habilitar RLS
ALTER TABLE public.enrollment_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view enrollment_schedules"
ON public.enrollment_schedules
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert enrollment_schedules"
ON public.enrollment_schedules
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update enrollment_schedules"
ON public.enrollment_schedules
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete enrollment_schedules"
ON public.enrollment_schedules
FOR DELETE
USING (is_admin(auth.uid()));

-- Migrar dados existentes: criar um registro para cada matrícula ativa
INSERT INTO public.enrollment_schedules (enrollment_id, class_group_id)
SELECT id, class_group_id
FROM public.enrollments
WHERE status = 'active' AND class_group_id IS NOT NULL;