import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, User, Phone, MapPin, Building2, Briefcase, Save, Mail, ChevronRight, LogOut, Key, Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileNavigation from "@/components/MobileNavigation";
import KaryawanWorkspaceLayout from "@/components/layout/KaryawanWorkspaceLayout";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter"),
  phone: z.string().optional(),
  address: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  join_date: string | null;
}

const ProfilKaryawan = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", phone: "", address: "", department: "", position: "" },
  });

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();

    if (data) {
      setProfile(data);
      form.reset({
        full_name: data.full_name || "",
        phone: data.phone || "",
        address: data.address || "",
        department: data.department || "",
        position: data.position || "",
      });
    } else if (!error) {
      const { data: newProfile } = await supabase.from("profiles").insert({ user_id: user.id, full_name: user.user_metadata?.full_name || "" }).select().single();
      if (newProfile) {
        setProfile(newProfile);
        form.reset({ full_name: newProfile.full_name || "", phone: "", address: "", department: "", position: "" });
      }
    }
    setIsFetching(false);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsLoading(true);
    const { error } = await supabase.from("profiles").update({
      full_name: data.full_name,
      phone: data.phone || null,
      address: data.address || null,
      // Note: Typically Department/Position are managed by Admin, but editable here for now as requested or can be read-only.
      // We will make them read-only in UI for realism if they have values, or editable if empty.
    }).eq("user_id", user.id);

    if (error) toast({ variant: "destructive", title: "Gagal menyimpan", description: error.message });
    else toast({ title: "Profil berhasil disimpan", description: "Data profil Anda telah diperbarui." });
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logout berhasil", description: "Sampai jumpa kembali!" });
    navigate("/auth");
  };

  if (isFetching) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }

  // ==========================================
  // MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 pb-32">
        {/* Profile Header Background */}
        <div className="relative bg-[#0F172A] pt-[max(env(safe-area-inset-top),32px)] px-4 pb-16 rounded-b-[40px] shadow-lg overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Top Bar inside Header */}
          <div className="relative z-10 flex items-center justify-between mb-2">
            <span className="text-white text-xl font-bold tracking-tight px-2">Profil Saya</span>
          </div>
        </div>

        {/* Avatar Section - Perfectly Centered Overlap */}
        <div className="relative -mt-12 flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-[3px] border-white bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center overflow-hidden">
              {/* Placeholder Avatar */}
              <div className="w-full h-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-3xl font-bold text-slate-400">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
            </div>
            {/* Camera Icon Badge */}
            <div className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="text-center mt-3 px-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{profile?.full_name}</h2>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold border border-blue-100 uppercase tracking-wide">
              {profile?.position || "Karyawan"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 mt-6 space-y-5">

          {/* Personal Form */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
              <User className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Informasi Pribadi</h3>
            </div>
            <div className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs text-slate-500 dark:text-slate-400 font-medium">No. Telepon</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Input {...field} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:bg-slate-900 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 rounded-lg text-sm" placeholder="08..." />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs text-slate-500 dark:text-slate-400 font-medium">Alamat Domisili</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Textarea {...field} className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:bg-slate-900 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 rounded-lg text-sm min-h-[80px] resize-none py-2.5" placeholder="Masukan alamat lengkap..." />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg shadow-blue-600/20 h-11 font-semibold tracking-wide active:scale-[0.98] transition-all" disabled={isLoading}>
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        <span>Simpan Perubahan</span>
                      </div>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          {/* Employment Info (Read Only) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Pekerjaan</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Departemen</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.department || "-"}</p>
                    <Lock className="h-3 w-3 text-slate-300 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Posisi / Jabatan</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.position || "-"}</p>
                    <Lock className="h-3 w-3 text-slate-300 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Email Kantor</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.email}</p>
                    <Lock className="h-3 w-3 text-slate-300 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Actions */}
          <div className="space-y-3 pb-6">
            <button onClick={() => navigate("/edit-password")} className="w-full bg-white dark:bg-slate-900 active:bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0F172A] font-bold py-4 px-5 rounded-2xl flex items-center justify-between transition-all shadow-sm active:scale-[0.99] mb-3">
              <span className="flex items-center gap-3 text-sm">
                <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <Key className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                Ubah Kata Sandi
              </span>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>

            <button onClick={handleLogout} className="w-full bg-white dark:bg-slate-900 active:bg-red-50 border border-red-100 text-[#DC2626] font-bold py-4 px-5 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-[0.99]">
              <span className="flex items-center gap-2 text-sm">
                <LogOut className="h-5 w-5" />
                Keluar Akun
              </span>
            </button>
          </div>
        </div>

        <MobileNavigation />
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <KaryawanWorkspaceLayout>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Profil Saya</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">Kelola detail informasi pribadi dan pengaturan akun Anda.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full mx-auto pb-10">

        {/* Left: Identity Card */}
        <div className="md:col-span-1 h-fit bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl shadow-slate-200/40 overflow-hidden vibe-glass-card">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 h-28 relative flex justify-center">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>
            <div className="absolute -bottom-12">
              <div className="h-24 w-24 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 border-4 border-white shadow-lg relative">
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{profile?.full_name?.charAt(0) || "U"}</span>
                <div className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-16 pb-6 px-6 flex flex-col items-center text-center">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{profile?.full_name}</h2>
            <span className="inline-block mt-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100 uppercase tracking-wider">
              {profile?.position || "Karyawan"}
            </span>

            <div className="w-full border-t border-slate-200/50 dark:border-slate-700/50 my-6" />

            <div className="w-full space-y-4 text-left">
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Email Saat Ini</p>
                <p className="text-sm text-slate-800 dark:text-slate-100 font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{user?.email}</p>
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Bergabung Sejak</p>
                <p className="text-sm text-slate-800 dark:text-slate-100 font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-400" />
                  {profile?.join_date ? new Date(profile.join_date).toLocaleDateString("id-ID", { year: 'numeric', month: 'long', day: 'numeric' }) : "-"}
                </p>
              </div>
            </div>

            <div className="w-full mt-8 space-y-3">
              <Button variant="outline" className="w-full justify-between h-12 rounded-xl border-slate-200 dark:border-slate-700 shadow-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-800" onClick={() => navigate("/edit-password")}>
                Ubah Password <Key className="h-[18px] w-[18px] text-slate-400" />
              </Button>
              <Button variant="ghost" className="w-full justify-between h-12 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 font-bold" onClick={handleLogout}>
                Keluar Akun <LogOut className="h-[18px] w-[18px]" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Detailed Form */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl shadow-slate-200/40 p-1 vibe-glass-card">
          <div className="p-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Edit Informasi Profil</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Perbarui informasi kontak dan alamat lengkap Anda.</p>
          </div>
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-6">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100/50">
                    <User className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Data Utama</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Nama Lengkap</FormLabel>
                        <FormControl><Input {...field} className="h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-800 dark:text-slate-100 shadow-sm" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">No. Handphone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-3.5 h-[18px] w-[18px] text-slate-400" />
                            <Input {...field} placeholder="08..." className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-800 dark:text-slate-100 shadow-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Alamat Domisili</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-3.5 h-[18px] w-[18px] text-slate-400" />
                          <Textarea {...field} rows={3} placeholder="Masukkan alamat lengkap..." className="pl-10 pt-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-800 dark:text-slate-100 shadow-sm resize-none" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-5 bg-slate-50/80 border border-slate-100 dark:border-slate-800 rounded-xl space-y-6">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Jabatan Kerja</h3>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Departemen</FormLabel>
                      <FormControl><Input value={profile?.department || "Tidak Ada"} disabled className="h-12 bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 rounded-xl font-semibold shadow-inner" /></FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Posisi</FormLabel>
                      <FormControl><Input value={profile?.position || "Tidak Ada"} disabled className="h-12 bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 rounded-xl font-semibold shadow-inner" /></FormControl>
                    </FormItem>
                  </div>
                </div>

                <div className="flex justify-end pt-4 mt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                  <Button type="submit" disabled={isLoading} className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all gap-2">
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                        Menyimpan...
                      </div>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Simpan Perubahan
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </KaryawanWorkspaceLayout>
  );
};

export default ProfilKaryawan;
