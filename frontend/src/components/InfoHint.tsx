import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 inline-flex cursor-help items-center justify-center rounded-full border border-border px-1 text-[9px] leading-none text-muted-foreground">
          ?
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
