import { describe, it, expect } from "vitest";
import { getProjectColor } from "../project-color";

const ids = ["web", "api", "athene"];

describe("getProjectColor", () => {
  it("maps registration index to a 1-based slot", () => {
    expect(getProjectColor("web", ids).slot).toBe(1);
    expect(getProjectColor("api", ids).slot).toBe(2);
    expect(getProjectColor("web", ids).colorVar).toBe("var(--project-color-1)");
    expect(getProjectColor("api", ids).tintVar).toBe("var(--project-tint-2)");
  });

  it("cycles after 8", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `p${i}`);
    expect(getProjectColor("p8", nine).slot).toBe(1); // index 8 → slot 1
  });

  it("falls back to slot 1 for an unknown project", () => {
    expect(getProjectColor("nope", ids).slot).toBe(1);
  });
});
