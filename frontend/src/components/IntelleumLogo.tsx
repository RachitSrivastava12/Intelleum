const IntelleumLogo = () => {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute h-40 w-40 rounded-[18px] bg-primary/6 blur-3xl md:h-56 md:w-56" />
      <div className="relative overflow-hidden rounded-[18px] border border-primary/15 bg-[linear-gradient(180deg,rgba(8,11,15,0.96),rgba(6,10,15,0.9))] shadow-[0_0_45px_rgba(6,214,247,0.08)]">
        <img
          src="/intelleum-logo.png"
          alt="INTELLEUM"
          className="h-36 w-36 object-contain md:h-52 md:w-52"
        />
      </div>
      <div className="absolute inset-0 bg-primary/5 blur-3xl -z-10" />
    </div>
  );
};

export default IntelleumLogo;
