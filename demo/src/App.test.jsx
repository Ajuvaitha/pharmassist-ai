import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App.jsx'

// App renders Whiteboard, which loads the real MyScript iink-ts editor. That
// editor requires a live browser + network environment (and dev keys) that
// jsdom can't provide, so it's mocked here purely to keep this smoke test
// isolated from that dependency; Whiteboard's own recognition behavior is
// verified manually per the design doc's Testing section.
vi.mock('iink-ts', () => ({
  Editor: {
    load: vi.fn().mockResolvedValue({
      event: {
        addExportedListener: vi.fn(),
        addErrorListener: vi.fn(),
      },
      destroy: vi.fn(),
    }),
  },
  convertBoundingBoxMillimeterToPixel: vi.fn((box) => box),
}))

describe('App', () => {
  it('renders the demo heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /whiteboard e-prescription demo/i }),
    ).toBeInTheDocument()
  })
})
