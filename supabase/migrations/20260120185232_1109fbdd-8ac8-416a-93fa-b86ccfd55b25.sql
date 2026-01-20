-- Drop the existing check constraint on payments status
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add new constraint that includes RECEIVED_IN_CASH status
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
CHECK (status IN ('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS', 'DELETED'));