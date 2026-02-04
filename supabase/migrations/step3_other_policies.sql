-- ================================================
-- STEP 3: RUN THIS THIRD - Create other policies
-- ================================================

CREATE POLICY "allow_insert" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    (user_id = auth.uid())
    OR
    (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager')))
);

CREATE POLICY "allow_delete" ON public.work_journals
FOR DELETE TO authenticated
USING (
    (user_id = auth.uid())
    OR
    (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
);

GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
