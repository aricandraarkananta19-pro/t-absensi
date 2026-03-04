-- 1. Menambahkan kolom period_month jika belum ada
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS period_month VARCHAR(7);

-- 2. Memperbarui record yang sudah ada (mengisi period_month berdasarkan clock_in)
UPDATE public.attendance
SET period_month = TO_CHAR(clock_in, 'YYYY-MM')
WHERE period_month IS NULL AND clock_in IS NOT NULL;

-- 3. Membuat fungsi trigger agar period_month terisi otomatis setiap ada INSERT atau UPDATE
CREATE OR REPLACE FUNCTION set_attendance_period_month()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_in IS NOT NULL THEN
    NEW.period_month := TO_CHAR(NEW.clock_in, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Memasang trigger pada tabel attendance
DROP TRIGGER IF EXISTS trg_set_attendance_period_month ON public.attendance;
CREATE TRIGGER trg_set_attendance_period_month
BEFORE INSERT OR UPDATE OF clock_in ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION set_attendance_period_month();

-- 5. Membuat indeks untuk mempercepat pencarian query berdasarkan period_month
CREATE INDEX IF NOT EXISTS idx_attendance_period_month ON public.attendance(period_month);
