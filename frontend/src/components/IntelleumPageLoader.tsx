import SquareLoopLoader from "@/components/SquareLoopLoader";

export default function IntelleumPageLoader() {
  return (
    <div className="fixed inset-0 z-50 grid min-h-screen place-items-center overflow-hidden bg-background/96 backdrop-blur-sm">
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.20),transparent_32%)]" />
      <SquareLoopLoader size="lg" />
    </div>
  );
}
