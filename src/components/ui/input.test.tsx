import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Input } from "./input";

it("formats keyboard date input as YYYY-MM-DD", () => {
  render(<Input aria-label="날짜" type="date" />);

  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "20260719" } });

  expect(screen.getByLabelText("날짜")).toHaveValue("2026-07-19");
});
