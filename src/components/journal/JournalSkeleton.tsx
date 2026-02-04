import { Skeleton } from "@/components/ui/skeleton";

export const JournalSkeleton = () => {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex gap-4">
                        <Skeleton className="h-11 w-11 rounded-full" />
                        <div className="flex-1 space-y-3">
                            <div className="flex justify-between">
                                <div className="w-1/3">
                                    <Skeleton className="h-4 w-32 mb-2" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <Skeleton className="h-8 w-24 rounded-lg" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <div className="pt-2 flex justify-end gap-2">
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const JournalStatsSkeleton = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white shadow-sm border border-slate-200 rounded-xl p-4 h-24 flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-12" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
            ))}
        </div>
    )
}
