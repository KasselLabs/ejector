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

  it("renders no action when one is not configured", () => {
    render(<ErrorDialog message="Boom" onClose={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Retry delivery" }),
    ).not.toBeInTheDocument();
  });

  it("begins the configured action before closing the dialog", async () => {
    const calls: string[] = [];
    const onAction = vi.fn(() => {
      calls.push("action");
    });
    const onClose = vi.fn(() => {
      calls.push("close");
    });
    render(
      <ErrorDialog
        message="Boom"
        actionLabel="Retry delivery"
        onAction={onAction}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Retry delivery" }),
    );

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["action", "close"]);
  });

  it("runs the configured action from the keyboard", async () => {
    const onAction = vi.fn();
    render(
      <ErrorDialog
        message="Boom"
        actionLabel="Retry delivery"
        onAction={onAction}
        onClose={() => {}}
      />,
    );

    const action = screen.getByRole("button", { name: "Retry delivery" });
    action.focus();
    await userEvent.keyboard("{Enter}");

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
