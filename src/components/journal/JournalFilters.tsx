import { useState } from "react";
import { Search, Calendar as CalendarIcon, Filter, X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface JournalFiltersProps {
    search: string;
    onSearchChange: (val: string) => void;
    status: string;
    onStatusChange: (val: string) => void;
    department: string;
    onDepartmentChange: (val: string) => void;
    date: Date | undefined;
    onDateChange: (date: Date | undefined) => void;
    onReset: () => void;
}

export function JournalFilters({
    search, onSearchChange,
    status, onStatusChange,
    department, onDepartmentChange,
    date, onDateChange,
    onReset
}: JournalFiltersProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const hasActiveAdvancedFilters = department !== 'all' || date !== undefined;
    const activeCount = [status !== 'all', department !== 'all', !!date, !!search].filter(Boolean).length;

    return (
        <div className="w-full mb-8 space-y-4">
            {/* Quick Segmented Control for Status */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                {/* Status Tabs */}
                <div className="bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center min-w-max gap-1">
                        {['all', 'submitted', 'approved', 'need_revision', 'rejected'].map(s => {
                            const labels: Record<string, string> = {
                                all: "Semua Aktivitas",
                                submitted: "Pending Review",
                                approved: "Approved",
                                need_revision: "Revisi",
                                rejected: "Ditolak"
                            };
                            return (
                                <button
                                    key={s}
                                    onClick={() => onStatusChange(s)}
                                    className={cn(
                                        "px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all duration-300 relative overflow-hidden",
                                        status === s
                                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] border border-slate-200/60"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 hover:bg-slate-200/60"
                                    )}
                                >
                                    {labels[s]}
                                    {status === s && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-blue-500 rounded-t-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Search Bar aligned right */}
                <div className="relative w-full md:w-[320px] shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search workspace..."
                        className="pl-11 pr-10 bg-white dark:bg-slate-900 border-slate-200/80 rounded-2xl h-11 font-medium text-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 transition-all border outline-none"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => onSearchChange("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100 dark:bg-slate-800/80 text-slate-400 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Trigger */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="w-full">
                <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:bg-slate-800/80 rounded-xl h-9 px-3 gap-2 font-bold text-xs"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Filter Lanjutan
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isAdvancedOpen ? "rotate-180" : "rotate-0")} />

                            {hasActiveAdvancedFilters && !isAdvancedOpen && (
                                <span className="flex h-2 w-2 rounded-full bg-blue-500 absolute top-2 right-2 animate-pulse" />
                            )}
                        </Button>
                    </CollapsibleTrigger>

                    {activeCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReset}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-9 px-3 font-bold text-xs gap-1.5 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" /> Close Filters ({activeCount})
                        </Button>
                    )}
                </div>

                <CollapsibleContent className="CollapsibleContent mt-3">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[20px] p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Department Filter */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Departemen</span>
                                <Select value={department} onValueChange={onDepartmentChange}>
                                    <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl h-11 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:ring-4 focus:ring-blue-500/10">
                                        <SelectValue placeholder="Semua Departemen" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-700 shadow-xl p-1">
                                        <SelectItem value="all" className="rounded-xl font-medium text-sm my-0.5 focus:bg-slate-100 dark:bg-slate-800/80">Semua Departemen</SelectItem>
                                        {['IT', 'HR', 'Finance', 'Marketing', 'Operations'].map((dept) => (
                                            <SelectItem key={dept} value={dept} className="rounded-xl font-medium text-sm my-0.5 focus:bg-slate-100 dark:bg-slate-800/80">{dept}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Filter */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tanggal Mulai</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left text-sm font-semibold bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl h-11 shadow-sm transition-colors",
                                                date ? "border-blue-300 bg-blue-50/50 text-blue-700" : "text-slate-500 dark:text-slate-400"
                                            )}
                                        >
                                            <CalendarIcon className="mr-3 h-4 w-4 shrink-0" />
                                            {date ? format(date, "d MMMM yyyy", { locale: localeId }) : "Semua Waktu"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-4 rounded-[24px] shadow-xl border-slate-200 dark:border-slate-700" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={onDateChange}
                                            initialFocus
                                            className="font-medium"
                                        />
                                        {date && (
                                            <Button variant="ghost" className="w-full mt-3 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold" onClick={() => onDateChange(undefined)}>
                                                Clear Date
                                            </Button>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Visual Placeholder for more filters later to make it look advanced */}
                            <div className="flex flex-col gap-2 opacity-50 pointer-events-none hidden md:flex">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Prioritas (Soon)</span>
                                <Select disabled>
                                    <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl h-11 text-sm font-semibold text-slate-400 shadow-sm">
                                        <SelectValue placeholder="Semua Prioritas" />
                                    </SelectTrigger>
                                    <SelectContent><SelectItem value="all">Semua</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
