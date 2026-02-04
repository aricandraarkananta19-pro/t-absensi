import * as React from "react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { JournalForm, JournalFormData } from "./JournalForm";

interface JournalFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: JournalFormData, isDraft: boolean, isSilent?: boolean) => Promise<void>;
    initialData?: Partial<JournalFormData>;
    isEditing?: boolean;
    isRevision?: boolean; // When editing a journal that needs revision
    managerNotes?: string; // Show manager feedback when in revision mode
    existingDates?: string[];
    onRequestEdit?: (date: string) => void;
    isDateLocked?: boolean;
}

export type { JournalFormData };

export function JournalFormModal({
    open,
    onOpenChange,
    onSave,
    initialData,
    isEditing = false,
    isRevision = false,
    managerNotes,
    existingDates,
    onRequestEdit,
    isDateLocked
}: JournalFormModalProps) {

    const isMobile = useIsMobile();
    const [isDesktop, setIsDesktop] = useState(!isMobile);

    useEffect(() => {
        setIsDesktop(!isMobile);
    }, [isMobile]);

    const handleCancel = () => {
        onOpenChange(false);
    };

    // Desktop: Dialog
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-800">
                            {isRevision
                                ? "✏️ Revisi Jurnal Aktivitas"
                                : isEditing
                                    ? "✏️ Edit Jurnal Aktivitas"
                                    : "📝 Apa yang kamu kerjakan hari ini?"
                            }
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {isRevision
                                ? "Perbaiki jurnal sesuai catatan dari Manager, lalu kirim ulang."
                                : "Catatan ini akan dibaca oleh Manager dan Admin."
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto -mr-6 pr-6 pt-2">
                        <JournalForm
                            initialData={initialData}
                            isEditing={isEditing}
                            isRevision={isRevision}
                            managerNotes={managerNotes}
                            onSave={onSave}
                            onCancel={handleCancel}
                            existingDates={existingDates}
                            onRequestEdit={onRequestEdit}
                            isDateLocked={isDateLocked}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile: Drawer
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[95vh] flex flex-col h-full rounded-t-[20px]">
                <DrawerHeader className="text-left shrink-0">
                    <DrawerTitle className="text-lg font-bold text-slate-800">
                        {isRevision
                            ? "✏️ Revisi Jurnal"
                            : isEditing
                                ? "✏️ Edit Jurnal"
                                : "📝 Apa yang kamu kerjakan hari ini?"
                        }
                    </DrawerTitle>
                    <DrawerDescription className="text-slate-500 text-sm">
                        {isRevision
                            ? "Perbaiki sesuai catatan Manager."
                            : "Catatan ini akan dibaca oleh Manager."
                        }
                    </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 flex-1 overflow-hidden">
                    <JournalForm
                        initialData={initialData}
                        isEditing={isEditing}
                        isRevision={isRevision}
                        managerNotes={managerNotes}
                        onSave={onSave}
                        onCancel={handleCancel}
                        existingDates={existingDates}
                        onRequestEdit={onRequestEdit}
                        isDateLocked={isDateLocked}
                    />
                </div>
            </DrawerContent>
        </Drawer>
    );
}

export default JournalFormModal;
