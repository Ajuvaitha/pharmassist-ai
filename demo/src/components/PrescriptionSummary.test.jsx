import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PrescriptionSummary from './PrescriptionSummary.jsx'

const entries = [
  {
    id: 'entry-1',
    medicineName: 'Paracetamol',
    frequency: 'TID',
    dosageQty: 1,
    durationDays: 5,
    timing: 'after food',
  },
]

describe('PrescriptionSummary', () => {
  it('hides the export button when there are no entries', () => {
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={[]}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /finalize.*export/i })).not.toBeInTheDocument()
  })

  it('shows entries and an enabled export button when entries exist', () => {
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={entries}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalize.*export/i })).toBeEnabled()
  })

  it('calls onRemoveEntry with the entry id', async () => {
    const user = userEvent.setup()
    const onRemoveEntry = vi.fn()
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={entries}
        onRemoveEntry={onRemoveEntry}
        onExport={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /remove Paracetamol/i }))
    expect(onRemoveEntry).toHaveBeenCalledWith('entry-1')
  })

  it('calls onPatientNameChange as the patient field is edited', async () => {
    const user = userEvent.setup()
    const onPatientNameChange = vi.fn()
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={onPatientNameChange}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={[]}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    await user.type(screen.getByLabelText(/patient name/i), 'A')
    expect(onPatientNameChange).toHaveBeenCalledWith('A')
  })
})
