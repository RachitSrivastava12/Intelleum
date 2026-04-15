import { useState, type MouseEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CopyableValueProps {
  value?: string | null;
  display?: string;
  className?: string;
  empty?: string;
  title?: string;
}

export default function CopyableValue({
  value,
  display,
  className = "",
  empty = "—",
  title,
}: CopyableValueProps) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={className}>{empty}</span>;
  }

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("[copy] failed", error);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={copy}
          className={`max-w-full truncate text-left transition-colors hover:text-primary ${className}`}
          title={title}
        >
          {display ?? value} {copied ? "copied" : ""}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {copied ? "Copied to clipboard" : "Click to copy underlying value"}
      </TooltipContent>
    </Tooltip>
  );
}
