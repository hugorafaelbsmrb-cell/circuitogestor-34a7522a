-- Fix contracts table
DROP POLICY IF EXISTS "Allow all for contracts" ON public.contracts;

CREATE POLICY "Authenticated users can view contracts"
ON public.contracts FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contracts"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix students table
DROP POLICY IF EXISTS "Allow all for students" ON public.students;

CREATE POLICY "Authenticated users can view students"
ON public.students FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert students"
ON public.students FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update students"
ON public.students FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete students"
ON public.students FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix enrollments table
DROP POLICY IF EXISTS "Allow all for enrollments" ON public.enrollments;

CREATE POLICY "Authenticated users can view enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert enrollments"
ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update enrollments"
ON public.enrollments FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete enrollments"
ON public.enrollments FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix carnes table
DROP POLICY IF EXISTS "Allow all for carnes" ON public.carnes;

CREATE POLICY "Authenticated users can view carnes"
ON public.carnes FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert carnes"
ON public.carnes FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update carnes"
ON public.carnes FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete carnes"
ON public.carnes FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix class_groups table
DROP POLICY IF EXISTS "Allow all for class_groups" ON public.class_groups;

CREATE POLICY "Authenticated users can view class_groups"
ON public.class_groups FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert class_groups"
ON public.class_groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update class_groups"
ON public.class_groups FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete class_groups"
ON public.class_groups FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix schedules table
DROP POLICY IF EXISTS "Allow all for schedules" ON public.schedules;

CREATE POLICY "Authenticated users can view schedules"
ON public.schedules FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert schedules"
ON public.schedules FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update schedules"
ON public.schedules FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete schedules"
ON public.schedules FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix courses table
DROP POLICY IF EXISTS "Allow all for courses" ON public.courses;

CREATE POLICY "Authenticated users can view courses"
ON public.courses FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert courses"
ON public.courses FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update courses"
ON public.courses FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete courses"
ON public.courses FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix contract_config table
DROP POLICY IF EXISTS "Allow all for contract_config" ON public.contract_config;

CREATE POLICY "Authenticated users can view contract_config"
ON public.contract_config FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contract_config"
ON public.contract_config FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contract_config"
ON public.contract_config FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete contract_config"
ON public.contract_config FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Fix contract_clauses table
DROP POLICY IF EXISTS "Allow all for contract_clauses" ON public.contract_clauses;

CREATE POLICY "Authenticated users can view contract_clauses"
ON public.contract_clauses FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contract_clauses"
ON public.contract_clauses FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contract_clauses"
ON public.contract_clauses FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete contract_clauses"
ON public.contract_clauses FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));