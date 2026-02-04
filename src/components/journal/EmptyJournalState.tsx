import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Calendar, FileText } from "lucide-react";

interface EmptyJournalStateProps {
    title?: string;
    description?: string;
    ctaLabel?: string;
    onCta?: () => void;
    variant?: 'default' | 'filter' | 'week';
}

export function EmptyJournalState({
    title,
    description,
    ctaLabel = "Tulis Jurnal",
    onCta,
    variant = 'default'
}: EmptyJournalStateProps) {
    // Different illustrations and messages based on variant
    const config = {
        default: {
            icon: BookOpen,
            iconBg: "bg-gradient-to-br from-blue-100 to-indigo-100",
            iconColor: "text-blue-500",
            title: title || "Belum ada jurnal",
            description: description || "Dokumentasikan aktivitas kerja Anda hari ini. Catatan yang detail membantu tracking produktivitas."
        },
        filter: {
            icon: FileText,
            iconBg: "bg-slate-100",
            iconColor: "text-slate-400",
            title: title || "Tidak ada hasil",
            description: description || "Tidak ada jurnal yang cocok dengan filter yang dipilih."
        },
        week: {
            icon: Calendar,
            iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
            iconColor: "text-amber-500",
            title: title || "Belum ada jurnal minggu ini",
            description: description || "Anda belum mencatat aktivitas kerja minggu ini. Mulai tulis jurnal pertama!"
        }
    };

    const currentConfig = config[variant];
    const IconComponent = currentConfig.icon;

    return (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border-2 border-dashed border-slate-200 animate-fade-in">
            {/* Illustration */}
            <div className={`
                w-20 h-20 ${currentConfig.iconBg} rounded-2xl 
                flex items-center justify-center mx-auto mb-6
                shadow-sm
            `}>
                <IconComponent className={`w-10 h-10 ${currentConfig.iconColor}`} />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-slate-800 mb-2">
                {currentConfig.title}
            </h3>

            {/* Description */}
            <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm leading-relaxed">
                {currentConfig.description}
            </p>

            {/* CTA Button */}
            {variant !== 'filter' && onCta && (
                <Button
                    onClick={onCta}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                    size="lg"
                >
                    <Plus className="w-5 h-5" />
                    {ctaLabel}
                </Button>
            )}

            {/* Friendly hint */}
            {variant === 'default' && (
                <p className="mt-6 text-xs text-slate-400 max-w-xs mx-auto">
                    💡 <strong>Tips:</strong> Jurnal harian membantu Manager memahami progres dan tantangan timnya.
                </p>
            )}
        </div>
    );
}

export default EmptyJournalState;
