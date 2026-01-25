-- Enable realtime for guardians table
ALTER PUBLICATION supabase_realtime ADD TABLE public.guardians;

-- Enable realtime for students table
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;

-- Enable realtime for enrollments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;