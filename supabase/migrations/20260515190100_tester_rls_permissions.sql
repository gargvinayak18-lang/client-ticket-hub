-- Enable SELECT access for testers on core tables
CREATE POLICY "Testers view all tickets" ON public.tickets 
FOR SELECT USING (public.has_role(auth.uid(), 'tester'));

CREATE POLICY "Testers view all profiles" ON public.profiles 
FOR SELECT USING (public.has_role(auth.uid(), 'tester'));

CREATE POLICY "Testers view all websites" ON public.websites 
FOR SELECT USING (public.has_role(auth.uid(), 'tester'));

CREATE POLICY "Testers view all user_roles" ON public.user_roles 
FOR SELECT USING (public.has_role(auth.uid(), 'tester'));

-- Enable UPDATE access for testers on tickets (needed for advancing workflows)
CREATE POLICY "Testers update all tickets" ON public.tickets 
FOR UPDATE USING (public.has_role(auth.uid(), 'tester'));

-- Additional SELECT/INSERT access for workflow/comments tables (in case RLS is enabled)
DO $$ 
BEGIN
    -- approval_flows
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'approval_flows') THEN
        EXECUTE 'CREATE POLICY "Testers view all approval_flows" ON public.approval_flows FOR SELECT USING (public.has_role(auth.uid(), ''tester''))';
    END IF;

    -- approval_steps
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'approval_steps') THEN
        EXECUTE 'CREATE POLICY "Testers view all approval_steps" ON public.approval_steps FOR SELECT USING (public.has_role(auth.uid(), ''tester''))';
    END IF;

    -- ticket_step_reviewers
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ticket_step_reviewers') THEN
        EXECUTE 'CREATE POLICY "Testers view all ticket_step_reviewers" ON public.ticket_step_reviewers FOR SELECT USING (public.has_role(auth.uid(), ''tester''))';
        EXECUTE 'CREATE POLICY "Testers insert ticket_step_reviewers" ON public.ticket_step_reviewers FOR INSERT WITH CHECK (public.has_role(auth.uid(), ''tester''))';
    END IF;

    -- ticket_comments
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ticket_comments') THEN
        EXECUTE 'CREATE POLICY "Testers view all ticket_comments" ON public.ticket_comments FOR SELECT USING (public.has_role(auth.uid(), ''tester''))';
        EXECUTE 'CREATE POLICY "Testers insert ticket_comments" ON public.ticket_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), ''tester''))';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- In case policies already exist, do not fail
END $$;
