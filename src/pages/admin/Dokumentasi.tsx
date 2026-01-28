import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, Database, Shield, Server, Layout, Code, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const Dokumentasi = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      const addNewPage = () => {
        pdf.addPage();
        yPosition = margin;
      };

      const checkPageBreak = (neededSpace: number) => {
        if (yPosition + neededSpace > pageHeight - margin) {
          addNewPage();
        }
      };

      const addTitle = (text: string, size: number = 16) => {
        checkPageBreak(15);
        pdf.setFontSize(size);
        pdf.setFont("helvetica", "bold");
        pdf.text(text, margin, yPosition);
        yPosition += size * 0.5 + 3;
      };

      const addSubtitle = (text: string) => {
        checkPageBreak(12);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(text, margin, yPosition);
        yPosition += 8;
      };

      const addParagraph = (text: string) => {
        checkPageBreak(10);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(text, contentWidth);
        pdf.text(lines, margin, yPosition);
        yPosition += lines.length * 5 + 3;
      };

      const addCode = (code: string) => {
        checkPageBreak(15);
        pdf.setFontSize(8);
        pdf.setFont("courier", "normal");
        const lines = pdf.splitTextToSize(code, contentWidth - 10);
        
        // Background
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPosition - 3, contentWidth, lines.length * 4 + 6, "F");
        
        pdf.text(lines, margin + 5, yPosition + 2);
        yPosition += lines.length * 4 + 10;
      };

      const addBullet = (text: string) => {
        checkPageBreak(8);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(text, contentWidth - 10);
        pdf.text("•", margin, yPosition);
        pdf.text(lines, margin + 5, yPosition);
        yPosition += lines.length * 5 + 2;
      };

      const addSpacer = (height: number = 5) => {
        yPosition += height;
      };

      // ========== COVER PAGE ==========
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 80, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("DOKUMENTASI FULLSTACK", margin, 40);
      pdf.setFontSize(16);
      pdf.text("Sistem Absensi & Manajemen Karyawan", margin, 52);
      pdf.setFontSize(10);
      pdf.text("Talenta Digital Indonesia", margin, 65);
      
      pdf.setTextColor(0, 0, 0);
      yPosition = 100;
      
      addParagraph("Dokumen ini berisi penjelasan lengkap tentang arsitektur, teknologi, dan implementasi sistem absensi berbasis web yang dibangun menggunakan React, TypeScript, dan Supabase.");
      addSpacer(10);
      
      addSubtitle("Informasi Dokumen");
      addBullet("Versi: 1.0");
      addBullet("Tanggal: " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));
      addBullet("Platform: Web Application (React + Supabase)");
      addBullet("Target: Developer & Administrator");

      // ========== DAFTAR ISI ==========
      addNewPage();
      addTitle("DAFTAR ISI", 20);
      addSpacer(10);
      
      const tocItems = [
        "1. Gambaran Umum Sistem",
        "2. Teknologi yang Digunakan",
        "3. Struktur Folder Project",
        "4. Sistem Routing (App.tsx)",
        "5. Sistem Autentikasi",
        "6. Integrasi Database",
        "7. Struktur Tabel Database",
        "8. Row Level Security (RLS)",
        "9. Edge Functions (Backend)",
        "10. Komponen UI",
        "11. State Management",
        "12. Panduan Pengembangan",
      ];
      
      tocItems.forEach(item => {
        addBullet(item);
      });

      // ========== SECTION 1: GAMBARAN UMUM ==========
      addNewPage();
      addTitle("1. GAMBARAN UMUM SISTEM", 18);
      addSpacer(5);
      
      addParagraph("Sistem Absensi & Manajemen Karyawan adalah aplikasi web fullstack yang dirancang untuk mengelola kehadiran, cuti, dan data karyawan dalam suatu organisasi.");
      addSpacer(3);
      
      addSubtitle("1.1 Fitur Utama");
      addBullet("Absensi harian dengan pencatatan waktu clock-in dan clock-out");
      addBullet("Pengajuan dan persetujuan cuti");
      addBullet("Dashboard analitik untuk admin dan manager");
      addBullet("Manajemen data karyawan");
      addBullet("Laporan kehadiran (harian, mingguan, bulanan)");
      addBullet("Sistem role-based access control (RBAC)");
      addSpacer(5);
      
      addSubtitle("1.2 Jenis Pengguna (Role)");
      addBullet("Admin: Akses penuh ke semua fitur sistem, kelola karyawan, laporan, pengaturan");
      addBullet("Manager: Lihat laporan tim, kelola persetujuan cuti, monitoring kehadiran");
      addBullet("Karyawan: Absensi harian, pengajuan cuti, lihat riwayat pribadi");

      // ========== SECTION 2: TEKNOLOGI ==========
      addNewPage();
      addTitle("2. TEKNOLOGI YANG DIGUNAKAN", 18);
      addSpacer(5);
      
      addSubtitle("2.1 Frontend");
      addBullet("React 18 - Library JavaScript untuk membangun user interface");
      addBullet("TypeScript - Superset JavaScript dengan static typing");
      addBullet("Vite - Build tool modern yang cepat untuk development");
      addBullet("Tailwind CSS - Utility-first CSS framework");
      addBullet("shadcn/ui - Komponen UI yang dapat dikustomisasi");
      addBullet("React Router - Client-side routing");
      addBullet("React Query (TanStack) - Server state management");
      addBullet("Recharts - Library untuk visualisasi data (grafik)");
      addSpacer(5);
      
      addSubtitle("2.2 Backend (Supabase/Lovable Cloud)");
      addBullet("PostgreSQL - Database relasional");
      addBullet("Supabase Auth - Sistem autentikasi");
      addBullet("Row Level Security (RLS) - Keamanan data di level database");
      addBullet("Edge Functions - Serverless functions untuk logika backend");
      addBullet("Realtime - Websocket untuk update data real-time");
      addSpacer(5);
      
      addSubtitle("2.3 Library Pendukung");
      addBullet("date-fns - Manipulasi tanggal dan waktu");
      addBullet("jsPDF - Generate dokumen PDF");
      addBullet("Zod - Validasi schema data");
      addBullet("React Hook Form - Pengelolaan form");
      addBullet("Lucide React - Library icon");

      // ========== SECTION 3: STRUKTUR FOLDER ==========
      addNewPage();
      addTitle("3. STRUKTUR FOLDER PROJECT", 18);
      addSpacer(5);
      
      addCode(`project-root/
├── src/                      # Source code utama
│   ├── assets/              # File statis (gambar, logo)
│   ├── components/          # Komponen React
│   │   └── ui/             # Komponen shadcn/ui
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.tsx     # Hook autentikasi
│   │   └── useSystemSettings.tsx
│   ├── integrations/       # Integrasi eksternal
│   │   └── supabase/       # Supabase client & types
│   ├── lib/                # Utility functions
│   ├── pages/              # Halaman aplikasi
│   │   ├── admin/          # Halaman admin
│   │   ├── karyawan/       # Halaman karyawan
│   │   └── manager/        # Halaman manager
│   ├── App.tsx             # Konfigurasi routing
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── supabase/
│   ├── functions/          # Edge Functions
│   └── config.toml         # Konfigurasi Supabase
└── public/                 # File publik`);

      addSpacer(5);
      addSubtitle("3.1 Penjelasan Folder");
      addBullet("src/components/ui/ - Berisi komponen UI dari shadcn seperti Button, Card, Dialog, dll");
      addBullet("src/hooks/ - Custom hooks untuk logic yang bisa dipakai ulang");
      addBullet("src/pages/ - Setiap file adalah satu halaman dalam aplikasi");
      addBullet("supabase/functions/ - Berisi kode backend serverless");

      // ========== SECTION 4: ROUTING ==========
      addNewPage();
      addTitle("4. SISTEM ROUTING (App.tsx)", 18);
      addSpacer(5);
      
      addParagraph("File App.tsx adalah pusat konfigurasi routing yang menentukan halaman mana yang ditampilkan berdasarkan URL dan hak akses pengguna.");
      addSpacer(3);
      
      addSubtitle("4.1 Struktur Provider");
      addCode(`<QueryClientProvider>     // Layer 1: Data caching
  <TooltipProvider>       // Layer 2: Tooltips
    <AuthProvider>        // Layer 3: Autentikasi
      <BrowserRouter>     // Layer 4: Routing
        <Routes>          // Definisi routes
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </TooltipProvider>
</QueryClientProvider>`);

      addSpacer(5);
      addSubtitle("4.2 Jenis Route");
      addBullet("Route Publik: / (Landing), /auth (Login) - Bisa diakses tanpa login");
      addBullet("ProtectedRoute: /dashboard, /karyawan/* - Butuh login (semua role)");
      addBullet("ManagerRoute: /manager/* - Khusus role manager");
      addBullet("AdminRoute: /admin/* - Khusus role admin");
      addSpacer(3);
      
      addSubtitle("4.3 Contoh Kode Route");
      addCode(`// Route publik
<Route path="/" element={<LandingPage />} />

// Route yang butuh login
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Index />
  </ProtectedRoute>
} />

// Route khusus admin
<Route path="/admin/karyawan" element={
  <AdminRoute>
    <KelolaKaryawan />
  </AdminRoute>
} />`);

      // ========== SECTION 5: AUTENTIKASI ==========
      addNewPage();
      addTitle("5. SISTEM AUTENTIKASI", 18);
      addSpacer(5);
      
      addParagraph("Sistem autentikasi menggunakan Supabase Auth dengan implementasi di file src/hooks/useAuth.tsx. Hook ini menyediakan context untuk seluruh aplikasi.");
      addSpacer(3);
      
      addSubtitle("5.1 AuthContext Interface");
      addCode(`interface AuthContextType {
  user: User | null;        // Data user dari Supabase
  session: Session | null;  // Token sesi
  loading: boolean;         // Status loading
  role: AppRole | null;     // "admin" | "manager" | "karyawan"
  isAdmin: boolean;         // Helper cek admin
  isManager: boolean;       // Helper cek manager
  signOut: () => Promise<void>;  // Fungsi logout
}`);

      addSpacer(5);
      addSubtitle("5.2 Alur Autentikasi");
      addBullet("1. User memasukkan email dan password di halaman /auth");
      addBullet("2. Frontend memanggil supabase.auth.signInWithPassword()");
      addBullet("3. Supabase memvalidasi kredensial dan mengembalikan session");
      addBullet("4. onAuthStateChange listener mendeteksi perubahan status");
      addBullet("5. Aplikasi mengambil role user dari tabel user_roles");
      addBullet("6. User diarahkan ke dashboard sesuai role");
      addSpacer(3);
      
      addSubtitle("5.3 Cara Menggunakan useAuth");
      addCode(`import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, isAdmin, signOut } = useAuth();
  
  if (isAdmin) {
    return <AdminPanel />;
  }
  
  return <UserPanel user={user} />;
}`);

      // ========== SECTION 6: INTEGRASI DATABASE ==========
      addNewPage();
      addTitle("6. INTEGRASI DATABASE", 18);
      addSpacer(5);
      
      addParagraph("Koneksi ke database dilakukan melalui Supabase client yang dikonfigurasi di src/integrations/supabase/client.ts.");
      addSpacer(3);
      
      addSubtitle("6.1 Konfigurasi Client");
      addCode(`import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,      // Simpan token di localStorage
    persistSession: true,       // Session tetap setelah refresh
    autoRefreshToken: true,     // Auto refresh token
  }
});`);

      addSpacer(5);
      addSubtitle("6.2 Operasi Database (CRUD)");
      addCode(`// SELECT - Ambil data
const { data } = await supabase
  .from("profiles")
  .select("full_name, department")
  .eq("user_id", userId);

// INSERT - Tambah data
await supabase.from("attendance").insert({
  user_id: userId,
  clock_in: new Date().toISOString(),
  status: "present"
});

// UPDATE - Ubah data
await supabase.from("profiles")
  .update({ phone: "08123456789" })
  .eq("user_id", userId);

// DELETE - Hapus data
await supabase.from("leave_requests")
  .delete()
  .eq("id", requestId);`);

      addSpacer(5);
      addSubtitle("6.3 Realtime Subscription");
      addCode(`// Dengarkan perubahan data secara real-time
const channel = supabase
  .channel("attendance-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "attendance" },
    (payload) => {
      console.log("Data berubah:", payload);
      // Refresh data
    }
  )
  .subscribe();`);

      // ========== SECTION 7: TABEL DATABASE ==========
      addNewPage();
      addTitle("7. STRUKTUR TABEL DATABASE", 18);
      addSpacer(5);
      
      addSubtitle("7.1 Tabel: profiles");
      addParagraph("Menyimpan data profil karyawan.");
      addCode(`Kolom:
- id (uuid, PRIMARY KEY)
- user_id (uuid, FOREIGN KEY ke auth.users)
- full_name (text) - Nama lengkap
- department (text) - Departemen
- position (text) - Jabatan
- phone (text) - Nomor telepon
- address (text) - Alamat
- join_date (date) - Tanggal bergabung
- avatar_url (text) - URL foto profil
- created_at, updated_at (timestamp)`);

      addSpacer(5);
      addSubtitle("7.2 Tabel: attendance");
      addParagraph("Mencatat data kehadiran/absensi.");
      addCode(`Kolom:
- id (uuid, PRIMARY KEY)
- user_id (uuid)
- clock_in (timestamp) - Waktu masuk
- clock_out (timestamp) - Waktu keluar
- clock_in_location (text) - Lokasi clock in
- clock_out_location (text) - Lokasi clock out
- status (text) - "present" | "late" | "early_leave"
- notes (text) - Catatan
- created_at, updated_at (timestamp)`);

      addSpacer(5);
      addSubtitle("7.3 Tabel: leave_requests");
      addParagraph("Menyimpan pengajuan cuti.");
      addCode(`Kolom:
- id (uuid, PRIMARY KEY)
- user_id (uuid)
- start_date (date) - Tanggal mulai
- end_date (date) - Tanggal selesai
- leave_type (text) - Jenis cuti
- reason (text) - Alasan
- status (text) - "pending" | "approved" | "rejected"
- approved_by (uuid) - Yang menyetujui
- approved_at (timestamp)
- rejection_reason (text)`);

      addSpacer(5);
      addSubtitle("7.4 Tabel: user_roles");
      addParagraph("Menyimpan role pengguna (TERPISAH dari profiles untuk keamanan).");
      addCode(`Kolom:
- id (uuid, PRIMARY KEY)
- user_id (uuid)
- role (enum: "admin" | "manager" | "karyawan")
- created_at (timestamp)`);

      // ========== SECTION 8: RLS ==========
      addNewPage();
      addTitle("8. ROW LEVEL SECURITY (RLS)", 18);
      addSpacer(5);
      
      addParagraph("RLS adalah fitur PostgreSQL yang mengontrol akses data di level baris. Setiap tabel memiliki policy yang menentukan siapa yang bisa SELECT, INSERT, UPDATE, atau DELETE.");
      addSpacer(3);
      
      addSubtitle("8.1 Fungsi Helper: has_role");
      addCode(`CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;`);

      addSpacer(5);
      addSubtitle("8.2 Contoh RLS Policy");
      addCode(`-- Users hanya bisa lihat data sendiri
CREATE POLICY "Users can view their own data"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Admin bisa lihat semua data
CREATE POLICY "Admins can view all"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Manager bisa lihat semua data
CREATE POLICY "Managers can view all"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'manager'));`);

      addSpacer(5);
      addSubtitle("8.3 Prinsip Keamanan");
      addBullet("SELALU aktifkan RLS pada semua tabel: ALTER TABLE x ENABLE ROW LEVEL SECURITY");
      addBullet("Role TIDAK BOLEH disimpan di tabel profiles (risiko privilege escalation)");
      addBullet("Gunakan SECURITY DEFINER untuk fungsi yang mengakses data sensitif");
      addBullet("Gunakan auth.uid() untuk mendapatkan ID user yang sedang login");

      // ========== SECTION 9: EDGE FUNCTIONS ==========
      addNewPage();
      addTitle("9. EDGE FUNCTIONS (BACKEND)", 18);
      addSpacer(5);
      
      addParagraph("Edge Functions adalah serverless functions yang berjalan di server Supabase. Digunakan untuk logika yang membutuhkan akses lebih tinggi atau integrasi dengan API eksternal.");
      addSpacer(3);
      
      addSubtitle("9.1 Lokasi File");
      addCode(`supabase/
├── functions/
│   ├── create-employee/
│   │   └── index.ts      # Buat akun karyawan baru
│   ├── list-employees/
│   │   └── index.ts      # List semua karyawan
│   └── reset-password/
│       └── index.ts      # Reset password karyawan
└── config.toml           # Konfigurasi functions`);

      addSpacer(5);
      addSubtitle("9.2 Struktur Dasar Edge Function");
      addCode(`import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Buat Supabase client dengan service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Logika bisnis...
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});`);

      addSpacer(5);
      addSubtitle("9.3 Cara Memanggil Edge Function");
      addCode(`// Dari frontend
const { data, error } = await supabase.functions.invoke(
  'create-employee',
  {
    body: {
      email: "user@example.com",
      password: "password123",
      full_name: "John Doe",
      role: "karyawan"
    }
  }
);`);

      // ========== SECTION 10: KOMPONEN UI ==========
      addNewPage();
      addTitle("10. KOMPONEN UI (shadcn/ui)", 18);
      addSpacer(5);
      
      addParagraph("Aplikasi menggunakan shadcn/ui sebagai library komponen dasar. Komponen-komponen ini tersedia di folder src/components/ui/.");
      addSpacer(3);
      
      addSubtitle("10.1 Komponen yang Sering Digunakan");
      addBullet("Button - Tombol dengan berbagai variant (default, destructive, outline, ghost)");
      addBullet("Card - Container untuk menampilkan konten dalam kotak");
      addBullet("Dialog - Modal popup untuk konfirmasi atau form");
      addBullet("Table - Tabel data dengan header dan body");
      addBullet("Form - Wrapper untuk form dengan validasi");
      addBullet("Input - Field input text");
      addBullet("Select - Dropdown pilihan");
      addBullet("Badge - Label kecil untuk status");
      addBullet("Tabs - Tab navigation");
      addBullet("Toast - Notifikasi popup");
      addSpacer(5);
      
      addSubtitle("10.2 Contoh Penggunaan");
      addCode(`import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Judul Card</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="success">Aktif</Badge>
        <Button onClick={handleClick}>Klik Saya</Button>
      </CardContent>
    </Card>
  );
}`);

      // ========== SECTION 11: STATE MANAGEMENT ==========
      addNewPage();
      addTitle("11. STATE MANAGEMENT", 18);
      addSpacer(5);
      
      addSubtitle("11.1 React Query (TanStack Query)");
      addParagraph("Digunakan untuk mengelola server state (data dari database). Menyediakan caching, refetching, dan loading states secara otomatis.");
      addCode(`import { useQuery, useMutation } from "@tanstack/react-query";

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['employees'],
  queryFn: async () => {
    const { data } = await supabase.from('profiles').select('*');
    return data;
  }
});

// Mutasi data
const mutation = useMutation({
  mutationFn: async (newEmployee) => {
    await supabase.from('profiles').insert(newEmployee);
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['employees']);
  }
});`);

      addSpacer(5);
      addSubtitle("11.2 React useState & useEffect");
      addParagraph("Untuk local state dan side effects dalam komponen.");
      addCode(`const [count, setCount] = useState(0);
const [data, setData] = useState([]);

useEffect(() => {
  // Dipanggil saat komponen dimount atau dependency berubah
  fetchData();
}, [userId]); // Dependency array`);

      addSpacer(5);
      addSubtitle("11.3 Context API");
      addParagraph("Untuk global state yang perlu diakses banyak komponen (contoh: AuthContext).");
      addCode(`// Membuat context
const MyContext = createContext(defaultValue);

// Provider
<MyContext.Provider value={value}>
  {children}
</MyContext.Provider>

// Menggunakan context
const value = useContext(MyContext);`);

      // ========== SECTION 12: PANDUAN PENGEMBANGAN ==========
      addNewPage();
      addTitle("12. PANDUAN PENGEMBANGAN", 18);
      addSpacer(5);
      
      addSubtitle("12.1 Menambah Halaman Baru");
      addBullet("1. Buat file di src/pages/ (contoh: src/pages/admin/NewPage.tsx)");
      addBullet("2. Tambahkan route di App.tsx dengan guard yang sesuai");
      addBullet("3. Tambahkan link navigasi di halaman terkait");
      addSpacer(5);
      
      addSubtitle("12.2 Menambah Tabel Database");
      addBullet("1. Buat migrasi SQL dengan CREATE TABLE");
      addBullet("2. Aktifkan RLS: ALTER TABLE x ENABLE ROW LEVEL SECURITY");
      addBullet("3. Buat policy untuk setiap operasi (SELECT, INSERT, UPDATE, DELETE)");
      addBullet("4. Update types.ts akan otomatis ter-generate");
      addSpacer(5);
      
      addSubtitle("12.3 Best Practices");
      addBullet("Selalu gunakan TypeScript untuk type safety");
      addBullet("Pisahkan logika ke dalam custom hooks yang reusable");
      addBullet("Gunakan komponen kecil dan fokus (single responsibility)");
      addBullet("Selalu handle error dan loading states");
      addBullet("Gunakan semantic color tokens dari design system (bg-primary, text-foreground)");
      addBullet("Jangan hardcode warna langsung (text-white, bg-black)");
      addBullet("Test RLS policies sebelum deploy ke production");
      addSpacer(5);
      
      addSubtitle("12.4 Debugging Tips");
      addBullet("Cek Console browser untuk error JavaScript");
      addBullet("Cek Network tab untuk error API");
      addBullet("Gunakan console.log untuk tracing alur program");
      addBullet("Cek Edge Function logs di Supabase dashboard");

      // ========== FOOTER ==========
      addNewPage();
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, pageHeight - 60, pageWidth, 60, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text("Terima Kasih", margin, pageHeight - 40);
      pdf.setFontSize(10);
      pdf.text("Dokumen ini dibuat untuk membantu pemahaman arsitektur sistem.", margin, pageHeight - 30);
      pdf.text("Untuk pertanyaan lebih lanjut, silakan hubungi tim development.", margin, pageHeight - 22);

      // Save PDF
      pdf.save("Dokumentasi_Fullstack_Sistem_Absensi.pdf");
      
      toast({
        title: "PDF Berhasil Dibuat",
        description: "Dokumentasi telah diunduh ke perangkat Anda",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Gagal Membuat PDF",
        description: "Terjadi kesalahan saat membuat dokumentasi",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">Dokumentasi Sistem</h1>
                <p className="text-sm text-muted-foreground">Penjelasan arsitektur fullstack</p>
              </div>
            </div>
            <Button onClick={generatePDF} disabled={isGenerating}>
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? "Membuat PDF..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Quick Overview Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <Layout className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-semibold">React</p>
              <p className="text-xs text-muted-foreground">Frontend</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Code className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="font-semibold">TypeScript</p>
              <p className="text-xs text-muted-foreground">Language</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Database className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="font-semibold">PostgreSQL</p>
              <p className="text-xs text-muted-foreground">Database</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Shield className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <p className="font-semibold">RLS</p>
              <p className="text-xs text-muted-foreground">Security</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Server className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <p className="font-semibold">Edge Fn</p>
              <p className="text-xs text-muted-foreground">Backend</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Layers className="h-8 w-8 mx-auto text-pink-500 mb-2" />
              <p className="font-semibold">shadcn</p>
              <p className="text-xs text-muted-foreground">UI Library</p>
            </CardContent>
          </Card>
        </div>

        {/* Documentation Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="frontend">Frontend</TabsTrigger>
            <TabsTrigger value="backend">Backend</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gambaran Umum Sistem
                </CardTitle>
                <CardDescription>Arsitektur dan teknologi yang digunakan</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Apa itu Sistem Absensi ini?</h3>
                      <p className="text-sm text-muted-foreground">
                        Sistem berbasis web untuk mengelola kehadiran, cuti, dan data karyawan dengan 
                        3 jenis role: Admin, Manager, dan Karyawan.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Fitur Utama</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Absensi harian dengan clock-in/out</li>
                        <li>• Pengajuan dan persetujuan cuti</li>
                        <li>• Dashboard analitik</li>
                        <li>• Manajemen data karyawan</li>
                        <li>• Laporan kehadiran</li>
                        <li>• Role-based access control</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Struktur Folder</h3>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`src/
├── components/  # Komponen UI
├── hooks/       # Custom hooks
├── pages/       # Halaman
├── lib/         # Utilities
└── integrations/# Supabase client`}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="frontend">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Frontend Architecture
                </CardTitle>
                <CardDescription>React, TypeScript, dan Tailwind CSS</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Routing (App.tsx)</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        File App.tsx mendefinisikan semua route dan guard untuk proteksi akses.
                      </p>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Route publik
<Route path="/" element={<LandingPage />} />

// Route terproteksi
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Index />
  </ProtectedRoute>
} />`}
                      </pre>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Autentikasi (useAuth)</h3>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`const { user, isAdmin, signOut } = useAuth();

if (isAdmin) {
  // Tampilkan menu admin
}`}
                      </pre>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Komponen UI</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge>Button</Badge>
                        <Badge>Card</Badge>
                        <Badge>Dialog</Badge>
                        <Badge>Table</Badge>
                        <Badge>Form</Badge>
                        <Badge>Input</Badge>
                        <Badge>Select</Badge>
                        <Badge>Toast</Badge>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backend">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Backend (Edge Functions)
                </CardTitle>
                <CardDescription>Serverless functions di Supabase</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Edge Functions Tersedia</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code className="bg-muted px-1 rounded">create-employee</code> - Buat akun karyawan baru</li>
                        <li>• <code className="bg-muted px-1 rounded">list-employees</code> - List semua karyawan</li>
                        <li>• <code className="bg-muted px-1 rounded">reset-password</code> - Reset password</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Cara Memanggil</h3>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`const { data, error } = await supabase
  .functions.invoke('create-employee', {
    body: { email, password, full_name }
  });`}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Schema
                </CardTitle>
                <CardDescription>Struktur tabel dan RLS policies</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Tabel Utama</h3>
                      <div className="space-y-2">
                        <div className="p-2 border rounded">
                          <p className="font-medium">profiles</p>
                          <p className="text-xs text-muted-foreground">Data profil karyawan</p>
                        </div>
                        <div className="p-2 border rounded">
                          <p className="font-medium">attendance</p>
                          <p className="text-xs text-muted-foreground">Catatan kehadiran</p>
                        </div>
                        <div className="p-2 border rounded">
                          <p className="font-medium">leave_requests</p>
                          <p className="text-xs text-muted-foreground">Pengajuan cuti</p>
                        </div>
                        <div className="p-2 border rounded">
                          <p className="font-medium">user_roles</p>
                          <p className="text-xs text-muted-foreground">Role pengguna (admin/manager/karyawan)</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Contoh Query</h3>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Ambil data
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', userId);

// Insert data
await supabase.from('attendance').insert({
  user_id: userId,
  clock_in: new Date().toISOString()
});`}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dokumentasi;
