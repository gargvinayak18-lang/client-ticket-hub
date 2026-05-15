-- Add 'enhancement' to the ticket_type enum for Enhancement / New Feature categorization.
ALTER TYPE public.ticket_type ADD VALUE IF NOT EXISTS 'enhancement';
