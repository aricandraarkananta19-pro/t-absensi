
import { Search, Calendar as CalendarIcon, Filter, X } from "lucide-react";
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

    return (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 p-4 bg-white/70 backdrop-blur-md rounded-[20px] border border-white/60 shadow-sm shadow-slate-200/40 vibe-glass-card">

            {/* Search */}
            <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search by Employee, ID, or Content..."
                    className="pl-10 bg-white/50 border-slate-200/60 rounded-xl h-10 font-medium focus:bg-white transition-all"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Filters Group */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

                {/* Department Filter */}
                <Select value={department} onValueChange={onDepartmentChange}>
                    <SelectTrigger className="w-[160px] bg-white/50 border-slate-200/60 rounded-xl h-10 font-medium">
                        <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="IT">IT Dept</SelectItem>
                        <SelectItem value="HR">Human Resources</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                    </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={status} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-[140px] bg-white/50 border-slate-200/60 rounded-xl h-10 font-medium">
                        <SelectValue placeholder="Status: All" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Status: All</SelectItem>
                        <SelectItem value="submitted">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="need_revision">Revision</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>

                {/* Date Picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[160px] justify-start text-left font-medium bg-white/50 border-slate-200/60 rounded-xl h-10",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Date Range</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={onDateChange}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>

                {/* Reset */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onReset}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Reset Filters"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
