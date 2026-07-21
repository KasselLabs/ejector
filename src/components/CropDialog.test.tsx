import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// cropCharacterSource does real canvas pixel work (tainted-canvas SecurityError
// in a real browser); it's a canvas-touching leaf, so it's mocked here to drive
// the failure path (same sanction as cropImage.dom.test.ts).
const cropCharacterSource = vi.fn();
vi.mock("@/lib/cropImage", () => ({
  cropCharacterSource: (...args: unknown[]) => cropCharacterSource(...args),
}));

// react-easy-crop renders a real <canvas>/gesture surface that jsdom can't
// drive; stub it to a div that fires onCropComplete once so the Confirm button
// enables (croppedAreaPixels becomes non-null).
function MockCropper({
  onCropComplete,
}: {
  onCropComplete: (a: unknown, pixels: unknown) => void;
}) {
  useEffect(() => {
    onCropComplete(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 10, height: 10 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div data-testid="cropper" />;
}

vi.mock("react-easy-crop", () => ({ default: MockCropper }));

import { CropDialog } from "./CropDialog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CropDialog", () => {
  it("reports a translated error and closes when cropping fails", async () => {
    cropCharacterSource.mockRejectedValue(new Error("tainted canvas"));
    const onError = vi.fn();
    const onClose = vi.fn();
    render(
      <CropDialog
        image="data:image/png;base64,abc"
        open
        onClose={onClose}
        onChange={() => {}}
        onError={onError}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
