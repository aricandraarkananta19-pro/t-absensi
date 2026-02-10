
import {
    MoreHorizontal, Edit, Trash2, Mail, Phone, Building2, Briefcase, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Define the Employee interface matching the data we have
export interface EmployeeData {
    id: string;
    user_id: string;
    full_name: string | null;
    email?: string;
    phone: string | null;
    department: string | null;
    position: string | null;
    role?: string;
    avatar_url?: string | null;
    created_at?: string;
    status?: 'active' | 'inactive' | 'on_leave'; // Augmented field
}

interface EmployeeTableProps {
    data: EmployeeData[];
    isLoading: boolean;
    onEdit: (employee: EmployeeData) => void;
    onDelete: (employee: EmployeeData) => void;
    // Pagination props
    page: number;
    totalPages: number;
    totalRecords: number;
    onPageChange: (page: number) => void;
    isArchivedView?: boolean;
    onRestore?: (employee: EmployeeData) => void;
}

export function EmployeeTable({
    data,
    isLoading,
    onEdit,
    onDelete,
    page,
    totalPages,
    totalRecords,
    onPageChange,
    isArchivedView,
    onRestore
}: EmployeeTableProps) {

    // Helper for Status Badge
    const getStatusBadge = (employee: EmployeeData) => {
        if (isArchivedView) {
            return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none font-medium">Archived</Badge>;
        }

        // Since we don't have a real 'status' column in DB yet, we infer it or use role/active state
        // For mockup purposes:
        const status = employee.status || 'active';

        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-medium">Active</Badge>;
            case 'inactive':
                return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none font-medium">Inactive</Badge>;
            case 'on_leave':
                return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none font-medium">On Leave</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };

    // Generate a consistent pseudo-NIP based on created_at or ID for mockup visual
    const getNIP = (emp: EmployeeData) => {
        const year = emp.created_at ? new Date(emp.created_at).getFullYear() : '2024';
        const suffix = emp.id.substring(0, 4).toUpperCase();
        return `${year}${suffix}`;
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse" />
                        <div className="space-y-2 flex-1">
                            <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
                            <div className="h-3 w-1/4 bg-slate-100 rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="min-w-[250px] pl-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider">Employee Profile</TableHead>
                            <TableHead className="min-w-[100px] font-semibold text-slate-600 text-xs uppercase tracking-wider">NIP</TableHead>
                            <TableHead className="min-w-[150px] font-semibold text-slate-600 text-xs uppercase tracking-wider">Department</TableHead>
                            <TableHead className="min-w-[150px] font-semibold text-slate-600 text-xs uppercase tracking-wider">Position</TableHead>
                            <TableHead className="min-w-[100px] font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</TableHead>
                            <TableHead className="w-[80px] text-right pr-6 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                                    {isArchivedView ? "No archived employees found." : "No employees found."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((employee) => (
                                <TableRow key={employee.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100 last:border-0">
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
                                                <AvatarImage src={employee.avatar_url || undefined} />
                                                <AvatarFallback className={cn(
                                                    "text-xs font-bold",
                                                    employee.role === 'admin' ? "bg-red-50 text-red-600" :
                                                        employee.role === 'manager' ? "bg-amber-50 text-amber-600" :
                                                            "bg-blue-50 text-blue-600"
                                                )}>
                                                    {employee.full_name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                                                    {employee.full_name}
                                                </span>
                                                <span className="text-xs text-slate-500 line-clamp-1 font-normal">
                                                    {employee.email}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600 border-none font-medium">
                                            {getNIP(employee)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-slate-700 font-medium">
                                            {employee.department || "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-slate-600">
                                            {employee.position || "Employee"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(employee)}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px]">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                {!isArchivedView ? (
                                                    <>
                                                        <DropdownMenuItem onClick={() => onEdit(employee)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => onDelete(employee)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Archive
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : (
                                                    <DropdownMenuItem className="text-blue-600 focus:text-blue-700 focus:bg-blue-50" onClick={() => onRestore?.(employee)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Restore
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/30 mt-auto">
                <span className="text-sm text-slate-500 font-medium">
                    Showing <span className="text-slate-900 font-bold">{data.length > 0 ? (page - 1) * 20 + 1 : 0}</span> to <span className="text-slate-900 font-bold">{Math.min(page * 20, totalRecords)}</span> of <span className="text-slate-900 font-bold">{totalRecords}</span> results
                </span>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => onPageChange(page - 1)}
                        className="h-8 px-3 bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                        className="h-8 px-3 bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
