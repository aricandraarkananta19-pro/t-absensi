-- ================================================
-- STEP 2: RUN THIS SECOND - Create SELECT policy
-- ================================================
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select" ON public.work_journals
FOR SELECT TO authenticated
USING (
    (user_id = auth.uid())
    OR
    (verification_status IS DISTINCT FROM 'draft' AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
    OR
    (verification_status IS DISTINCT FROM 'draft' AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'manager'))
);
