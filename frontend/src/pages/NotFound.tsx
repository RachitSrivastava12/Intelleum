import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-mono">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        <p className="text-muted-foreground mb-6">Signal not found</p>
        <Link to="/" className="text-primary border border-primary/40 px-4 py-2 hover:bg-primary/10">
          Return to base
        </Link>
      </div>
    </div>
  );
}
