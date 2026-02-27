
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Send, Edit3, FolderOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DailyJournalFormData {
    title: string;
    project_category: string;
    duration: number; // in hours (float)
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

    return (
        <Card className="border-0 shadow-xl shadow-slate-200/40 bg-white/70 backdrop-blur-xl rounded-[32px] overflow-hidden">
            <CardHeader className="pb-6 border-b border-white/60 bg-white/40 pt-8 px-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                        <Edit3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tulis Jurnal Hari Ini</h2>
                        <CardDescription className="text-slate-500 font-medium mt-1">
                            Catat progres pekerjaanmu. Laporan terperinci membantu penilaian performa.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Activity Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="title" className="text-sm font-semibold text-slate-700">
                            Activity Title
                        </Label>
                        <Input
                            id="title"
                            placeholder="e.g., Implemented new authentication flow"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-11 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Project Category */}
                        <div className="space-y-1.5">
                            <Label htmlFor="category" className="text-sm font-semibold text-slate-700">
                                Project Category
                            </Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="category" className="h-11 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="development">Development</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                    <SelectItem value="design">Design</SelectItem>
                                    <SelectItem value="research">Research</SelectItem>
                                    <SelectItem value="support">Support</SelectItem>
                                    <SelectItem value="learning">Learning</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Duration */}
                        <div className="space-y-1.5">
                            <Label htmlFor="duration" className="text-sm font-semibold text-slate-700">
                                Duration (Hours)
                            </Label>
                            <div className="relative">
                                <Input
                                    id="duration"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="0.0"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="h-11 rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 pl-4 pr-10"
                                    required
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                            Detailed Description
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Describe your tasks, challenges, and outcomes..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[120px] rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 resize-none p-4"
                            required
                        />
                        <p className="text-xs text-slate-400">
                            Please be concise but thorough. This log is visible to your manager.
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 mt-6 border-t border-slate-200/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                            Jurnal ini akan diteruskan ke manajer Anda.
                        </p>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-8 h-12 shadow-lg shadow-slate-900/20 gap-2 active:scale-95 transition-all duration-300"
                        >
                            {isSubmitting ? (
                                <>Memproses...</>
                            ) : (
                                <>
                                    Kirim Laporan <Send className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>

                </form>
            </CardContent>
        </Card>
    );
}
