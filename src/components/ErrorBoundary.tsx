
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                        <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
                        <p className="text-slate-500 mb-6">
                            The application encountered an unexpected error. Please try reloading the page.
                        </p>
                        {this.state.error && (
                            <div className="mb-6 p-3 bg-red-50 rounded-lg text-left overflow-auto max-h-32">
                                <p className="text-xs font-mono text-red-800 break-all">{this.state.error.toString()}</p>
                            </div>
                        )}
                        <Button
                            onClick={this.handleReload}
                            className="w-full bg-blue-700 hover:bg-blue-800 gap-2"
                        >
                            <RefreshCw className="h-4 w-4" /> Reload Application
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
