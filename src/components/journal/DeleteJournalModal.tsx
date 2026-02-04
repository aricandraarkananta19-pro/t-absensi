import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeleteJournalModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    isDeleting?: boolean;
    journalDate?: string;
}

export function DeleteJournalModal({
    open,
    onOpenChange,
    onConfirm,
    isDeleting = false,
    journalDate
}: DeleteJournalModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader className="space-y-4">
                    {/* Warning Icon */}
                    <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-red-600" />
                    </div>

                    <DialogTitle className="text-center text-lg font-bold text-slate-800">
                        Hapus Jurnal?
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-600">
                        {journalDate && (
                            <span className="block text-sm text-slate-500 mb-2">
                                Jurnal tanggal: <strong>{journalDate}</strong>
                            </span>
                        )}
                        <span className="block">
                            Jurnal yang dihapus <strong className="text-red-600">tidak dapat dikembalikan</strong>.
                        </span>
                        <span className="block mt-2 text-sm">
                            Apakah Anda yakin ingin melanjutkan?
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                        className="flex-1"
                    >
                        Tidak, Batalkan
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? "Menghapus..." : "Ya, Hapus Jurnal"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default DeleteJournalModal;
