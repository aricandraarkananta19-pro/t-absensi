import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileEdit, Send, Eye, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { JournalCardData } from "./JournalCard";

interface JournalSummaryViewProps {
    journal: JournalCardData;
    onAction: (journal: JournalCardData) => void;
}

export function JournalSummaryView({ journal, onAction }: JournalSummaryViewProps) {
    const status = journal.verification_status;

    // Determine CTA Configuration
    const getConfig = () => {
        switch (status) {
            case 'draft':
                return {
                    title: "Lanjutkan Jurnal Draft",
                    description: "Anda memiliki draft jurnal yang belum dikirim. Lanjutkan pengisian untuk mengirim laporan.",
                    ctaText: "Lanjutkan",
                    ctaIcon: FileEdit,
                    ctaVariant: "default" as const,
                    statusLabel: "Draft",
                    statusColor: "text-slate-600 bg-slate-100"
                };
            case 'need_revision':
                return {
                    title: "Perlu Revisi",
                    description: "Manager memberikan catatan revisi pada jurnal Anda. Silakan perbaiki dan kirim ulang.",
                    ctaText: "Perbaiki Sekarang",
                    ctaIcon: RefreshCw,
                    ctaVariant: "destructive" as const,
                    statusLabel: "Revisi Diperlukan",
                    statusColor: "text-orange-600 bg-orange-100"
                };
            case 'submitted':
                return {
                    title: "Menunggu Review",
                    description: "Jurnal Anda sudah terkirim dan sedang menunggu review dari Manager.",
                    ctaText: "Lihat Detail",
                    ctaIcon: Eye,
                    ctaVariant: "outline" as const,
                    statusLabel: "Menunggu Review",
                    statusColor: "text-blue-600 bg-blue-100"
                };
            case 'approved':
                return {
                    title: "Disetujui",
                    description: "Jurnal Anda telah disetujui oleh Manager.",
                    ctaText: "Lihat Detail",
                    ctaIcon: CheckCircle2,
                    ctaVariant: "outline" as const,
                    statusLabel: "Disetujui",
                    statusColor: "text-green-600 bg-green-100"
                };
            default:
                return {
                    title: "Jurnal Hari Ini",
                    description: "Status jurnal anda saat ini.",
                    ctaText: "Lihat",
                    ctaIcon: Eye,
                    ctaVariant: "outline" as const,
                    statusLabel: status,
                    statusColor: "text-gray-600 bg-gray-100"
                };
        }
    };

    const config = getConfig();
    const CtaIcon = config.ctaIcon;

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-6">

                {/* Status Icon Wrapper */}
                <div className={`p-4 rounded-3xl ${config.statusColor} bg-opacity-20 mb-4 animate-in zoom-in duration-300`}>
                    <CtaIcon className={`w-12 h-12 ${config.statusColor.split(' ')[0]}`} />
                </div>

                <div className="space-y-2 max-w-md">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge variant="outline" className={`${config.statusColor} border-0 font-bold uppercase tracking-wider`}>
                            {config.statusLabel}
                        </Badge>
                        <span className="text-sm font-medium text-slate-400">
                            {format(new Date(journal.date), "d MMMM yyyy", { locale: id })}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900">
                        {config.title}
                    </h2>
                    <p className="text-slate-500 leading-relaxed">
                        {config.description}
                    </p>
                </div>

                <div className="w-full max-w-xs pt-4">
                    <Button
                        size="lg"
                        className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                        variant={config.ctaVariant}
                        onClick={() => onAction(journal)}
                    >
                        <CtaIcon className="w-5 h-5 mr-2" />
                        {config.ctaText}
                    </Button>
                </div>
            </div>

            {/* Quick Preview Section */}
            <div className="p-6 bg-white border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Preview Isi Jurnal
                </p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-600 line-clamp-3 italic">
                        "{journal.content}"
                    </p>
                </div>
            </div>
        </div>
    );
}
