import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ConfirmDialog } from '@/components/ui'

/**
 * Confirmations in this app wrap real async writes, and almost none of the call
 * sites catch their own errors. A rejected write therefore used to surface as:
 * the dialog stays open over the dimmed app, either with a confirm button that
 * spins forever (`loading` bound to a flag that is never reset) or with no
 * feedback at all — which reads as the product freezing mid-action.
 *
 * The dialog now owns that failure, so these tests assert the two things a user
 * needs: the spinner stops, and the page is still usable afterwards.
 */

afterEach(cleanup)

function scrim() {
  return document.querySelector('[aria-label="Close overlay"]')
}

function confirmButton(label = 'Regenerate') {
  return screen.getByRole('button', { name: label }) as HTMLButtonElement
}

describe('ConfirmDialog', () => {
  it('reports a failed action and stops the spinner instead of hanging', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('permission denied by row level security'))

    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Regenerate this QR code?"
        message="A new token is issued."
        confirmLabel="Regenerate"
        destructive
      />,
    )

    confirmButton().click()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('permission denied by row level security')

    // The button must come back to life: `loading` used to stay true forever.
    await waitFor(() => expect(confirmButton().disabled).toBe(false))
    expect(confirmButton().querySelector('.animate-spin')).toBeNull()
  })

  it('leaves the dialog closable so the app is never stuck behind the scrim', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn().mockRejectedValue(new Error('nope'))

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete this menu item?"
        message="It will be removed."
        confirmLabel="Delete"
      />,
    )

    confirmButton('Delete').click()
    await screen.findByRole('alert')

    expect(scrim()).toBeInTheDocument()
    screen.getByRole('button', { name: 'Cancel' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not blur the page behind it', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Reset this table?"
        message="The table is released."
      />,
    )

    // A full-screen `backdrop-blur` smears every pixel of the app behind the
    // overlay, which is what made the page look broken rather than dimmed.
    expect(scrim()?.className ?? '').not.toMatch(/blur/)
  })

  it('clears a previous failure when it is reopened', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('first attempt failed'))
    const { rerender } = render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Cancel this order?"
        message="It will be cancelled."
        confirmLabel="Cancel order"
      />,
    )

    confirmButton('Cancel order').click()
    await screen.findByRole('alert')

    rerender(
      <ConfirmDialog
        open={false}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Cancel this order?"
        message="It will be cancelled."
        confirmLabel="Cancel order"
      />,
    )
    rerender(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Cancel this order?"
        message="It will be cancelled."
        confirmLabel="Cancel order"
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no error when the action succeeds', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Regenerate this QR code?"
        message="A new token is issued."
        confirmLabel="Regenerate"
      />,
    )

    confirmButton().click()

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(confirmButton().disabled).toBe(false))
  })

  it('ignores a second click while the first is still in flight', async () => {
    let release: () => void = () => {}
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Reset this table?"
        message="The table is released."
        confirmLabel="Reset table"
      />,
    )

    confirmButton('Reset table').click()
    confirmButton('Reset table').click()

    expect(onConfirm).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(confirmButton('Reset table').disabled).toBe(false))
  })
})
