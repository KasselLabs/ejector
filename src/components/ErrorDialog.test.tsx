import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorDialog } from "./ErrorDialog";

describe("ErrorDialog", () => {
  it("renders nothing when message is null", () => {
    render(<ErrorDialog message={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the message when set", () => {
    render(<ErrorDialog message="Something exploded" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Something exploded")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<ErrorDialog message="Boom" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
