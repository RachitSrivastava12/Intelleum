import IntelleumLogo from "./IntelleumLogo";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-30" />
      
      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-50" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl stagger-children">
        <IntelleumLogo />
        
        <h1 className="mt-8 text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
          <span className="gradient-text">INTELLEUM</span>
        </h1>
        
        <p className="mt-4 font-mono text-sm md:text-base text-primary/80 tracking-widest uppercase">
          MEV Intelligence for Solana
        </p>
        
        <p className="mt-8 text-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed">
          We analyze block-level execution to identify MEV actors, strategies, pool toxicity, 
          competition density, and validator capture in real time.
        </p>
        
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Button variant="primary" size="lg" asChild>
            <a href="#access">Request Early Access</a>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <a href="#demo">View Intelligence Demo</a>
          </Button>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
      </div>
    </section>
  );
};

export default Hero;
