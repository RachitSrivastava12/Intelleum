import { Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="font-mono text-xs text-dim">
          © 2024 INTELLEUM
        </div>
        
        <div className="flex items-center gap-8">
          <a
            href="https://x.com/Intelleumsol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-dim hover:text-primary transition-colors"
            aria-label="Twitter"
          >
            <Twitter size={18} />
          </a>
          <a
            href="mailto:intelleum.mev.solana@gmail.com"
            className="font-mono text-xs text-dim hover:text-primary transition-colors"
          >
            Contact
          </a>
         
        </div>
      </div>
    </footer>
  );
};

export default Footer;
