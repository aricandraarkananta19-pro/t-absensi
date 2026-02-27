import { TrendingUp, TrendingDown, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

interface StatCardProps {
    title: string;
    value: string | number;
    unit?: string;
    trend?: {
        value: string;
        direction: "up" | "down";
    };
    subtitle?: string;
    icon?: React.ElementType;
    color?: "primary" | "success" | "warning" | "danger" | "info";
    isLoading?: boolean;
    onViewDetails?: () => void;
    onExport?: () => void;
    className?: string;
}

const colorStyles = {
    primary: {
        bg: "bg-gradient-to-br from-blue-700 to-indigo-700",
        shadow: "shadow-blue-600/20 hover:shadow-blue-500/40",
    },
    success: {
        bg: "bg-gradient-to-br from-emerald-600 to-teal-600",
        shadow: "shadow-emerald-600/20 hover:shadow-emerald-500/40",
    },
    warning: {
        bg: "bg-gradient-to-br from-amber-600 to-orange-600",
        shadow: "shadow-amber-600/20 hover:shadow-amber-500/40",
    },
    danger: {
        bg: "bg-gradient-to-br from-red-600 to-rose-600",
        shadow: "shadow-red-600/20 hover:shadow-red-500/40",
    },
    info: {
        bg: "bg-gradient-to-br from-purple-600 to-fuchsia-600",
        shadow: "shadow-purple-600/20 hover:shadow-purple-500/40",
    },
};

const StatCard = ({
    title,
    value,
    unit,
    trend,
    subtitle,
    icon: Icon,
    color = "primary",
    isLoading = false,
    onViewDetails,
    onExport,
    className,
}: StatCardProps) => {
    const styles = colorStyles[color] || colorStyles.primary;

    if (isLoading) {
        return (
            <div className={cn(
                "rounded-2xl p-6 relative overflow-hidden shadow-lg border border-white/10 transition-all cursor-default",
                styles.bg,
                className
            )}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/40 to-transparent" />
                <div className="animate-pulse">
                    <div className="h-4 w-32 bg-white/20 rounded-md mb-4" />
                    <div className="h-10 w-24 bg-white/30 rounded-lg mb-3" />
                    <div className="h-3 w-40 bg-white/20 rounded-md" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "relative group rounded-2xl p-6 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden border border-white/10",
            styles.bg,
            styles.shadow,
            className
        )}>
            {/* Top Border Gradient Strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/40 to-transparent" />

            {/* Glowing orb effect on hover */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 blur-2xl rounded-full transition-opacity opacity-0 group-hover:opacity-100" />

            {/* Giant Background Icon with 5% opacity */}
            {Icon && (
                <Icon
                    className="absolute -bottom-6 -right-4 w-32 h-32 text-white opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none"
                    strokeWidth={1.5}
                />
            )}

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">{title}</p>
                    {(onViewDetails || onExport) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 -mr-2 -mt-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-white/95 backdrop-blur-md border-slate-100 shadow-xl rounded-xl">
                                {onViewDetails && (
                                    <DropdownMenuItem onClick={onViewDetails} className="cursor-pointer text-sm font-medium hover:bg-slate-50 text-slate-700">
                                        Lihat Detail
                                    </DropdownMenuItem>
                                )}
                                {onExport && (
                                    <DropdownMenuItem onClick={onExport} className="cursor-pointer text-sm font-medium hover:bg-slate-50 text-slate-700">
                                        Export Data
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                        {typeof value === "number" ? value.toLocaleString() : value}
                    </span>
                    {unit && (
                        <span className="text-sm font-medium text-white/70 ml-1">{unit}</span>
                    )}
                </div>

                <div className="flex items-center gap-3 mt-1">
                    {trend && (
                        <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                            {trend.direction === "up" ? (
                                <TrendingUp className="h-3 w-3 text-white" />
                            ) : (
                                <TrendingDown className="h-3 w-3 text-white" />
                            )}
                            <span className="text-[10px] font-bold text-white tracking-widest uppercase">
                                {trend.value}
                            </span>
                        </div>
                    )}

                    {subtitle && (
                        <p className="text-xs text-white/70 font-semibold uppercase tracking-widest drop-shadow-sm">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
