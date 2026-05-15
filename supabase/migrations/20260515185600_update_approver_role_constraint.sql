-- Drop the existing constraint restricting approver_role values
ALTER TABLE public.approval_steps DROP CONSTRAINT IF EXISTS approval_steps_approver_role_check;

-- Re-create the constraint including 'tester'
ALTER TABLE public.approval_steps 
ADD CONSTRAINT approval_steps_approver_role_check 
CHECK (approver_role IN ('admin', 'pm', 'sr_dev', 'jr_dev', 'client', 'tester'));
