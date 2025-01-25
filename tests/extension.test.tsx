import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import Extension from "../src/components/extension"

describe("Extension Component", () => {
  it("renders without crashing", () => {
    const { container } = render(<Extension />)
    expect(container).toBeDefined()
  })
}) 