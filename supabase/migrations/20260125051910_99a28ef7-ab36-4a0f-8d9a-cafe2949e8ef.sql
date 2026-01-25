-- Add avatar_url column to guardians table
ALTER TABLE public.guardians 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;