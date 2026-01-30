import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, User, Phone, MapPin, Building2, Briefcase, Save, Mail, ChevronRight, LogOut, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";

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
    defaultValues: {
      full_name: "",
      phone: "",
      address: "",
      department: "",
      position: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

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
      // Create profile if not exists
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || "",
        })
        .select()
        .single();

      if (newProfile) {
        setProfile(newProfile);
        form.reset({
          full_name: newProfile.full_name || "",
          phone: "",
          address: "",
          department: "",
          position: "",
        });
      }
    }
    setIsFetching(false);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        address: data.address || null,
        department: data.department || null,
        position: data.position || null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.message,
      });
    } else {
      toast({
        title: "Profil berhasil disimpan",
        description: "Data profil Anda telah diperbarui.",
      });
    }

    setIsLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout berhasil",
      description: "Sampai jumpa kembali!",
    });
    navigate("/auth");
  };

  if (isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ==========================================
  // iOS MOBILE VIEW - Native Feel
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container" style={{ paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
        {/* iOS Profile Header - Expanded */}
        <header className="ios-header" style={{ maxHeight: "none", height: "auto", paddingBottom: "100px", position: "relative", zIndex: 10 }}>
          <div className="relative z-10">
            {/* Back Button Row */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigate("/dashboard")}
                className="ios-back-btn"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h1 className="ios-header-title">Profil Saya</h1>
              <div className="w-8" /> {/* Spacer */}
            </div>

            {/* Profile Info */}
            <div className="ios-profile-header flex flex-col items-center">
              <div className="ios-avatar w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-lg border-2 border-white/30">
                <User className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                {profile?.full_name || user?.email?.split("@")[0]}
              </h2>
              <p className="text-white/70 text-sm mb-3">{user?.email}</p>
              {profile?.position && (
                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/10">
                  <span className="text-xs font-medium text-white">{profile.position}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Content */}
        <div className="px-4 -mt-16 relative z-20">
          {/* Quick Actions */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 overflow-hidden mb-6">
            <button
              onClick={() => navigate("/edit-password")}
              className="w-full p-4 flex items-center justify-between border-b border-gray-100 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Key className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Ubah Password</p>
                  <p className="text-xs text-gray-500">Amankan akun Anda</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300" />
            </button>
            <button
              onClick={handleLogout}
              className="w-full p-4 flex items-center justify-between active:bg-red-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white shadow-md">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-red-600 group-active:text-red-700">Logout</p>
                  <p className="text-xs text-red-400">Keluar dari aplikasi</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300" />
            </button>
          </div>

          {/* Profile Form */}
          <h3 className="ios-section-header">Informasi Pribadi</h3>
          <div className="ios-card p-4 mb-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nama lengkap" className="h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nomor Telepon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="08xxxxxxxxxx" className="h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">Departemen</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nama departemen" className="h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">Jabatan</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jabatan Anda" className="h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">Alamat</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Alamat lengkap" rows={3} className="bg-gray-50 border-gray-200 focus:bg-white transition-colors resize-none rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <button
                  type="submit"
                  className="ios-btn-primary flex items-center justify-center gap-2 mt-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  Simpan Perubahan
                </button>
              </form>
            </Form>
          </div>

          {/* Account Info */}
          <h3 className="ios-section-header">Informasi Akun</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="p-4 flex items-center gap-3 border-b border-gray-50">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              </div>
            </div>
            {profile?.join_date && (
              <div className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bergabung Sejak</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(profile.join_date).toLocaleDateString("id-ID", {
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* iOS Bottom Navigation */}
        <MobileNavigation />
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW (Original - Unchanged)
  // ==========================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted-foreground/20">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Profil Saya</h1>
                <p className="text-sm text-muted-foreground">Kelola informasi pribadi</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-xl space-y-6">
          {/* Profile Card */}
          <Card className="border-border animate-fade-in">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <CardTitle>{profile?.full_name || user?.email}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </CardDescription>
              {profile?.join_date && (
                <p className="text-xs text-muted-foreground mt-2">
                  Bergabung sejak {new Date(profile.join_date).toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              )}
            </CardHeader>
          </Card>

          {/* Edit Form */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle className="text-lg">Informasi Pribadi</CardTitle>
              <CardDescription>Perbarui data profil Anda</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input {...field} placeholder="Nama lengkap" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input {...field} placeholder="08xxxxxxxxxx" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departemen</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input {...field} placeholder="Nama departemen" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jabatan</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input {...field} placeholder="Jabatan Anda" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alamat</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Alamat lengkap" rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Simpan Perubahan
                  </Button>
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
