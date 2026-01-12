-- Fix RLS policies - change from RESTRICTIVE to PERMISSIVE

-- Drop existing restrictive policies for leads
DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON leads;

-- Create permissive policies for leads
CREATE POLICY "Authenticated users can view leads" ON leads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert leads" ON leads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update leads" ON leads FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete leads" ON leads FOR DELETE USING (auth.uid() IS NOT NULL);

-- Drop existing restrictive policies for discounts
DROP POLICY IF EXISTS "Authenticated users can view discounts" ON discounts;
DROP POLICY IF EXISTS "Authenticated users can insert discounts" ON discounts;
DROP POLICY IF EXISTS "Authenticated users can update discounts" ON discounts;
DROP POLICY IF EXISTS "Authenticated users can delete discounts" ON discounts;

-- Create permissive policies for discounts
CREATE POLICY "Authenticated users can view discounts" ON discounts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert discounts" ON discounts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update discounts" ON discounts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete discounts" ON discounts FOR DELETE USING (auth.uid() IS NOT NULL);

-- Drop existing restrictive policies for app_settings
DROP POLICY IF EXISTS "Authenticated users can view settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can delete settings" ON app_settings;

-- Create permissive policies for app_settings
CREATE POLICY "Authenticated users can view settings" ON app_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert settings" ON app_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update settings" ON app_settings FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete settings" ON app_settings FOR DELETE USING (auth.uid() IS NOT NULL);

-- Drop existing restrictive policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create permissive policies for profiles - admins can manage all, users can view/update own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);