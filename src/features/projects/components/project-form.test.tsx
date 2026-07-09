import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectForm } from "./project-form";

describe("ProjectForm attachments", () => {
  it("shows files dropped on the attachment area", () => {
    const file = new File(["grant"], "grant-agreement.pdf", { type: "application/pdf" });

    render(
      <ProjectForm
        companyName="테스트 기업"
        isSubmitting={false}
        onSubmit={vi.fn()}
        showAttachments
      />
    );

    fireEvent.drop(screen.getByText(/첨부할 파일/).closest("div")!, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByText("grant-agreement.pdf")).toBeInTheDocument();
  });
});
