// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuestionContent, type QuestionForViewer } from "./question-content";

const BASE: QuestionForViewer = {
  id: "question-1",
  title: "Explain the conservation of momentum",
  prompt: "Two trolleys collide on a frictionless track. Explain what happens.",
  answer: "Momentum is conserved",
  solution: null,
  difficulty: "medium",
  marks: 3,
  question_type: "short-answer",
  calculator: false,
  year: 2019,
  paper: "Paper 1",
  source: "IBO",
  license: "CC BY-NC",
};

afterEach(cleanup);

describe("QuestionContent attribution", () => {
  it("renders the attribution line when a reviewer is set", () => {
    render(
      <QuestionContent
        question={{
          ...BASE,
          reviewer_name: "Dr Amara Yusuf",
          reviewer_credential: "IB Math AA Tutor, 6 years",
          reviewed_at: "2026-01-04T10:00:00.000Z",
        }}
      />,
    );

    expect(
      screen.getByText("Reviewed by Dr Amara Yusuf, IB Math AA Tutor, 6 years"),
    ).toBeInTheDocument();
  });

  it("renders the reviewer name alone when the credential is missing", () => {
    render(
      <QuestionContent
        question={{ ...BASE, reviewer_name: "Dr Amara Yusuf", reviewer_credential: null }}
      />,
    );

    const line = screen.getByText(/Reviewed by/);
    expect(line).toHaveTextContent("Reviewed by Dr Amara Yusuf");
    expect(line.textContent).not.toContain(",");
    expect(line.textContent).not.toContain("null");
  });

  it("renders markup identical to the unreviewed baseline when reviewer fields are null", () => {
    const baseline = render(<QuestionContent question={BASE} />);
    const baselineHtml = baseline.container.innerHTML;
    cleanup();

    const nulled = render(
      <QuestionContent
        question={{
          ...BASE,
          reviewer_name: null,
          reviewer_credential: null,
          reviewed_at: null,
        }}
      />,
    );

    // No extra node and no spacer: unreviewed questions are byte-identical.
    expect(nulled.container.innerHTML).toBe(baselineHtml);
    expect(nulled.container.innerHTML).not.toContain("Reviewed by");
    expect(nulled.container.innerHTML).not.toContain("null");
    expect(screen.queryByText(/Reviewed by/)).toBeNull();
  });
});
