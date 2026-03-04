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
        bg: "bg-white dark:bg-slate-900",
        text: "text-slate-800 dark:text-slate-100",
        label: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-600",
        border: "border-slate-100 dark:border-slate-800",
    },
    success: {
        bg: "bg-white dark:bg-slate-900",
        text: "text-slate-800 dark:text-slate-100",
        label: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        border: "border-slate-100 dark:border-slate-800",
    },
    warning: {
        bg: "bg-white dark:bg-slate-900",
        text: "text-slate-800 dark:text-slate-100",
        label: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        border: "border-slate-100 dark:border-slate-800",
    },
    danger: {
        bg: "bg-white dark:bg-slate-900",
        text: "text-slate-800 dark:text-slate-100",
        label: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-rose-50",
        iconColor: "text-rose-600",
        border: "border-slate-100 dark:border-slate-800",
    },
    info: {
        bg: "bg-white dark:bg-slate-900",
        text: "text-slate-800 dark:text-slate-100",
        label: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        border: "border-slate-100 dark:border-slate-800",
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
                "rounded-[20px] p-6 relative overflow-hidden shadow-sm border transition-all cursor-default",
                styles.bg,
                styles.border,
                className
            )}>
                <div className="animate-pulse flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="h-4 w-24 bg-slate-200 rounded-md" />
                        <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800/80 rounded-xl" />
                    </div>
                    <div className="h-10 w-20 bg-slate-200 rounded-lg mt-2" />
                    <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/80 rounded-md mt-1" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "relative group rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden border",
            styles.bg,
            styles.border,
            className
        )}>
            <div className="relative z-10 flex flex-col h-full">

                <div className="flex items-start justify-between mb-4">
                    <p className={cn("text-sm font-medium", styles.label)}>{title}</p>

                    <div className="flex items-center gap-2">
                        {Icon && (
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", styles.iconBg, styles.iconColor)}>
                                <Icon className="w-5 h-5" strokeWidth={2} />
                            </div>
                        )}
                        {(onViewDetails || onExport) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 rounded-full"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-xl rounded-xl">
                                    {onViewDetails && (
                                        <DropdownMenuItem onClick={onViewDetails} className="cursor-pointer text-sm font-medium hover:bg-slate-50 dark:bg-slate-800">
                                            Lihat Detail
                                        </DropdownMenuItem>
                                    )}
                                    {onExport && (
                                        <DropdownMenuItem onClick={onExport} className="cursor-pointer text-sm font-medium hover:bg-slate-50 dark:bg-slate-800">
                                            Export Data
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <div className="flex items-baseline gap-2 mt-auto">
                    <span className={cn("text-3xl font-bold tracking-tight", styles.text)}>
                        {typeof value === "number" ? value.toLocaleString() : value}
                    </span>
                    {unit && (
                        <span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                    {trend && (
                        <div className={cn(
                            "px-2 py-0.5 rounded-md flex items-center gap-1 text-xs font-medium border",
                            trend.direction === "up"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                            {trend.direction === "up" ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{trend.value}</span>
                        </div>
                    )}

                    {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
