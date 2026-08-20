import { describe, expect, it } from "vitest";
import {
  buildAssistantContext,
  contextChips,
  quickActions,
  DEFAULT_PAGE_CONTEXT,
} from "@/lib/assistant";

const study = {
  subjects: ["Physics HL", "Maths AA HL"],
  weakTopics: ["Kinematics"],
  unresolvedMistakes: 3,
};

describe("assistant context", () => {
  it("tells the model the screen, subject, topic and detail it was opened on", () => {
    const context = buildAssistantContext(
      {
        page: "Practice session",
        path: "/session/abc",
        subject: "Physics HL",
        topic: "Kinematics",
        detail: "Question 3 of 10",
      },
      study,
    );

    expect(context).toContain("The student is on: Practice session.");
    expect(context).toContain("Route: /session/abc");
    expect(context).toContain("Subject in view: Physics HL");
    expect(context).toContain("Topic in view: Kinematics");
    expect(context).toContain("Screen detail: Question 3 of 10");
    expect(context).toContain("Their IB subjects: Physics HL, Maths AA HL");
    expect(context).toContain("Topics they keep getting wrong: Kinematics");
    expect(context).toContain("Unresolved mistakes in their notebook: 3");
  });

  it("omits what it doesn't know rather than asserting blanks", () => {
    const context = buildAssistantContext(DEFAULT_PAGE_CONTEXT, {
      subjects: [],
      weakTopics: [],
      unresolvedMistakes: 0,
    });

    expect(context).toBe("The student is on: Atlas.");
  });

  it("shows the student only the context it actually has", () => {
    expect(
      contextChips({ page: "Topic", subject: "Physics HL", topic: null }),
    ).toEqual(["Topic", "Physics HL"]);
  });

  it("offers hint actions on a question and planning actions off one", () => {
    expect(quickActions({ page: "Question", questionId: "q1" })).toContain(
      "Give me a hint",
    );
    expect(quickActions({ page: "Topic", topic: "Kinematics" })).toContain(
      "Explain Kinematics simply",
    );
    expect(quickActions({ page: "Atlas" })).toContain(
      "What should I revise next?",
    );
  });
});
