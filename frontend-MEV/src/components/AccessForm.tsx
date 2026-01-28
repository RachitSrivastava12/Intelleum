import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AccessForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    useCase: "",
    message: "",
  });

  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      const res = await fetch("https://intelleum-z1yy.onrender.com/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Request failed");

      setStatus("success");
      setFormData({
        name: "",
        email: "",
        organization: "",
        useCase: "",
        message: "",
      });
      
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <section 
      id="access" 
      className="relative py-20 px-6 overflow-hidden"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Background elements */}
      <div className="absolute inset-0 grid-overlay-subtle opacity-20" style={{ pointerEvents: 'none' }} />
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{ pointerEvents: 'none' }}
      />
      
      <div className="max-w-4xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="data-label mb-2">// Get Started</p>
          <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
            Request Early Access
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
            INTELLEUM is currently available to select teams. Request access to evaluate MEV exposure and execution risk.
          </p>
        </motion.div>

        <motion.form 
          onSubmit={handleSubmit} 
          className="intel-panel-glow p-8 md:p-10 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Label htmlFor="name" className="data-label">Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background border-border font-mono text-sm"
                placeholder="Your name"
                disabled={status === "submitting"}
                style={{ pointerEvents: 'auto' }}
              />
            </motion.div>

            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.4 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Label htmlFor="email" className="data-label">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-background border-border font-mono text-sm"
                placeholder="your@email.com"
                disabled={status === "submitting"}
                style={{ pointerEvents: 'auto' }}
              />
            </motion.div>

            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.5 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Label htmlFor="organization" className="data-label">Organization *</Label>
              <Input
                id="organization"
                required
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="bg-background border-border font-mono text-sm"
                placeholder="Your company"
                disabled={status === "submitting"}
                style={{ pointerEvents: 'auto' }}
              />
            </motion.div>

            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Label htmlFor="useCase" className="data-label">Use Case *</Label>
              <Select 
                required
                value={formData.useCase}
                onValueChange={(value) => setFormData({ ...formData, useCase: value })}
                disabled={status === "submitting"}
              >
                <SelectTrigger className="bg-background border-border font-mono text-sm" style={{ pointerEvents: 'auto' }}>
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="protocol">DeFi Protocol</SelectItem>
                  <SelectItem value="lp">Liquidity Provider</SelectItem>
                  <SelectItem value="validator">Validator</SelectItem>
                  <SelectItem value="research">Research / Fund</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>
          </div>

          <motion.div 
            className="mt-6 space-y-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.7 }}
            style={{ pointerEvents: 'auto' }}
          >
            <Label htmlFor="message" className="data-label">Message (Optional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="bg-background border-border font-mono text-sm min-h-[100px]"
              placeholder="Tell us about your MEV concerns..."
              disabled={status === "submitting"}
              style={{ pointerEvents: 'auto' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.8 }}
            style={{ pointerEvents: 'auto' }}
          >
            <Button 
              type="submit" 
              variant="primary" 
              size="lg" 
              className="w-full mt-8 py-7 text-base"
              disabled={status === "submitting"}
              style={{ pointerEvents: 'auto' }}
            >
              {status === "submitting" ? "Submitting..." : "Request Access"}
            </Button>
          </motion.div>
          
          {/* Status messages */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center"
            >
              <p className="text-green-400 font-mono text-sm">
                ✓ Request submitted successfully! We'll review it within 48 hours.
              </p>
            </motion.div>
          )}
          
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center"
            >
              <p className="text-red-400 font-mono text-sm">
                ✗ Something went wrong. Please try again or contact us directly.
              </p>
            </motion.div>
          )}
          
          <motion.p 
            className="mt-6 text-center text-dim text-xs font-mono"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            We review applications within 48 hours
          </motion.p>
        </motion.form>
      </div>
    </section>
  );
};

export default AccessForm;