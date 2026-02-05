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
        gradient: `linear-gradient(90deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`,
        bg: "bg-blue-50",
        text: "text-blue-700",
        iconBg: "bg-blue-50",
        iconColor: BRAND_COLORS.blue,
    },
    success: {
        gradient: `linear-gradient(90deg, ${BRAND_COLORS.green} 0%, #8BC34A 100%)`,
        bg: "bg-green-50",
        text: "text-green-700",
        iconBg: "bg-green-50",
        iconColor: BRAND_COLORS.green,
    },
    warning: {
        gradient: "linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)",
        bg: "bg-amber-50",
        text: "text-amber-700",
        iconBg: "bg-amber-50",
        iconColor: "#F59E0B",
    },
    danger: {
        gradient: "linear-gradient(90deg, #EF4444 0%, #F87171 100%)",
        bg: "bg-red-50",
        text: "text-red-700",
        iconBg: "bg-red-50",
        iconColor: "#EF4444",
    },
    info: {
        gradient: `linear-gradient(90deg, ${BRAND_COLORS.lightBlue} 0%, #38BDF8 100%)`,
        bg: "bg-cyan-50",
        text: "text-cyan-700",
        iconBg: "bg-cyan-50",
        iconColor: BRAND_COLORS.lightBlue,
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
    const styles = colorStyles[color];

    if (isLoading) {
        return (
            <div className={cn(
                "bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden shadow-sm",
                className
            )}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: styles.gradient }} />
                <div className="animate-pulse">
                    <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                    <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-32 bg-slate-200 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden",
            "hover:shadow-lg hover:border-blue-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out group",
            "shadow-sm cursor-default",
            className
        )}>
            {/* Top Border Accent */}
            <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: styles.gradient }}
            />

            {/* Background Icon */}
            {Icon && (
                <Icon
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-20 w-20 opacity-[0.06] transition-opacity group-hover:opacity-[0.1]"
                    style={{ color: styles.iconColor }}
                />
            )}

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    {(onViewDetails || onExport) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 -mr-2 -mt-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                {onViewDetails && (
                                    <DropdownMenuItem onClick={onViewDetails}>
                                        Lihat Detail
                                    </DropdownMenuItem>
                                )}
                                {onExport && (
                                    <DropdownMenuItem onClick={onExport}>
                                        Export Data
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-3xl font-bold text-slate-900 tracking-tight">
                        {typeof value === "number" ? value.toLocaleString() : value}
                    </span>
                    {unit && (
                        <span className="text-sm font-medium text-slate-400">{unit}</span>
                    )}
                </div>

                {trend && (
                    <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                        trend.direction === "up"
                            ? "bg-green-50 text-green-600"
                            : "bg-red-50 text-red-600"
                    )}
                        style={trend.direction === "up" ? { color: BRAND_COLORS.green } : undefined}
                    >
                        {trend.direction === "up" ? (
                            <TrendingUp className="h-3 w-3" />
                        ) : (
                            <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{trend.value}</span>
                    </div>
                )}

                {subtitle && (
                    <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
