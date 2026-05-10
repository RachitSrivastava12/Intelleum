import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Hero from "./Hero";

describe("Hero", () => {
  it("renders the main hero messaging and actions", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    expect(screen.getByText(/mev intelligence for solana/i)).toBeInTheDocument();
    expect(screen.getByText(/see where solana orderflow is getting/i)).toBeInTheDocument();
    expect(screen.getByText(/extracted/i)).toBeInTheDocument();
    expect(screen.getByText(/repriced/i)).toBeInTheDocument();
    expect(screen.getByText(/routed/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /open live demo/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /flow terminal/i })).toHaveAttribute("href", "/flow-terminal");
    expect(screen.getByText(/sandwich/i)).toBeInTheDocument();
    expect(screen.getByText(/backrun/i)).toBeInTheDocument();
  });
});
