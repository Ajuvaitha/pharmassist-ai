import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import DosageFormPopup from './DosageFormPopup.jsx'

const medicine = { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' }

describe('DosageFormPopup', () => {
  it('shows the medicine name and pre-fills its common frequency', () => {
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    expect(screen.getByLabelText(/frequency/i)).toHaveValue('TID')
  })

  it('calls onConfirm with the entered details', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )

    await user.clear(screen.getByLabelText(/dosage quantity/i))
    await user.type(screen.getByLabelText(/dosage quantity/i), '2')
    await user.clear(screen.getByLabelText(/duration/i))
    await user.type(screen.getByLabelText(/duration/i), '5')
    await user.selectOptions(screen.getByLabelText(/timing/i), 'after food')
    await user.click(screen.getByRole('button', { name: /add to prescription/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      frequency: 'TID',
      dosageQty: 2,
      durationDays: 5,
      timing: 'after food',
    })
  })

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not call onConfirm when the dosage quantity field is empty', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )

    await user.clear(screen.getByLabelText(/dosage quantity/i))
    await user.click(screen.getByRole('button', { name: /add to prescription/i }))

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
