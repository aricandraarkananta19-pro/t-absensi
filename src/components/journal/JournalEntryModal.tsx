
import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mic, Sparkles, Send, X } from "lucide-react"

interface JournalEntryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (journal: string) => void
    onSkip: () => void
    duration: string // e.g. "8h 15m"
}

export function JournalEntryModal({
    open,
    onOpenChange,
    onSave,
    onSkip,
    duration
}: JournalEntryModalProps) {
    const [isDesktop, setIsDesktop] = React.useState(window.innerWidth > 768)
    const [journalText, setJournalText] = React.useState("")
    const [isListening, setIsListening] = React.useState(false)

    React.useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth > 768)
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    const handleSubmit = () => {
        onSave(journalText)
        setJournalText("")
    }

    const Content = (
        <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="flex flex-col">
                    <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Total Session</span>
                    <span className="text-lg font-bold text-blue-900">{duration}</span>
                </div>
                <div className="h-8 w-8 bg-blue-200 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-blue-700 text-xs">AI</span>
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="journal" className="text-slate-700 font-medium">
                    What were your big wins today?
                </Label>
                <div className="relative">
                    <Textarea
                        id="journal"
                        placeholder="I fixed the login bug and deployed the new header..."
                        className="min-h-[120px] pr-10 resize-none text-base"
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                    />
                    {/* AI Voice Trigger (Mock) */}
                    <button
                        className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                        onClick={() => setIsListening(!isListening)}
                    >
                        <Mic className="w-4 h-4" />
                    </button>
                </div>

                {/* Helper Chips */}
                <div className="flex flex-wrap gap-2 mt-1">
                    <button className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Polish with AI
                    </button>
                    <button
                        className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setJournalText(prev => prev + "Deployment completed. ")}
                    >
                        + Deployment
                    </button>
                    <button
                        className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setJournalText(prev => prev + "Meeting with client. ")}
                    >
                        + Meeting
                    </button>
                </div>
            </div>
        </div>
    )

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Ready to wrap up?</DialogTitle>
                        <DialogDescription>
                            Great work today! Quickly capture what you accomplished.
                        </DialogDescription>
                    </DialogHeader>
                    {Content}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
                        <Button variant="ghost" onClick={onSkip} className="text-slate-500">Skip & Clock Out</Button>
                        <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                            <Send className="w-4 h-4" /> Save & Clock Out
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>Ready to wrap up?</DrawerTitle>
                    <DrawerDescription>
                        Great work today! Quickly capture what you accomplished.
                    </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                    {Content}
                </div>
                <DrawerFooter className="pt-2">
                    <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white w-full gap-2">
                        <Send className="w-4 h-4" /> Save & Clock Out
                    </Button>
                    <DrawerClose asChild>
                        <Button variant="outline" onClick={onSkip}>Skip & Clock Out</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}
