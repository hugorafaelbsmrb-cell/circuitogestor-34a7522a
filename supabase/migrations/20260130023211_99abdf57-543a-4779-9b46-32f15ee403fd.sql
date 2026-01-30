-- Add public SELECT policies for parent portal access
-- These allow unauthenticated users to search guardians by CPF and view related data

-- Policy for guardians: Allow public to search by CPF
CREATE POLICY "Public can search guardians by CPF"
ON public.guardians
FOR SELECT
TO anon
USING (true);

-- Policy for students: Allow public to view students linked to guardians
CREATE POLICY "Public can view students for parent portal"
ON public.students
FOR SELECT
TO anon
USING (is_active = true);

-- Policy for student_reports: Allow public to view approved reports
CREATE POLICY "Public can view approved reports"
ON public.student_reports
FOR SELECT
TO anon
USING (approval_status = 'approved' AND (hidden_from_portal IS NULL OR hidden_from_portal = false));

-- Policy for enrollments: Allow public to view active enrollments for parent portal
CREATE POLICY "Public can view enrollments for parent portal"
ON public.enrollments
FOR SELECT
TO anon
USING (status = 'active');

-- Policy for class_groups: Allow public to view class groups for parent portal
CREATE POLICY "Public can view class groups for parent portal"
ON public.class_groups
FOR SELECT
TO anon
USING (true);

-- Policy for courses: Allow public to view courses for parent portal
CREATE POLICY "Public can view courses for parent portal"
ON public.courses
FOR SELECT
TO anon
USING (is_active = true);

-- Policy for teachers: Allow public to view teacher names for reports
CREATE POLICY "Public can view teachers for parent portal"
ON public.teachers
FOR SELECT
TO anon
USING (is_active = true);