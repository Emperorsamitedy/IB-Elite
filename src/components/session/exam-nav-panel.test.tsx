// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExamNavPanel, navColumns, navState } from "./exam-nav-panel";

describe("navColumns", () => {
  it("tracks the paper length", () => {
    expect(navColumns(3)).toBe(3);
    expect(navColumns(10)).toBe(4);
    expect(navColumns(20)).toBe(5);
    expect(navColumns(60)).toBe(6);
  });
});

describe("navState", () => {
  it("prefers the current question over its mark", () => {
    expect(navState(2, 2, "easy")).toBe("current");
    expect(navState(1, 2, "wrong")).toBe("wrong");
    expect(navState(1, 2, "okay")).toBe("marked");
    expect(navState(1, 2, undefined)).toBe("unseen");
  });
});

describe("ExamNavPanel", () => {
  it("renders one button per question and reports the current one", () => {
    render(
      <ExamNavPanel
        count={12}
        currentIndex={3}
        outcomes={{ 0: "easy", 1: "wrong" }}
        onSelect={() => {}}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(12);
    expect(screen.getByLabelText("Go to question 4")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByText("2/12 marked")).toBeTruthy();
    cleanup();
  });

  it("selects the clicked question", () => {
    const onSelect = vi.fn();
    render(
      <ExamNavPanel
        count={5}
        currentIndex={0}
        outcomes={{}}
        onSelect={onSelect}
      />,
    );

    screen.getByLabelText("Go to question 5").click();
    expect(onSelect).toHaveBeenCalledWith(4);
    cleanup();
  });
});
