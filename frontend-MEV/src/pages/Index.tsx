import Hero from "@/components/Hero";
import AnalysisFlow from "@/components/AnalysisFlow";
import IntelligenceSignals from "@/components/IntelligenceSignals";
import LiveDemo from "@/components/LiveDemo";
import WhoIsThisFor from "@/components/WhoIsThisFor";
import AccessForm from "@/components/AccessForm";
import Footer from "@/components/Footer";
import ForensicWindow from "@/components/ForensicWindow";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Hero />
      <div className="glow-line" />
      <AnalysisFlow />
      <div className="glow-line" />
      <ForensicWindow />
      <div className="glow-line" />
      <IntelligenceSignals />
      <div className="glow-line" />
      <LiveDemo />
      <div className="glow-line" />
      <WhoIsThisFor />
      <div className="glow-line" />
      <AccessForm />
      <Footer />
    </main>
  );
};

export default Index;
