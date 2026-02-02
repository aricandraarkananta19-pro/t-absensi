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
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }

  // ==========================================
  // MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 pb-32">
        {/* Profile Header Background */}
        <div className="relative bg-gradient-to-br from-blue-700 to-indigo-800 h-40 rounded-b-[2rem] shadow-md overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>

          {/* Top Bar inside Header */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+8px)]">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-white hover:bg-white/20 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-white font-semibold tracking-wide">Profil Saya</span>
            <Button variant="ghost" size="icon" className="group rounded-full" onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-white/90 group-active:text-white" />
            </Button>
          </div>
        </div>

        {/* Avatar Section - Perfectly Centered Overlap */}
        <div className="relative -mt-12 flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-[3px] border-white bg-white shadow-lg flex items-center justify-center overflow-hidden">
              {/* Placeholder Avatar */}
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
            </div>
            {/* Camera Icon Badge */}
            <div className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="text-center mt-3 px-6">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{profile?.full_name}</h2>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold border border-blue-100 uppercase tracking-wide">
              {profile?.position || "Karyawan"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 mt-6 space-y-5">

          {/* Personal Form */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
              <User className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Informasi Pribadi</h3>
            </div>
            <div className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs text-slate-500 font-medium">No. Telepon</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Input {...field} className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 rounded-lg text-sm" placeholder="08..." />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs text-slate-500 font-medium">Alamat Domisili</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Textarea {...field} className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 rounded-lg text-sm min-h-[80px] resize-none py-2.5" placeholder="Masukan alamat lengkap..." />
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Pekerjaan</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Departemen</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 truncate">{profile?.department || "-"}</p>
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
                    <p className="text-sm font-semibold text-slate-800 truncate">{profile?.position || "-"}</p>
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
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                    <Lock className="h-3 w-3 text-slate-300 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Actions */}
          <div className="space-y-3 pb-6">
            <button onClick={() => navigate("/edit-password")} className="w-full bg-white active:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl flex items-center justify-between transition-all shadow-sm active:scale-[0.99]">
              <span className="flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center">
                  <Key className="h-4 w-4 text-purple-600" />
                </div>
                Ubah Password
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          </div>
        </div>

        <MobileNavigation />
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold text-slate-800">Profil Saya</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">

          {/* Left: Identity Card */}
          <Card className="md:col-span-1 shadow-sm border-slate-200 h-fit">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border-4 border-white shadow-sm">
                <span className="text-2xl font-bold">{profile?.full_name?.charAt(0)}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">{profile?.full_name}</h2>
              <p className="text-sm text-slate-500 mb-4">{profile?.position || "Karyawan"}</p>

              <div className="w-full border-t border-slate-100 my-4" />

              <div className="w-full space-y-3 text-left">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Email</p>
                  <p className="text-sm text-slate-700 font-medium">{user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Bergabung Sejak</p>
                  <p className="text-sm text-slate-700 font-medium">
                    {profile?.join_date ? new Date(profile.join_date).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              <div className="w-full mt-6 space-y-2">
                <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/edit-password")}>
                  Ubah Password <Key className="h-4 w-4 text-slate-400" />
                </Button>
                <Button variant="outline" className="w-full justify-between text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={handleLogout}>
                  Logout <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right: Detailed Form */}
          <Card className="md:col-span-2 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Edit Informasi Profile</CardTitle>
              <CardDescription>Perbarui informasi kontak dan alamat Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl><Input {...field} placeholder="08..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormItem>
                      <FormLabel className="text-slate-500">Departemen (Locked)</FormLabel>
                      <FormControl><Input value={profile?.department || ""} disabled className="bg-slate-50 text-slate-500" /></FormControl>
                    </FormItem>
                    <FormItem>
                      <FormLabel className="text-slate-500">Jabatan (Locked)</FormLabel>
                      <FormControl><Input value={profile?.position || ""} disabled className="bg-slate-50 text-slate-500" /></FormControl>
                    </FormItem>
                  </div>

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat Lengkap</FormLabel>
                      <FormControl><Textarea {...field} rows={4} placeholder="Jalan..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isLoading} className="min-w-[150px] bg-blue-600 hover:bg-blue-700">
                      {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ProfilKaryawan;
