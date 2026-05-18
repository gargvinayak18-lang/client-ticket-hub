-- Drop the existing constraint restricting assigned_role values on approval_flows
ALTER TABLE public.approval_flows DROP CONSTRAINT IF EXISTS approval_flows_assigned_role_check;

-- Re-create the constraint including 'pm' and 'admin'
ALTER TABLE public.approval_flows 
ADD CONSTRAINT approval_flows_assigned_role_check 
CHECK (assigned_role IN ('jr_dev', 'sr_dev', 'pm', 'admin'));
