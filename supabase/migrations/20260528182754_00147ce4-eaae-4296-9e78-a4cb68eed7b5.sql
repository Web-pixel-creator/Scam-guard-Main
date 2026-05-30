
DROP POLICY "Anyone can insert checks" ON public.checks;
CREATE POLICY "Anyone can insert checks"
  ON public.checks FOR INSERT TO anon, authenticated
  WITH CHECK (length(redacted_input) BETWEEN 1 AND 2000 AND array_length(reason_codes, 1) IS NULL OR array_length(reason_codes, 1) <= 30);
