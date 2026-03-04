
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Clock, Send, Edit3, FolderOpen, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DailyJournalFormData {
    title: string;
    project_category: string;
    duration: number;
    content: string;
    date: string;
}

interface DailyJournalFormProps {
    initialData?: Partial<DailyJournalFormData>;
    onSubmit: (data: DailyJournalFormData) => Promise<void>;
    isSubmitting?: boolean;
    userEmail?: string;
}

export function DailyJournalForm({
    initialData,
    onSubmit,
    isSubmitting = false,
    userEmail
}: DailyJournalFormProps) {
    const [title, setTitle] = useState(initialData?.title || "");
    const [category, setCategory] = useState(initialData?.project_category || "");
    const [duration, setDuration] = useState(initialData?.duration?.toString() || "");
    const [content, setContent] = useState(initialData?.content || "");
    const [date] = useState(new Date());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            title,
            project_category: category,
            duration: parseFloat(duration) || 0,
            content,
            date: format(date, "yyyy-MM-dd")
        });
    };

    const isFormValid = title && category && duration && content;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50/50 to-white">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
                        <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tulis Jurnal Hari Ini</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {format(date, "EEEE, d MMMM yyyy", { locale: localeId })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Body */}
            <div className="px-6 sm:px-8 py-6">
                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Activity Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Judul Aktivitas <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            id="title"
                            placeholder="Contoh: Implementasi fitur autentikasi baru"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Project Category */}
                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Kategori Project <span className="text-red-400">*</span>
                            </Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="category" className="h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm">
                                    <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-xl border-slate-200 dark:border-slate-700">
                                    <SelectItem value="development">🛠️ Development</SelectItem>
                                    <SelectItem value="meeting">📋 Meeting</SelectItem>
                                    <SelectItem value="design">🎨 Design</SelectItem>
                                    <SelectItem value="research">🔬 Research</SelectItem>
                                    <SelectItem value="support">🤝 Support</SelectItem>
                                    <SelectItem value="learning">📚 Learning</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                            <Label htmlFor="duration" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Durasi (Jam) <span className="text-red-400">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="duration"
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    placeholder="0.0"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 pl-4 pr-12 text-sm"
                                    required
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" /> jam
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Deskripsi Detail <span className="text-red-400">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Jelaskan tugas, tantangan, dan hasil pekerjaan Anda hari ini..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[130px] rounded-xl border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none p-4 text-sm leading-relaxed"
                            required
                        />
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Deskripsikan secara singkat namun lengkap. Jurnal ini akan diteruskan ke manajer Anda.
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end items-center gap-4">
                        <Button
                            type="submit"
                            disabled={isSubmitting || !isFormValid}
                            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-8 h-11 shadow-md shadow-slate-900/10 gap-2 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Memproses...
                                </span>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Kirim Jurnal
                                </>
                            )}
                        </Button>
                    </div>

                </form>
            </div>
        </div>
    );
}
