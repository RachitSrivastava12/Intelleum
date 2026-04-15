import intelleumLogo from "@/assets/intelleum-logo.png";

const IntelleumLogo = () => {
  return (
    <div className="relative">
      <img
        src={intelleumLogo}
        alt="INTELLEUM"
        className="w-32 h-32 md:w-48 md:h-48 object-contain pulse-glow"
      />
      <div className="absolute inset-0 bg-primary/5 blur-3xl -z-10" />
    </div>
  );
};

export default IntelleumLogo;
