import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CharacterFrames } from "@/types";

// cropCharacterSource does real canvas pixel work (tainted-canvas SecurityError
// in a real browser); it's a canvas-touching leaf, so it's mocked here to drive
// the success/failure paths (same sanction as cropImage.dom.test.ts).
const cropCharacterSource = vi.fn();
vi.mock("@/lib/cropImage", () => ({
  cropCharacterSource: (...args: unknown[]) => cropCharacterSource(...args),
}));

// Assert analytics wiring without touching gtag/dataLayer.
const trackEvent = vi.fn();
vi.mock("@/lib/tracking", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

// react-easy-crop renders a real <canvas>/gesture surface that jsdom can't
// drive; stub it to a div that (a) reflects the controlled crop/zoom/rotation
// props as data-attributes so quick-action outcomes are observable, and
// (b) fires onMediaLoaded (so the quick actions render) + onCropComplete once
// (so Confirm enables).
function MockCropper({
  crop,
  zoom,
  rotation,
  onMediaLoaded,
  onCropComplete,
}: {
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  onMediaLoaded: (size: {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  onCropComplete: (a: unknown, pixels: unknown) => void;
}) {
  useEffect(() => {
    onMediaLoaded({
      width: 480,
      height: 240,
      naturalWidth: 480,
      naturalHeight: 240,
    });
    onCropComplete(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 10, height: 10 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      data-testid="cropper"
      data-zoom={zoom}
      data-rotation={rotation}
      data-crop-x={crop.x}
      data-crop-y={crop.y}
    />
  );
}

vi.mock("react-easy-crop", () => ({ default: MockCropper }));

import { CropDialog } from "./CropDialog";

afterEach(() => {
  vi.clearAllMocks();
});

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof CropDialog>> = {},
) {
  const props = {
    image: "data:image/png;base64,abc",
    open: true,
    onClose: vi.fn(),
    onChange: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
  render(<CropDialog {...props} />);
  return props;
}

describe("CropDialog", () => {
  it("fires crop_image_modal_open when opened", () => {
    renderDialog();
    expect(trackEvent).toHaveBeenCalledWith("crop_image_modal_open");
  });

  it("emits CharacterFrames and fires crop_image_completed on confirm", async () => {
    const frames: CharacterFrames = {
      durationSeconds: 1,
      frames: [{ imageUrl: "data:image/png;base64,z", startSeconds: 0, endSeconds: 1 }],
    };
    cropCharacterSource.mockResolvedValue(frames);
    const { onChange, onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(frames));
    expect(trackEvent).toHaveBeenCalledWith("crop_image_completed");
    expect(onClose).toHaveBeenCalled();
  });

  it("fit shrinks zoom to fit the media inside the crop box", async () => {
    renderDialog();
    // media 480x240, crop box 240 -> min(240/480, 240/240) = 0.5
    await userEvent.click(
      screen.getByRole("button", { name: "Fits the image inside the crop area" }),
    );
    expect(screen.getByTestId("cropper")).toHaveAttribute("data-zoom", "0.5");
  });

  it("fill grows zoom to fill the crop box", async () => {
    renderDialog();
    // media 480x240, crop box 240 -> max(240/480, 240/240) = 1
    await userEvent.click(
      screen.getByRole("button", { name: "Fill the crop area with the image" }),
    );
    expect(screen.getByTestId("cropper")).toHaveAttribute("data-zoom", "1");
  });

  it("exposes center-horizontal/vertical quick actions", async () => {
    renderDialog();
    const centerH = screen.getByRole("button", {
      name: "Center the image horizontally",
    });
    const centerV = screen.getByRole("button", {
      name: "Center the image vertically",
    });
    await userEvent.click(centerH);
    await userEvent.click(centerV);
    const cropper = screen.getByTestId("cropper");
    expect(cropper).toHaveAttribute("data-crop-x", "0");
    expect(cropper).toHaveAttribute("data-crop-y", "0");
  });

  it("renders the zoom and rotation sliders", () => {
    renderDialog();
    expect(screen.getByLabelText("Zoom")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotation")).toBeInTheDocument();
  });

  it("reports a translated error and closes when cropping fails", async () => {
    cropCharacterSource.mockRejectedValue(new Error("tainted canvas"));
    const { onError, onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
