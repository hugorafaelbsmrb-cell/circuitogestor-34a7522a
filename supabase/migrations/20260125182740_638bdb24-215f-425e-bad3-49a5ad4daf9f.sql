-- Add payment_status column to canteen_weekly_summaries
ALTER TABLE public.canteen_weekly_summaries 
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

-- Add constraint for valid payment statuses
ALTER TABLE public.canteen_weekly_summaries 
ADD CONSTRAINT canteen_weekly_summaries_payment_status_check 
CHECK (payment_status IN ('pending', 'paid'));

-- Add index for payment status filtering
CREATE INDEX IF NOT EXISTS idx_canteen_weekly_summaries_payment_status 
ON public.canteen_weekly_summaries(payment_status);