import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Save, Sparkles, AlertTriangle, CheckCircle2, CalendarIcon, AlertCircle, Lock } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
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
    { value: 'progress', label: 'Dalam Progress', description: 'Masih dalam proses' },
    { value: 'pending', label: 'Tertunda', description: 'Belum dimulai/terhenti' }
];

interface JournalFormProps {
    initialData?: Partial<JournalFormData>;
    isEditing?: boolean;
    isRevision?: boolean;
    isReadOnly?: boolean; // Added for Sent/Approved states
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
        <div className="flex flex-col h-full w-full relative bg-white overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto w-full px-1 space-y-5 pb-4">

                {/* Status Banner for ReadOnly */}
                {isReadOnly && !isRevision && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex gap-3 items-center mx-1 mt-1">
                        <Lock className="w-4 h-4 text-slate-500" />
                        <p className="text-sm font-medium text-slate-600">
                            Jurnal ini sudah terkirim dan tidak dapat diedit.
                        </p>
                    </div>
                )}

                {/* Manager Notes Alert */}
                {isRevision && managerNotes && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in slide-in-from-top-2 flex gap-3 items-start mx-1 mt-1">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-orange-800">Perlu Revisi</p>
                            <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">{managerNotes}</p>
                        </div>
                    </div>
                )}

                {/* Date Selection */}
                <div className="space-y-3 px-1">
                    <Label className="text-slate-500 font-medium text-xs uppercase tracking-wider block">
                        📅 Tanggal Jurnal
                    </Label>

                    {isDateConflict ? (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-1.5 rounded-full shadow-sm shrink-0">
                                        <AlertCircle className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-800 truncate">
                                            Sudah ada jurnal tanggal ini
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {format(date, "d MMMM yyyy", { locale: id })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsDateDrawerOpen(true)}
                                        className="flex-1 h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-100"
                                    >
                                        Ganti Tanggal
                                    </Button>
                                    {props.onRequestEdit && (
                                        <Button
                                            size="sm"
                                            onClick={() => props.onRequestEdit?.(format(date, 'yyyy-MM-dd'))}
                                            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                        >
                                            Edit Jurnal Ini
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            {isMobile ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => !isDisabled && props.isDateLocked !== true && setIsDateDrawerOpen(true)}
                                        disabled={isDisabled || props.isDateLocked}
                                        className={cn(
                                            "w-full justify-start text-left font-semibold text-slate-700 h-12 rounded-xl border-slate-200 bg-white shadow-sm",
                                            isDisabled && "opacity-90 bg-slate-50 text-slate-500"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-5 w-5 text-blue-600" />
                                        <div className="flex flex-col items-start gap-0.5 leading-none">
                                            <span>{date ? format(date, "d MMMM yyyy", { locale: id }) : "Pilih Tanggal"}</span>
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
                                            disabled={isDisabled || props.isDateLocked}
                                            className={cn(
                                                "w-full justify-start text-left font-medium text-sm text-slate-700 h-11 px-4 rounded-lg border-slate-200 bg-white shadow-sm",
                                                isDisabled && "opacity-90 bg-slate-50 text-slate-500"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
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
                <div className="space-y-2 px-1">
                    <Label htmlFor="content" className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                        <span>Deskripsi Aktivitas <span className="text-red-500">*</span></span>
                    </Label>
                    <Textarea
                        id="content"
                        ref={textareaRef}
                        placeholder="Contoh: Menyelesaikan desain UI untuk halaman dashboard, Meeting dengan tim marketing..."
                        className={cn(
                            "min-h-[140px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 py-3 leading-relaxed transition-all",
                            isMobile ? "text-base p-4" : "text-sm",
                            isDisabled && "bg-slate-50 text-slate-600 border-slate-100"
                        )}
                        disabled={isDisabled}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    {!isReadOnly && (
                        <div className="flex justify-between items-center">
                            <p className={cn(
                                "text-[11px] transition-colors",
                                content.length > 0 && !isValidLength ? "text-red-500 font-medium" : "text-slate-400"
                            )}>
                                Min. {MIN_CHARS} karakter {content.length > 0 && `(${content.length}/${MIN_CHARS})`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Work Result Selection */}
                <div className="space-y-2 px-1">
                    <Label className="text-sm font-semibold text-slate-700">Hasil Pekerjaan</Label>
                    {isMobile ? (
                        <>
                            <button
                                type="button"
                                onClick={() => !isDisabled && setIsResultDrawerOpen(true)}
                                disabled={isDisabled}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 border rounded-xl text-left transition-colors shadow-sm min-h-[56px]",
                                    isDisabled
                                        ? "bg-slate-50 border-slate-100 text-slate-500"
                                        : "bg-white border-slate-200 active:bg-slate-50"
                                )}
                            >
                                <span className={cn("font-medium", workResult ? "text-slate-800" : "text-slate-400")}>
                                    {WORK_RESULT_OPTIONS.find(o => o.value === workResult)?.label || "Pilih status"}
                                </span>
                            </button>
                            <Drawer open={isResultDrawerOpen} onOpenChange={setIsResultDrawerOpen}>
                                <DrawerContent>
                                    <DrawerHeader className="text-left pb-2">
                                        <DrawerTitle>Bagaimana hasil kerjamu?</DrawerTitle>
                                        <DrawerDescription>Pilih status penyelesaian tugas hari ini.</DrawerDescription>
                                    </DrawerHeader>
                                    <div className="p-4 space-y-3 pb-8 bg-slate-50">
                                        {WORK_RESULT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setWorkResult(option.value as any);
                                                    setIsResultDrawerOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full p-4 rounded-xl flex items-center gap-4 border text-left transition-all bg-white",
                                                    workResult === option.value
                                                        ? "border-blue-500 ring-1 ring-blue-500 shadow-md"
                                                        : "border-slate-200 hover:border-slate-300"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg transition-colors",
                                                    workResult === option.value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {option.value === 'completed' && <CheckCircle2 className="w-5 h-5" />}
                                                    {option.value === 'progress' && <Sparkles className="w-5 h-5" />}
                                                    {option.value === 'pending' && <AlertCircle className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-base">{option.label}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{option.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </DrawerContent>
                            </Drawer>
                        </>
                    ) : (
                        <Select value={workResult} onValueChange={(v: 'completed' | 'progress' | 'pending') => setWorkResult(v)} disabled={isDisabled}>
                            <SelectTrigger className="w-full h-11 border-slate-200 bg-white focus:ring-blue-500">
                                <SelectValue placeholder="Pilih status hasil kerja" />
                            </SelectTrigger>
                            <SelectContent>
                                {WORK_RESULT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="py-2.5">
                                        <div className="flex flex-col items-start gap-0.5">
                                            <span className="font-medium text-sm">{option.label}</span>
                                            <span className="text-[11px] text-slate-500">{option.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Obstacles / Notes Field */}
                <div className="space-y-2 px-1">
                    <Label htmlFor="obstacles" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        Kendala / Catatan
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Opsional</span>
                    </Label>
                    <Textarea
                        id="obstacles"
                        placeholder="Tuliskan kendala atau catatan tambahan..."
                        className={cn(
                            "min-h-[80px] text-sm resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500/20",
                            isDisabled && "bg-slate-50 text-slate-600 border-slate-100"
                        )}
                        value={obstacles}
                        onChange={(e) => setObstacles(e.target.value)}
                        disabled={isDisabled}
                    />
                </div>

                {/* Mood Selector */}
                <div className="space-y-3 pb-2 px-1">
                    <Label className="text-sm font-semibold text-slate-700">Work Mood</Label>
                    <div className="flex gap-3">
                        {MOOD_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setMood(option.value as '😊' | '😐' | '😣')}
                                className={cn(
                                    "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                    mood === option.value
                                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                                        : "border-slate-100 bg-white",
                                    !isDisabled && mood !== option.value && "hover:bg-slate-50 hover:border-slate-200 active:scale-95",
                                    isDisabled && mood !== option.value && "opacity-50 grayscale"
                                )}
                            >
                                <span className="text-3xl filter drop-shadow-sm transition-transform duration-200" style={{
                                    transform: mood === option.value ? 'scale(1.15)' : 'scale(1)'
                                }}>{option.value}</span>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wide",
                                    mood === option.value ? "text-blue-700" : "text-slate-400"
                                )}>
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Info Text - Only show when editable */}
                {!isReadOnly && (
                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed border border-slate-100 mx-1">
                        <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p>
                            Simpan sebagai <strong>Draft</strong> jika belum selesai. Manager akan menerima notifikasi setelah Anda klik <strong>Kirim Laporan</strong>.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            <div className={cn(
                "border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 bg-white mt-auto shrink-0 z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] p-4 w-full",
                isMobile ? "pb-8" : "pb-4"
            )}>
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="text-slate-500 h-11 sm:w-auto font-medium hover:bg-slate-100"
                >
                    {isReadOnly ? "Tutup" : "Batal"}
                </Button>

                {!isReadOnly && (
                    <div className="flex gap-3 flex-1 justify-end">
                        {!isRevision && !isDateConflict && (
                            <Button
                                variant="outline"
                                onClick={() => handleSubmit(true)}
                                disabled={isSubmitting || !isValidLength || isDateConflict}
                                className="gap-2 border-slate-300 h-11 text-slate-700 font-medium flex-1 sm:flex-none hover:bg-slate-50"
                            >
                                <Save className="w-4 h-4" />
                                <span>Simpan Draft</span>
                            </Button>
                        )}

                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting || !isValidLength || isDateConflict}
                            className={cn(
                                "gap-2 text-white h-11 text-sm font-bold shadow-md transition-all flex-1 sm:flex-none sm:min-w-[140px]",
                                isDateConflict
                                    ? "bg-slate-300 shadow-none cursor-not-allowed text-slate-500"
                                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5"
                            )}
                        >
                            <Send className="w-4 h-4" />
                            {isSubmitting
                                ? "Mengirim..."
                                : isDateConflict
                                    ? "Tanggal Konflik"
                                    : isRevision
                                        ? "Kirim Revisi"
                                        : isEditing
                                            ? "Update Jurnal"
                                            : "Kirim Laporan"
                            }
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
