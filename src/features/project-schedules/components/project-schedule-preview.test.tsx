import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectSchedulePreview } from "./project-schedule-preview";

const schedules = vi.hoisted(() => ({ useProjectSchedulesQuery: vi.fn() }));

vi.mock("../hooks/use-project-schedules", () => schedules);

describe("ProjectSchedulePreview", () => {
  it("keeps the management link available when this week has no schedules", () => {
    schedules.useProjectSchedulesQuery.mockReturnValue({ data: [], error: null, isPending: false });
    render(<ProjectSchedulePreview projectId="11111111-1111-4111-8111-111111111111" />);
    expect(screen.getByText("이번 주에 예정된 일정이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 일정 관리" })).toHaveAttribute("href", "/projects/11111111-1111-4111-8111-111111111111/schedules");
  });

  it("shows this-week schedules and links to full schedule management", () => {
    schedules.useProjectSchedulesQuery.mockReturnValue({ data: [{ id: "11111111-1111-4111-8111-111111111111", scheduledOn: "2026-07-20", title: "중간 보고서 제출" }], error: null, isPending: false });
    render(<ProjectSchedulePreview projectId="22222222-2222-4222-8222-222222222222" />);
    expect(screen.getByRole("heading", { name: "이번 주 일정" })).toBeInTheDocument();
    expect(screen.getByText("중간 보고서 제출")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 일정 관리" })).toHaveAttribute("href", "/projects/22222222-2222-4222-8222-222222222222/schedules");
  });
});
