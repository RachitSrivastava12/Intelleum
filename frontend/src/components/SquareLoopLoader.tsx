type SquareLoopLoaderProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export default function SquareLoopLoader({ className = "", size = "md" }: SquareLoopLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={`grid place-items-center ${className}`}>
      <span className="sr-only">Loading</span>
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 border border-primary/20 bg-primary/5 shadow-[0_0_34px_hsl(var(--primary)/0.18)]" />
        <div className="absolute inset-1 border border-primary/10" />
        <div className="absolute inset-0 border border-transparent border-r-primary border-t-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)] motion-safe:animate-spin motion-reduce:animate-none" />
        <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
      </div>
    </div>
  );
}
