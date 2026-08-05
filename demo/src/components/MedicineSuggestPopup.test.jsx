import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import MedicineSuggestPopup from './MedicineSuggestPopup.jsx'

const candidates = [
  { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-004', name: 'Metformin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
]

describe('MedicineSuggestPopup', () => {
  it('lists every candidate name', () => {
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={() => {}}
        onDismiss={() => {}}
      />,
    )
    expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked candidate', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={onSelect}
        onDismiss={() => {}}
      />,
    )
    await user.click(screen.getByText('Metformin'))
    expect(onSelect).toHaveBeenCalledWith(candidates[1])
  })

  it('calls onDismiss when "not a medicine" is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={() => {}}
        onDismiss={onDismiss}
      />,
    )
    await user.click(screen.getByRole('button', { name: /not a medicine/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
