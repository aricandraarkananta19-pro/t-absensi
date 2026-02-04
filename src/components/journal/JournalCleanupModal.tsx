
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface JournalCleanupModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function JournalCleanupModal({ open, onOpenChange }: JournalCleanupModalProps) {
    const [step, setStep] = useState<1 | 2>(1); // 1: Select, 2: Confirm
    const [scope, setScope] = useState<"month" | "older_than_3_months">("month");
    const [selectedMonth, setSelectedMonth] = useState<Date>(subMonths(new Date(), 1));
    const [confirmationText, setConfirmationText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirmStep = () => {
        setStep(2);
    };

    const handleCleanup = async () => {
        if (confirmationText !== "DELETE DATA") return;

        setIsDeleting(true);
        try {
            let query = supabase.from('work_journals').delete();

            let message = "";

            if (scope === 'month') {
                const start = startOfMonth(selectedMonth);
                const end = endOfMonth(selectedMonth);
                // Safe delete by date range
                query = query
                    .gte('date', format(start, 'yyyy-MM-dd'))
                    .lte('date', format(end, 'yyyy-MM-dd'));

                message = `Data bulan ${format(selectedMonth, 'MMMM yyyy', { locale: id })} berhasil dihapus.`;
            } else {
                // Delete older than 3 months
                const cutOffDate = subMonths(new Date(), 3);
                query = query.lt('date', format(cutOffDate, 'yyyy-MM-dd'));

                message = "Data lama (>3 bulan) berhasil bersihkan.";
            }

            const { error, count } = await query; // count option if enabled in supabase client

            if (error) throw error;

            toast({
                title: "Pembersihan Data Berhasil",
                description: message,
            });

            onOpenChange(false);
            setStep(1);
            setConfirmationText("");

        } catch (error: any) {
            console.error("Cleanup error:", error);
            toast({
                variant: "destructive",
                title: "Gagal Menghapus",
                description: error.message
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="w-5 h-5" />
                        Bersihkan Data Jurnal
                    </DialogTitle>
                    <DialogDescription>
                        Fitur ini membantu menjaga performa sistem dengan menghapus data lama.
                    </DialogDescription>
                </DialogHeader>

                {step === 1 ? (
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p>
                                Pastikan Anda sudah melakukan <strong>Export Data</strong> sebelum menghapus.
                                Data yang dihapus tidak dapat dikembalikan.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Pilih Data yang akan Dihapus</Label>
                            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Pilih Bulan Tertentu</SelectItem>
                                    <SelectItem value="older_than_3_months">Semua Data {'>'} 3 Bulan Lalu</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {scope === 'month' && (
                            <div className="space-y-2">
                                <Label>Pilih Bulan</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedMonth && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedMonth ? format(selectedMonth, "MMMM yyyy", { locale: id }) : <span>Pilih bulan</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedMonth}
                                            onSelect={(d) => d && setSelectedMonth(d)}
                                            initialFocus
                                            defaultMonth={selectedMonth}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                            <p className="font-bold text-red-700 text-lg mb-1">KONFIRMASI PENGHAPUSAN</p>
                            <p className="text-sm text-red-600">
                                Tindakan ini bersifat PERMANEN dan tidak bisa dibatalkan.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-700">
                                Ketik <span className="font-bold font-mono text-red-600">DELETE DATA</span> untuk konfirmasi:
                            </Label>
                            <Input
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder="DELETE DATA"
                                className="border-red-300 focus:border-red-500 focus:ring-red-200"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 1 ? (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
                            <Button onClick={handleConfirmStep} variant="destructive">Lanjut</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)} disabled={isDeleting}>Kembali</Button>
                            <Button
                                onClick={handleCleanup}
                                variant="destructive"
                                disabled={confirmationText !== "DELETE DATA" || isDeleting}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Hapus Permanen
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
