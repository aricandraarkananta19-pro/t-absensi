import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-slate-50">
                    <div className="rounded-full bg-red-100 p-4 mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        Terjadi Kesalahan
                    </h1>
                    <p className="text-slate-600 mb-6 max-w-sm text-sm">
                        Maaf, aplikasi mengalami masalah saat memuat halaman ini. Silakan coba muat ulang.
                    </p>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 w-full max-w-md overflow-auto shadow-sm text-left">
                        <p className="text-xs text-red-500 font-mono break-all">{this.state.error?.message}</p>
                    </div>
                    <Button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-200"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Muat Ulang Aplikasi
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
