type SquareLoopLoaderProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

export default function SquareLoopLoader({ className = "", size = "md" }: SquareLoopLoaderProps) {
  return (
    <div role="status" aria-live="polite" className={`grid place-items-center ${className}`}>
      <span className="sr-only">Loading</span>
      <div className={`intelleum-square-loader ${sizeClasses[size]}`} aria-hidden="true">
        <span className="intelleum-square-loader__halo" />
        <span className="intelleum-square-loader__frame" />
        <span className="intelleum-square-loader__track" />
        <span className="intelleum-square-loader__runner" />
        <span className="intelleum-square-loader__core" />
      </div>
    </div>
  );
}
