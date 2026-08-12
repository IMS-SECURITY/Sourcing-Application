import { Loader2 } from "lucide-react";

export function TvseLoader({ className = "h-40" }: { className?: string }) {
  return (
    <div className={`w-full flex flex-col items-center justify-center gap-3 animate-scale-in ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        <div className="absolute size-14 rounded-full border-2 border-primary/20 animate-ping opacity-75" />
        {/* Spinning gradient ring */}
        <div className="size-12 rounded-full border-[3px] border-primary/10 border-t-primary animate-spin" />
        {/* Centered TVSE Logo icon */}
        <div className="absolute font-black italic text-[10px] tracking-tighter text-primary select-none">TVSE</div>
      </div>
      <div className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse opacity-85 select-none">
        Fetching live data...
      </div>
    </div>
  );
}

export function TvsePageLoader() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <TvseLoader className="h-64" />
    </div>
  );
}
