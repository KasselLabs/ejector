import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadArea } from "./UploadArea";

// The preview <img> is decorative (alt=""), same as CharacterGenerator's
// swatch preview, so it's queried directly rather than via role "img"
// (an empty alt removes it from the accessibility tree).
function previewImage(container: HTMLElement) {
  return container.querySelector("img");
}

describe("UploadArea", () => {
  it("opens the crop dialog after a file is uploaded", async () => {
    const user = userEvent.setup();
    render(<UploadArea previewUrl="/red.png" onChange={() => {}} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const file = new File(["hello"], "hero.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload/i);
    await user.upload(input, file);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Crop Image")).toBeInTheDocument();
  });

  it("renders the current preview image", () => {
    const { container } = render(
      <UploadArea previewUrl="/red.png" onChange={() => {}} />,
    );
    expect(previewImage(container)).toHaveAttribute("src", "/red.png");
  });
});
