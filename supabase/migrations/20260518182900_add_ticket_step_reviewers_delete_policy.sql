-- Enable DELETE permission for authenticated staff on ticket_step_reviewers
CREATE POLICY "Staff can delete ticket_step_reviewers" 
ON public.ticket_step_reviewers 
FOR DELETE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pm') OR 
  public.has_role(auth.uid(), 'sr_dev') OR 
  public.has_role(auth.uid(), 'jr_dev')
);
