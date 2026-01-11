import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   // Form submission logic would go here
  //   console.log("Form submitted");
  // };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  await fetch("https://intelleum.onrender.com/access/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  setFormData({
    name: "",
    email: "",
    organization: "",
    useCase: "",
    message: "",
  });
};

  return (
    <section id="access" className="relative py-32 px-6">
      <div className="absolute inset-0 grid-overlay-subtle opacity-10" />
      
      <div className="relative max-w-xl mx-auto">
        <div className="text-center mb-12">
          <p className="data-label mb-3">// Request Access</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
            Request Early Access
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            INTELLEUM is currently available to a limited set of teams.
            Request access to evaluate MEV exposure and execution risk.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="intel-panel-glow p-8 space-y-6">
          <div className="space-y-2">
            <label className="data-label">Name</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-background border-border font-mono text-sm"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="data-label">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-background border-border font-mono text-sm"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="data-label">Organization</label>
            <Input
              type="text"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              className="bg-background border-border font-mono text-sm"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="data-label">Use Case</label>
            <Select
              value={formData.useCase}
              onValueChange={(value) => setFormData({ ...formData, useCase: value })}
            >
              <SelectTrigger className="bg-background border-border font-mono text-sm">
                <SelectValue placeholder="Select use case" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="protocol">DeFi Protocol</SelectItem>
                <SelectItem value="lp">Liquidity Provider / Vault</SelectItem>
                <SelectItem value="validator">Validator / Infrastructure</SelectItem>
                <SelectItem value="research">Research / Fund</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="data-label">Message (Optional)</label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="bg-background border-border font-mono text-sm min-h-[100px]"
              placeholder="Tell us about your MEV concerns..."
            />
          </div>
          
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Submit Request
          </Button>
        </form>
      </div>
    </section>
  );
};

export default AccessForm;
