import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Save, Sparkles, AlertTriangle, CheckCircle2, CalendarIcon, AlertCircle, Lock, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
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
    { value: '😊', label: 'Baik', description: 'Produktif', color: 'bg-green-100 text-green-700 border-green-200' },
    { value: '😐', label: 'Biasa', description: 'Normal', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    { value: '😣', label: 'Sulit', description: 'Kendala', color: 'bg-red-100 text-red-700 border-red-200' }
];

const WORK_RESULT_OPTIONS = [
    { value: 'completed', label: 'Selesai', description: 'Tugas rampung', icon: CheckCircle2, color: 'text-green-600' },
    { value: 'progress', label: 'Progress', description: 'Masih jalan', icon: Sparkles, color: 'text-blue-600' },
    { value: 'pending', label: 'Tertunda', description: 'Ada blocker', icon: AlertCircle, color: 'text-amber-600' }
];

interface JournalFormProps {
    initialData?: Partial<JournalFormData>;
    isEditing?: boolean;
    isRevision?: boolean;
    isReadOnly?: boolean;
    managerNotes?: string;
    onSave: (data: JournalFormData, isDraft: boolean, isSilent?: boolean) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
    existingDates?: string[];
    onRequestEdit?: (date: string) => void;
    isDateLocked?: boolean;
}

export function JournalForm({
    initialData,
    isEditing = false,
    isRevision = false,
    isReadOnly = false,
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
    const isDateConflict = props.existingDates?.includes(dateString) &&
        (!isEditing || (initialData?.date && initialData.date !== dateString));

    // Ref for textarea auto-resize
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
        if (isSubmitting || !content.trim() || isReadOnly) return;
        const timer = setTimeout(() => {
            if (content.length >= 10) {
                onSave({
                    content: content.trim(),
                    work_result: workResult,
                    obstacles: obstacles.trim() || undefined,
                    mood,
                    date: format(date, 'yyyy-MM-dd')
                }, true, true);
            }
        }, 10000);
        return () => clearTimeout(timer);
    }, [content, workResult, obstacles, mood, date, isReadOnly]);

    const MIN_CHARS = 10;
    const isValidLength = content.trim().length >= MIN_CHARS;

    const handleSubmit = async (isDraft: boolean) => {
        if (!isValidLength || isReadOnly) return;
        setIsSubmitting(true);
        try {
            await onSave({
                content: content.trim(),
                work_result: workResult,
                obstacles: obstacles.trim() || undefined,
                mood,
                date: format(date, 'yyyy-MM-dd')
            }, isDraft);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isDisabled = isReadOnly || isDateConflict;

    return (
        <div className="flex flex-col h-full w-full relative bg-slate-50/50">
            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto w-full px-4 sm:px-6 py-6 space-y-6">

                {/* Status Banner for ReadOnly */}
                {isReadOnly && !isRevision && (
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex gap-3 items-center shadow-sm">
                        <Lock className="w-5 h-5 text-slate-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Mode Baca</p>
                            <p className="text-xs text-slate-500">Jurnal ini sudah disetujui dan tidak dapat diubah.</p>
                        </div>
                    </div>
                )}

                {/* Manager Notes Alert */}
                {isRevision && managerNotes && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in slide-in-from-top-2 flex gap-3 items-start shadow-sm">
                        <div className="p-2 bg-orange-100 rounded-full shrink-0">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-orange-900">Perlu Revisi</p>
                            <p className="text-sm text-orange-800 mt-1 leading-relaxed">{managerNotes}</p>
                        </div>
                    </div>
                )}

                {/* Date Selection */}
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Tanggal Jurnal
                    </Label>

                    {isDateConflict ? (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <div>
                                    <p className="text-sm font-bold text-red-800">Tanggal Konflik</p>
                                    <p className="text-xs text-red-600">Anda sudah memiliki jurnal untuk {format(date, "d MMMM yyyy", { locale: id })}.</p>
                                </div>
                            </div>
                            {!isReadOnly && !props.isDateLocked && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="self-end text-red-700 border-red-200 hover:bg-red-100"
                                    onClick={() => {
                                        if (isMobile) setIsDateDrawerOpen(true);
                                        else setIsDatePopoverOpen(true);
                                    }}
                                >
                                    Ganti Tanggal
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            {isMobile ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => !isDisabled && props.isDateLocked !== true && setIsDateDrawerOpen(true)}
                                    disabled={isDisabled || props.isDateLocked}
                                    className={cn(
                                        "w-full justify-start text-left font-semibold text-slate-800 h-14 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm",
                                        isDisabled && "opacity-80 bg-slate-50"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3 border border-blue-100">
                                        <CalendarIcon className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs text-slate-500 font-medium">Hari & Tanggal</span>
                                        <span>{date ? format(date, "EEEE, d MMMM yyyy", { locale: id }) : "Pilih Tanggal"}</span>
                                    </div>
                                </Button>
                            ) : (
                                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            disabled={isDisabled || props.isDateLocked}
                                            className={cn(
                                                "w-full justify-start text-left font-medium text-slate-700 h-12 px-4 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all",
                                                isDisabled && "opacity-80 bg-slate-50"
                                            )}
                                        >
                                            <CalendarIcon className="mr-3 h-4 w-4 text-blue-500" />
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

                    {/* Mobile Date Drawer */}
                    {isMobile && (
                        <Drawer open={isDateDrawerOpen} onOpenChange={setIsDateDrawerOpen}>
                            <DrawerContent>
                                <DrawerHeader>
                                    <DrawerTitle>Pilih Tanggal</DrawerTitle>
                                    <DrawerDescription>Tentukan tanggal untuk laporan aktivitas Anda.</DrawerDescription>
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
                                        className="rounded-xl border shadow-sm"
                                    />
                                </div>
                            </DrawerContent>
                        </Drawer>
                    )}
                </div>

                <div className="h-px bg-slate-200 w-full" />

                {/* Main Content */}
                <div className="space-y-3">
                    <Label htmlFor="content" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        Deskripsi Aktivitas <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                        <Textarea
                            id="content"
                            ref={textareaRef}
                            placeholder="Ceritakan apa saja yang Anda kerjakan hari ini secara detail..."
                            className={cn(
                                "min-h-[160px] resize-none border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 py-4 px-4 leading-relaxed transition-all rounded-xl shadow-sm text-base text-slate-700 placeholder:text-slate-400 bg-white",
                                isDisabled && "bg-slate-50 text-slate-500 shadow-none border-slate-100"
                            )}
                            disabled={isDisabled}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        {/* Word Count / Validation Indicator */}
                        {!isReadOnly && (
                            <div className="absolute bottom-3 right-3 pointer-events-none">
                                <span className={cn(
                                    "text-[10px] uppercase font-bold px-2 py-1 rounded-full backdrop-blur-sm transition-colors",
                                    content.length >= MIN_CHARS
                                        ? "bg-green-100/80 text-green-700"
                                        : "bg-slate-100/80 text-slate-500"
                                )}>
                                    {content.length >= MIN_CHARS ? 'Siap' : `${content.length}/${MIN_CHARS}`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Work Result & Mood Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Work Result */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-800">Status Pekerjaan</Label>
                        {isMobile ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => !isDisabled && setIsResultDrawerOpen(true)}
                                    disabled={isDisabled}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3.5 border rounded-xl text-left transition-all shadow-sm bg-white hover:bg-slate-50",
                                        isDisabled ? "opacity-60 bg-slate-50" : "border-slate-200"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                        workResult === 'completed' ? "bg-green-100 text-green-600" :
                                            workResult === 'pending' ? "bg-amber-100 text-amber-600" :
                                                "bg-blue-100 text-blue-600"
                                    )}>
                                        {workResult === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                            workResult === 'pending' ? <AlertCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-sm">
                                            {WORK_RESULT_OPTIONS.find(o => o.value === workResult)?.label}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {WORK_RESULT_OPTIONS.find(o => o.value === workResult)?.description}
                                        </span>
                                    </div>
                                </button>

                                <Drawer open={isResultDrawerOpen} onOpenChange={setIsResultDrawerOpen}>
                                    <DrawerContent>
                                        <DrawerHeader className="text-left">
                                            <DrawerTitle>Status Pekerjaan</DrawerTitle>
                                            <DrawerDescription>Seberapa jauh progress pekerjaan Anda?</DrawerDescription>
                                        </DrawerHeader>
                                        <div className="p-4 space-y-3 pb-8 bg-slate-50/50">
                                            {WORK_RESULT_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setWorkResult(option.value as any);
                                                        setIsResultDrawerOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full p-4 rounded-2xl flex items-center gap-4 border text-left transition-all bg-white relative overflow-hidden",
                                                        workResult === option.value
                                                            ? "border-blue-500 ring-2 ring-blue-500/10 shadow-lg scale-[1.02]"
                                                            : "border-slate-200 hover:border-slate-300 shadow-sm"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl transition-colors",
                                                        workResult === option.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                                                    )}>
                                                        <option.icon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className={cn("font-bold text-base", workResult === option.value ? "text-blue-700" : "text-slate-900")}>
                                                            {option.label}
                                                        </div>
                                                        <div className="text-sm text-slate-500">{option.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </DrawerContent>
                                </Drawer>
                            </>
                        ) : (
                            <Select value={workResult} onValueChange={(v: any) => setWorkResult(v)} disabled={isDisabled}>
                                <SelectTrigger className="w-full h-[52px] border-slate-200 bg-white focus:ring-blue-500 rounded-xl px-3">
                                    <SelectValue placeholder="Pilih status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WORK_RESULT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="py-3 cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <option.icon className={cn("w-4 h-4", option.color)} />
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-sm text-slate-700">{option.label}</span>
                                                    <span className="text-[10px] text-slate-500">{option.description}</span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Mood Selector */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-800">Mood Kerja</Label>
                        <div className="flex gap-2">
                            {MOOD_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => setMood(option.value as '😊' | '😐' | '😣')}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all duration-200 h-[52px]",
                                        mood === option.value
                                            ? option.color + " ring-2 ring-offset-1 ring-offset-white shadow-sm"
                                            : "border-slate-100 bg-white hover:border-slate-200 text-slate-400 hover:bg-slate-50",
                                        isDisabled && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <span className="text-2xl leading-none">{option.value}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Obstacles / Notes Field */}
                <div className="space-y-3">
                    <Label htmlFor="obstacles" className="text-sm font-bold text-slate-700 flex items-center justify-between">
                        Kendala / Catatan
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opsional</span>
                    </Label>
                    <Textarea
                        id="obstacles"
                        placeholder="Tuliskan jika ada kendala atau catatan tambahan..."
                        className={cn(
                            "min-h-[80px] text-sm resize-none border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl shadow-sm bg-white placeholder:text-slate-400",
                            isDisabled && "bg-slate-50 text-slate-500 border-slate-100"
                        )}
                        value={obstacles}
                        onChange={(e) => setObstacles(e.target.value)}
                        disabled={isDisabled}
                    />
                </div>

            </div>

            {/* Sticky Bottom Action Bar */}
            <div className={cn(
                "border-t border-slate-200 bg-white/80 backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row gap-3 z-30 shrink-0 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] transition-all",
                isMobile ? "pb-8" : "pb-5"
            )}>
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="text-slate-500 font-medium h-12 rounded-xl hover:bg-slate-100"
                >
                    {isReadOnly ? "Tutup" : "Batal"}
                </Button>

                {!isReadOnly && (
                    <div className="flex gap-3 flex-1 sm:justify-end">
                        {!isRevision && !isDateConflict && (
                            <Button
                                variant="outline"
                                onClick={() => handleSubmit(true)}
                                disabled={isSubmitting || !isValidLength || isDateConflict}
                                className="flex-1 sm:flex-none border-slate-300 text-slate-700 font-semibold h-12 rounded-xl hover:bg-slate-50 hover:text-slate-900"
                            >
                                Simpan Draft
                            </Button>
                        )}

                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting || !isValidLength || isDateConflict}
                            className={cn(
                                "flex-1 sm:flex-none sm:min-w-[160px] h-12 rounded-xl font-bold shadow-lg text-white transition-all transform active:scale-95",
                                isDateConflict
                                    ? "bg-slate-300 shadow-none cursor-not-allowed text-slate-500"
                                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 hover:shadow-blue-500/50"
                            )}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Menyimpan...</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Send className="w-4 h-4" />
                                    {isRevision ? "Kirim Revisi" : isEditing ? "Simpan Perubahan" : "Kirim Laporan"}
                                </span>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
