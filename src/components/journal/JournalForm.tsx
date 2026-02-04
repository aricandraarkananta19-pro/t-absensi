import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Save, Sparkles, AlertTriangle, CheckCircle2, CalendarIcon, AlertCircle } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, isAfter, subDays, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

export interface JournalFormData {
    content: string;
    work_result: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: '😊' | '😐' | '😣';
    date: string; // YYYY-MM-DD
}

const MOOD_OPTIONS = [
    { value: '😊', label: 'Baik', description: 'Produktif dan lancar' },
    { value: '😐', label: 'Biasa', description: 'Normal, tidak ada masalah' },
    { value: '😣', label: 'Sulit', description: 'Ada tantangan/kendala' }
];

const WORK_RESULT_OPTIONS = [
    { value: 'completed', label: 'Selesai', description: 'Semua tugas tercapai' },
    { value: 'progress', label: 'Dalam Progress', description: 'Masih berjalan' },
    { value: 'pending', label: 'Tertunda', description: 'Belum dimulai/terhenti' }
];

interface JournalFormProps {
    initialData?: Partial<JournalFormData>;
    isEditing?: boolean;
    isRevision?: boolean;
    managerNotes?: string;
    onSave: (data: JournalFormData, isDraft: boolean, isSilent?: boolean) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
    existingDates?: string[]; // List of dates that already have a journal
    onRequestEdit?: (date: string) => void;
    isDateLocked?: boolean;
}

export function JournalForm({
    initialData,
    isEditing = false,
    isRevision = false,
    managerNotes,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
    ...props
}: JournalFormProps) {
    const isMobile = useIsMobile();
    const [isSubmitting, setIsSubmitting] = useState(externalIsSubmitting);

    // Form state
    const [content, setContent] = useState(initialData?.content || "");
    const [workResult, setWorkResult] = useState<'completed' | 'progress' | 'pending'>(
        initialData?.work_result || 'progress'
    );
    const [obstacles, setObstacles] = useState(initialData?.obstacles || "");
    const [mood, setMood] = useState<'😊' | '😐' | '😣' | undefined>(initialData?.mood);
    const [date, setDate] = useState<Date>(
        initialData?.date ? parseISO(initialData.date) : new Date()
    );

    // UI State
    const [isResultDrawerOpen, setIsResultDrawerOpen] = useState(false);
    const [isDateDrawerOpen, setIsDateDrawerOpen] = useState(false);
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

    // Derived State
    const dateString = format(date, 'yyyy-MM-dd');
    const isToday = isSameDay(date, new Date());
    const isBackdated = isAfter(subDays(new Date(), 1), date); // Considered backdated if older than yesterday? Or just not today? Prompt says "2 or 3 days"
    const isDateOccupied = !isEditing && (props.existingDates || []).includes(dateString);
    // If we are editing, we are allowed to keep the same date. Only changing to ANOTHER occupied date is a conflict.
    // If not editing (creating), any occupied date is a conflict.

    // Logic for conflict when editing: if I change date to one that exists, and it's NOT the current journal's date.
    // But since `initialData.date` tracks the original date, we can compare.
    const isDateConflict = props.existingDates?.includes(dateString) &&
        (!isEditing || (initialData?.date && initialData.date !== dateString));

    // Auto-resize textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
    }, [content]);

    // Update internal state when initialData changes
    useEffect(() => {
        if (initialData) {
            setContent(initialData.content || "");
            setWorkResult(initialData.work_result || 'progress');
            setObstacles(initialData.obstacles || "");
            setMood(initialData.mood);
            setDate(initialData.date ? parseISO(initialData.date) : new Date());
        }
    }, [initialData]);

    // Auto-save logic (Debounce 10s)
    useEffect(() => {
        // Don't auto-save if submitting, revision (unless we want to?), or empty content
        if (isSubmitting || !content.trim()) return;

        const timer = setTimeout(() => {
            // Only auto-save as DRAFT
            onSave({
                content: content.trim(),
                work_result: workResult,
                obstacles: obstacles.trim() || undefined,
                mood,
                date: format(date, 'yyyy-MM-dd')
            }, true, true); // isDraft=true, isSilent=true
        }, 10000); // 10 seconds

        return () => clearTimeout(timer);
    }, [content, workResult, obstacles, mood, date]);

    const handleSubmit = async (isDraft: boolean) => {
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            await onSave({
                content: content.trim(),
                work_result: workResult,
                obstacles: obstacles.trim() || undefined,
                mood,
                date: format(date, 'yyyy-MM-dd')
            }, isDraft);

            // Note: form reset should be handled by parent or if component unmounts
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Scrollable Content Area */}
            <div className={`flex-1 overflow-y-auto px-1 ${isMobile ? 'pb-24' : 'pb-4'} space-y-5 no-scrollbar`}>

                {/* Manager Notes Alert (Top Priority) */}
                {isRevision && managerNotes && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in slide-in-from-top-2 flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-orange-800">Perlu Revisi</p>
                            <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">{managerNotes}</p>
                        </div>
                    </div>
                )}

                {/* Date Selection & Conflict Handling */}
                <div className="space-y-3">
                    <Label className="text-slate-500 font-medium text-xs uppercase tracking-wider block">
                        📅 Tanggal Jurnal
                    </Label>

                    {/* Conflict Alert - Ultra Compact Decision Card */}
                    {isDateConflict ? (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="bg-white p-1.5 rounded-full shadow-sm shrink-0">
                                        <AlertCircle className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">
                                            Jurnal tanggal ini sudah ada
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {format(date, "d MMMM yyyy", { locale: id })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsDateDrawerOpen(true)}
                                        className="flex-1 sm:flex-none h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-100"
                                    >
                                        Ganti Tanggal
                                    </Button>
                                    {props.onRequestEdit && (
                                        <Button
                                            size="sm"
                                            onClick={() => props.onRequestEdit?.(format(date, 'yyyy-MM-dd'))}
                                            className="flex-1 sm:flex-none h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                        >
                                            Edit Jurnal Ini
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Normal Date Picker
                        <div className="relative">
                            {isMobile ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsDateDrawerOpen(true)}
                                        disabled={props.isDateLocked}
                                        className={cn(
                                            "w-full justify-start text-left font-semibold text-slate-700 h-12 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50",
                                            !date && "text-muted-foreground",
                                            props.isDateLocked && "opacity-75 cursor-not-allowed bg-slate-100"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-5 w-5 text-blue-500" />
                                        <div className="flex flex-col items-start gap-0.5 leading-none">
                                            <span className="text-sm text-slate-900">{date ? format(date, "d MMMM yyyy", { locale: id }) : "Pilih Tanggal"}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{date ? format(date, "EEEE", { locale: id }) : "Hari ini"}</span>
                                        </div>
                                    </Button>
                                    <Drawer open={isDateDrawerOpen} onOpenChange={setIsDateDrawerOpen}>
                                        <DrawerContent>
                                            <DrawerHeader>
                                                <DrawerTitle>Pilih Tanggal</DrawerTitle>
                                                <DrawerDescription>Pilih tanggal untuk entri jurnal ini.</DrawerDescription>
                                            </DrawerHeader>
                                            <div className="p-4 flex justify-center pb-8">
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    onSelect={(d) => {
                                                        if (d) setDate(d);
                                                        setIsDateDrawerOpen(false);
                                                    }}
                                                    initialFocus
                                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                    className="rounded-md border shadow-sm"
                                                />
                                            </div>
                                        </DrawerContent>
                                    </Drawer>
                                </>
                            ) : (
                                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            disabled={props.isDateLocked}
                                            className={cn(
                                                "w-full justify-start text-left font-semibold text-slate-700 h-11 px-4 rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50",
                                                !date && "text-muted-foreground",
                                                props.isDateLocked && "opacity-75 cursor-not-allowed bg-slate-100"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                            {date ? format(date, "EEEE, d MMMM yyyy", { locale: id }) : <span>Pilih tanggal</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={(d) => {
                                                if (d) setDate(d);
                                                setIsDatePopoverOpen(false);
                                            }}
                                            initialFocus
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Field */}
                <div className="space-y-2">
                    <Label htmlFor="content" className="text-slate-700 font-semibold flex items-center gap-2 text-base">
                        Apa yang Anda kerjakan hari ini?
                        <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                        id="content"
                        ref={textareaRef}
                        placeholder="Contoh: Menyelesaikan desain UI untuk halaman dashboard, Meeting dengan tim marketing..."
                        className={`
                            min-h-[140px] resize-none border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 py-3 leading-relaxed
                            ${isMobile ? 'text-lg p-4' : 'text-base'}
                        `}
                        disabled={isDateConflict}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>

                {/* Work Result Selection */}
                <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold text-base">Hasil Pekerjaan</Label>
                    {isMobile ? (
                        <>
                            <button
                                type="button"
                                onClick={() => !isDateConflict && setIsResultDrawerOpen(true)}
                                disabled={isDateConflict}
                                className={`w-full flex items-center justify-between p-4 border rounded-xl text-left transition-colors shadow-sm
                                    ${isDateConflict ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 active:bg-slate-50'}
                                `}
                            >
                                <span className="font-medium text-slate-800">
                                    {WORK_RESULT_OPTIONS.find(o => o.value === workResult)?.label || "Pilih status"}
                                </span>
                                {!isDateConflict && (
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                        Ganti
                                    </span>
                                )}
                            </button>
                            <Drawer open={isResultDrawerOpen} onOpenChange={setIsResultDrawerOpen}>
                                <DrawerContent>
                                    <DrawerHeader className="text-left pb-2">
                                        <DrawerTitle>Bagaimana hasil kerjamu?</DrawerTitle>
                                        <DrawerDescription>Pilih status penyelesaian tugas hari ini.</DrawerDescription>
                                    </DrawerHeader>
                                    <div className="p-4 space-y-3 pb-8">
                                        {WORK_RESULT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setWorkResult(option.value as any);
                                                    setIsResultDrawerOpen(false);
                                                }}
                                                className={`
                                                    w-full p-4 rounded-xl flex items-center gap-4 border text-left transition-all
                                                    ${workResult === option.value
                                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-200 shadow-sm'
                                                        : 'bg-white border-slate-200 active:scale-[0.98]'
                                                    }
                                                `}
                                            >
                                                <div className={`
                                                    w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                                                    ${workResult === option.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}
                                                `}>
                                                    {workResult === option.value && <CheckCircle2 className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-lg">{option.label}</div>
                                                    <div className="text-sm text-slate-500">{option.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </DrawerContent>
                            </Drawer>
                        </>
                    ) : (
                        <Select value={workResult} onValueChange={(v: 'completed' | 'progress' | 'pending') => setWorkResult(v)} disabled={isDateConflict}>
                            <SelectTrigger className="w-full h-12 border-slate-200 bg-white">
                                <SelectValue placeholder="Pilih status hasil kerja" />
                            </SelectTrigger>
                            <SelectContent>
                                {WORK_RESULT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="py-3">
                                        <div className="flex flex-col items-start gap-0.5">
                                            <span className="font-medium text-base">{option.label}</span>
                                            <span className="text-xs text-slate-500">{option.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Obstacles & Mood - Also disable on conflict */}
                <div className="space-y-2">
                    <Label htmlFor="obstacles" className="text-slate-700 font-semibold flex items-center gap-2 text-base">
                        Kendala / Catatan <span className="text-xs text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                    </Label>
                    <Textarea
                        id="obstacles"
                        placeholder="Tuliskan kendala..."
                        className="min-h-[80px] text-sm border-slate-200"
                        value={obstacles}
                        onChange={(e) => setObstacles(e.target.value)}
                        disabled={isDateConflict}
                    />
                </div>

                <div className="space-y-3 pb-4">
                    <Label className="text-slate-700 font-semibold text-base">Work Mood</Label>
                    <div className="flex gap-3">
                        {MOOD_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                disabled={isDateConflict}
                                onClick={() => setMood(option.value as '😊' | '😐' | '😣')}
                                className={`
                                    flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95
                                    ${mood === option.value
                                        ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-200'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }
                                    ${isDateConflict ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                                `}
                            >
                                <span className="text-4xl filter drop-shadow-sm">{option.value}</span>
                                <span className="text-xs font-bold text-slate-500">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar (Fixed at bottom of flex column) */}
            {/* Added PB to account for Mobile Safe Area */}
            <div className={`pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 bg-white mt-auto shrink-0 z-20 ${isMobile ? 'pb-8 -mx-1 px-3' : 'pb-0'}`}>
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="text-slate-500 h-12 sm:w-auto font-medium"
                >
                    Batal
                </Button>

                {!isRevision && (
                    <Button
                        variant="outline"
                        onClick={() => handleSubmit(true)}
                        disabled={isSubmitting || !content.trim() || isDateConflict}
                        className="gap-2 border-slate-300 h-12 text-slate-700 font-medium sm:w-auto hover:bg-slate-50"
                    >
                        <Save className="w-4 h-4" />
                        <span className="">Simpan Draft</span>
                    </Button>
                )}

                <Button
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting || !content.trim() || isDateConflict}
                    className={`gap-2 text-white flex-1 h-12 text-base font-bold shadow-lg transition-all
                        ${isDateConflict
                            ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300'
                        }
                    `}
                >
                    <Send className="w-4 h-4" />
                    {isSubmitting
                        ? "Mengirim..."
                        : isDateConflict
                            ? "Tanggal Terisi"
                            : isRevision
                                ? "Kirim Ulang"
                                : isEditing
                                    ? "Simpan Perubahan"
                                    : "Kirim Laporan"
                    }
                </Button>
            </div>
        </div>
    );
}
