
import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    MoreHorizontal, ArrowUpDown, ChevronDown, CheckSquare, Square,
    ExternalLink, Eye, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { JournalCardData } from "@/components/journal/JournalCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface JournalTableProps {
    data: JournalCardData[];
    selectedIds: string[];
    onSelect: (id: string, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onView: (journal: JournalCardData) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    isLoading?: boolean;
}

export function JournalTable({
    data,
    selectedIds,
    onSelect,
    onSelectAll,
    onView,
    onApprove,
    onReject,
    isLoading = false
}: JournalTableProps) {
    const isAllSelected = data.length > 0 && selectedIds.length === data.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < data.length;

    // Helper for badges
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Approved</Badge>;
            case 'need_revision':
                return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Revision</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Rejected</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Pending</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 w-full bg-slate-50 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                                checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                onCheckedChange={(checked) => onSelectAll(!!checked)}
                            />
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                            Date
                        </TableHead>
                        <TableHead className="min-w-[200px]">Employee</TableHead>
                        <TableHead className="min-w-[150px]">Department</TableHead>
                        <TableHead className="hidden md:table-cell w-full">Activity / Title</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                No journals found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((journal) => {
                            const isSelected = selectedIds.includes(journal.id);
                            const profile = (journal as any).profiles || {};
                            const status = journal.verification_status || 'submitted';
                            const title = (journal as any).title || (journal.content.length > 50 ? journal.content.substring(0, 50) + "..." : journal.content);

                            return (
                                <TableRow
                                    key={journal.id}
                                    className={cn(
                                        "group hover:bg-slate-50/50 transition-colors cursor-pointer",
                                        isSelected && "bg-blue-50/30 hover:bg-blue-50/50"
                                    )}
                                // Allow row click to view? Maybe just view action.
                                // onClick={() => onView(journal)}
                                >
                                    <TableCell className="py-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => onSelect(journal.id, !!checked)}
                                            // Stop propagation to prevent row click if we add it later
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700">
                                        {format(new Date(journal.date), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-slate-100">
                                                <AvatarImage src={profile.avatar_url} />
                                                <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                                                    {profile.full_name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                                                    {profile.full_name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    ID: {journal.user_id.substring(0, 6).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-slate-50 text-slate-600 font-normal border-slate-200">
                                            {profile.department || "General"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell max-w-[300px]">
                                        <span className="text-sm text-slate-600 line-clamp-1" title={journal.content}>
                                            {title}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(status)}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onView(journal)}>
                                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onApprove(journal.id)}>
                                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Approve
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onReject(journal.id)}>
                                                    <XCircle className="mr-2 h-4 w-4 text-red-600" /> Reject
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>

            {/* Pagination Footer - Simplified for now */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                    Showing {data.length > 0 ? 1 : 0} to {data.length} entries
                </div>
                {/* Add standard navigation if needed */}
            </div>
        </div>
    );
}
