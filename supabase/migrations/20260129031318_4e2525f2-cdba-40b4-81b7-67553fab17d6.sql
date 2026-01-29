-- Add approval workflow fields to student_reports table
ALTER TABLE public.student_reports 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for approval status queries
CREATE INDEX IF NOT EXISTS idx_student_reports_approval_status ON public.student_reports(approval_status);

-- Add comment for documentation
COMMENT ON COLUMN public.student_reports.approval_status IS 'Workflow status: pending (awaiting review), approved (visible to parents), rejected (needs revision)';
COMMENT ON COLUMN public.student_reports.approved_at IS 'Timestamp when the report was approved';
COMMENT ON COLUMN public.student_reports.approved_by IS 'User ID who approved the report';
COMMENT ON COLUMN public.student_reports.rejection_reason IS 'Reason for rejection, if applicable';