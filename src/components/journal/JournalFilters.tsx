
import { Search, Calendar as CalendarIcon, Filter, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

    const hasActiveFilters = status !== 'all' || department !== 'all' || date || search;
    const activeCount = [status !== 'all', department !== 'all', !!date, !!search].filter(Boolean).length;

    return (
        <div className="space-y-4 mb-6">
            {/* Search Bar - Full Width */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                <Input
                    placeholder="Cari berdasarkan nama karyawan, konten jurnal..."
                    className="pl-11 pr-4 bg-white border-slate-200 rounded-2xl h-12 font-medium text-sm shadow-sm focus:shadow-md focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                {search && (
                    <button
                        onClick={() => onSearchChange("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500 shrink-0">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Filter</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Department Filter */}
                    <Select value={department} onValueChange={onDepartmentChange}>
                        <SelectTrigger className="w-auto min-w-[150px] bg-white border-slate-200 rounded-xl h-10 text-sm font-medium shadow-sm hover:border-slate-300 transition-colors data-[state=open]:border-blue-400 data-[state=open]:ring-2 data-[state=open]:ring-blue-100">
                            <SelectValue placeholder="Departemen" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-slate-200">
                            <SelectItem value="all">Semua Departemen</SelectItem>
                            <SelectItem value="IT">IT</SelectItem>
                            <SelectItem value="HR">Human Resources</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Operations">Operations</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={status} onValueChange={onStatusChange}>
                        <SelectTrigger className="w-auto min-w-[140px] bg-white border-slate-200 rounded-xl h-10 text-sm font-medium shadow-sm hover:border-slate-300 transition-colors data-[state=open]:border-blue-400 data-[state=open]:ring-2 data-[state=open]:ring-blue-100">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-slate-200">
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="submitted">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    Pending
                                </span>
                            </SelectItem>
                            <SelectItem value="approved">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Approved
                                </span>
                            </SelectItem>
                            <SelectItem value="need_revision">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    Revisi
                                </span>
                            </SelectItem>
                            <SelectItem value="rejected">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    Ditolak
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "min-w-[150px] justify-start text-left text-sm font-medium bg-white border-slate-200 rounded-xl h-10 shadow-sm hover:border-slate-300 transition-colors",
                                    date && "border-blue-300 bg-blue-50/50 text-blue-700",
                                    !date && "text-slate-500"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                {date ? format(date, "d MMM yyyy", { locale: localeId }) : "Pilih Tanggal"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-xl shadow-xl border-slate-200" align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={onDateChange}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Reset */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl gap-2 h-10 px-4 shrink-0 transition-all"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Reset{activeCount > 0 ? ` (${activeCount})` : ""}</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
