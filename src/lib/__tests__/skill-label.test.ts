import { describe, expect, it } from "vitest"
import { skillLabel } from "../utils"

describe("skillLabel", () => {
  it("capitalizes an all-lowercase skill", () => {
    expect(skillLabel("cash handling")).toBe("Cash handling")
    expect(skillLabel("financial forecasting")).toBe("Financial forecasting")
  })
  it("leaves names that already have capitals", () => {
    expect(skillLabel("SQL")).toBe("SQL")
    expect(skillLabel("iOS")).toBe("iOS")
    expect(skillLabel("P&L management")).toBe("P&L management")
    expect(skillLabel("Google Sheets")).toBe("Google Sheets")
  })
  it("handles empty and symbol-first names", () => {
    expect(skillLabel("")).toBe("")
    expect(skillLabel("  c++ ")).toBe("C++")
    expect(skillLabel(".net")).toBe(".net")
  })
})
