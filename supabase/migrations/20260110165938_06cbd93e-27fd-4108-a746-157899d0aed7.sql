-- Insert schedules
INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Segunda e Quarta', '14:00', '15:30', 15 FROM public.courses WHERE name = 'Inglês Básico';

INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Terça e Quinta', '16:00', '17:30', 15 FROM public.courses WHERE name = 'Inglês Básico';

INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Segunda e Quarta', '16:00', '17:30', 12 FROM public.courses WHERE name = 'Inglês Intermediário';

INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Terça e Quinta', '14:00', '15:30', 15 FROM public.courses WHERE name = 'Espanhol Básico';

INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Sexta', '14:00', '16:00', 10 FROM public.courses WHERE name = 'Informática Kids';

INSERT INTO public.schedules (course_id, day_of_week, start_time, end_time, available_slots)
SELECT id, 'Sábado', '09:00', '11:00', 8 FROM public.courses WHERE name = 'Reforço Escolar';

-- Insert class groups
INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma A - Inglês Básico', c.id, s.id, 15, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Inglês Básico' AND s.day_of_week = 'Segunda e Quarta';

INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma B - Inglês Básico', c.id, s.id, 15, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Inglês Básico' AND s.day_of_week = 'Terça e Quinta';

INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma A - Inglês Intermediário', c.id, s.id, 12, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Inglês Intermediário';

INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma A - Espanhol', c.id, s.id, 15, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Espanhol Básico';

INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma Kids', c.id, s.id, 10, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Informática Kids';

INSERT INTO public.class_groups (name, course_id, schedule_id, max_students, current_students)
SELECT 'Turma Reforço', c.id, s.id, 8, 0
FROM public.courses c
JOIN public.schedules s ON s.course_id = c.id
WHERE c.name = 'Reforço Escolar';