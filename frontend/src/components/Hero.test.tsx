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

    expect(
      screen.getByRole("heading", {
        name: /see where solana orderflow is getting extracted, repriced, and routed\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /request early access/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view intelligence demo/i })).toBeInTheDocument();
    expect(screen.getByText(/live surface/i)).toBeInTheDocument();
    expect(screen.getByText(/raydium amm/i)).toBeInTheDocument();
  });
});
