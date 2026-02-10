
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
        <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Edit3 className="w-5 h-5" />
                    <h2 className="text-lg font-bold text-slate-900">Log Today's Activity</h2>
                </div>
                <CardDescription>
                    Catat aktivitas harian Anda untuk pelaporan kinerja.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
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
                    <div className="pt-2 flex justify-end">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg px-6 h-11 shadow-sm gap-2"
                        >
                            {isSubmitting ? (
                                <>Processing...</>
                            ) : (
                                <>
                                    Submit Journal <Send className="w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </div>

                </form>
            </CardContent>
        </Card>
    );
}
