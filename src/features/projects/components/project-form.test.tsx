import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_PROJECT, ProjectForm } from "./project-form";

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

  it("removes checked attachment files", () => {
    const keepFile = new File(["keep"], "keep.pdf", { type: "application/pdf" });
    const removeFile = new File(["remove"], "remove.pdf", { type: "application/pdf" });

    render(
      <ProjectForm
        companyName="테스트 기업"
        isSubmitting={false}
        onSubmit={vi.fn()}
        showAttachments
      />
    );

    fireEvent.drop(screen.getByText(/첨부할 파일/).closest("div")!, {
      dataTransfer: { files: [keepFile, removeFile] },
    });
    fireEvent.click(screen.getByLabelText("remove.pdf 삭제 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 삭제" }));

    expect(screen.getByText("keep.pdf")).toBeInTheDocument();
    expect(screen.queryByText("remove.pdf")).not.toBeInTheDocument();
  });
});

describe("ProjectForm budget ratios", () => {
  it("clears the total ratio error when another ratio field fixes the total", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ProjectForm
        companyName="테스트 기업"
        initialValues={{
          ...EMPTY_PROJECT,
          agreementEndDate: "2026-12-31",
          agreementStartDate: "2026-01-01",
          assignmentName: "과제명",
          hostInstitution: "기관",
          projectName: "사업명",
          totalProjectBudget: "1000",
        }}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );
    const subsidyInput = container.querySelector<HTMLInputElement>('[name="governmentSubsidyRatio"]')!;
    const cashInput = container.querySelector<HTMLInputElement>('[name="selfCashRatio"]')!;

    await user.clear(subsidyInput);
    await user.type(subsidyInput, "70");
    expect(await screen.findByText(/합계는 100%/)).toBeInTheDocument();

    await user.clear(cashInput);
    await user.type(cashInput, "30");

    expect(screen.queryByText(/합계는 100%/)).not.toBeInTheDocument();
  });
});
