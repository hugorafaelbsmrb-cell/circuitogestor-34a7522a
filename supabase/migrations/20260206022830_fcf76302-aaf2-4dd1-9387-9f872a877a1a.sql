-- Add public SELECT policies for attendance system

-- Allow public to view enrollment_schedules for attendance
CREATE POLICY "Public can view enrollment_schedules for attendance"
ON public.enrollment_schedules
FOR SELECT
USING (true);

-- Allow public to view enrollments for attendance (only active)
CREATE POLICY "Public can view active enrollments for attendance"
ON public.enrollments
FOR SELECT
USING (status = 'active');

-- Allow public to view class_groups for attendance
CREATE POLICY "Public can view class_groups for attendance"
ON public.class_groups
FOR SELECT
USING (is_active = true);

-- Allow public to view schedules for attendance
CREATE POLICY "Public can view schedules for attendance"
ON public.schedules
FOR SELECT
USING (true);

-- Allow public to view attendance_records for the public page
CREATE POLICY "Public can view attendance_records"
ON public.attendance_records
FOR SELECT
USING (true);

-- Allow public to update attendance_records for check-in
CREATE POLICY "Public can update attendance_records for check-in"
ON public.attendance_records
FOR UPDATE
USING (true);