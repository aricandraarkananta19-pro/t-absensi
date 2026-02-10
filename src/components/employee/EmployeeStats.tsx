
import { Users, CheckCircle2, Tent, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmployeeStatsProps {
    total: number;
    active: number;
    onLeave: number;
    departments: number;
    isLoading?: boolean;
}

export function EmployeeStats({ total, active, onLeave, departments, isLoading = false }: EmployeeStatsProps) {
    const stats = [
        {
            label: "Total Karyawan",
            value: total,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
            badge: "+4 new", // Static for now, or dynamic if we have data
            badgeColor: "bg-blue-100 text-blue-700"
        },
        {
            label: "Karyawan Aktif",
            value: active,
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50",
        },
        {
            label: "Karyawan Cuti",
            value: onLeave,
            icon: Tent, // Vacation icon
            color: "text-orange-600",
            bg: "bg-orange-50",
            sub: "Applications"
        },
        {
            label: "Departemen",
            value: departments,
            icon: Building2,
            color: "text-purple-600",
            bg: "bg-purple-50",
        }
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse border border-slate-100" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <Card key={index} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-bold text-slate-900">{stat.value}</h3>
                                {stat.badge && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stat.badgeColor}`}>
                                        {stat.badge}
                                    </span>
                                )}
                            </div>
                            {stat.sub && (
                                <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                            )}
                        </div>
                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
