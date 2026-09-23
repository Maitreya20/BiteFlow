/**
 * `SegmentedControl` keyboard model.
 *
 * The control renders `role="tablist"` / `role="tab"`, so it owes users the
 * WAI-ARIA tabs keyboard contract. It previously owed and did not deliver: every
 * tab was a separate tab stop and the arrow keys did nothing, so a keyboard user
 * had to Tab through each option and had no way to read the group.
 *
 * Activation is deliberately *manual* — arrows move focus, Enter/Space selects.
 * These controls are filters and, in the role switcher, session changes that hit
 * the network, so simply browsing the group must never trigger one.
 */

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SegmentedControl } from '@/components/ui'

const OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
] as const

type Value = (typeof OPTIONS)[number]['value']

function Harness({ initial = 'week' as Value, onChange }: { initial?: Value; onChange?: (v: Value) => void }) {
  const [value, setValue] = useState<Value>(initial)
  return (
    <>
      <SegmentedControl
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
        options={OPTIONS as unknown as { value: Value; label: string }[]}
        label="Period"
        keyShortcuts="Alt+Shift+R"
        describedBy="hint"
      />
      <p id="hint">The period the dashboard summarises.</p>
    </>
  )
}

const tabs = () => screen.getAllByRole('tab') as HTMLButtonElement[]
const tabList = () => screen.getByRole('tablist')

describe('SegmentedControl keyboard model', () => {
  it('is a single tab stop, on the selected option', () => {
    render(<Harness />)

    // Roving tabindex: Tab enters the group once, not once per option.
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, 0, -1])
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to the first option as the tab stop when nothing matches', () => {
    // The demo role switcher passes a value that is not an option when the
    // signed-in demo account is neither seeded role; the group must stay reachable.
    render(
      <SegmentedControl
        value="none"
        onChange={() => {}}
        options={OPTIONS as unknown as { value: string; label: string }[]}
        label="Period"
      />,
    )

    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
    expect(tabs().every((tab) => tab.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  it('moves focus with the arrow keys and wraps around', () => {
    render(<Harness />)
    const [today, week, month] = tabs()

    week.focus()
    fireEvent.keyDown(tabList(), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(month)

    fireEvent.keyDown(tabList(), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(today)

    fireEvent.keyDown(tabList(), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(month)

    fireEvent.keyDown(tabList(), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(week)
  })

  it('does not select while the user is only moving through the group', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    tabs()[1].focus()
    fireEvent.keyDown(tabList(), { key: 'ArrowRight' })
    fireEvent.keyDown(tabList(), { key: 'ArrowLeft' })

    expect(onChange).not.toHaveBeenCalled()
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the ends with Home and End', () => {
    render(<Harness />)
    const [today, , month] = tabs()

    fireEvent.keyDown(tabList(), { key: 'End' })
    expect(document.activeElement).toBe(month)

    fireEvent.keyDown(tabList(), { key: 'Home' })
    expect(document.activeElement).toBe(today)
  })

  it('selects on Enter and Space, which native buttons already handle as clicks', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    tabs()[0].focus()
    // A focused button turns both keys into a click, so this is the contract the
    // control inherits rather than reimplements.
    fireEvent.click(tabs()[0])

    expect(onChange).toHaveBeenCalledWith('today')
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps focus on the selection when it changes underneath the user', () => {
    render(<Harness initial="today" />)

    tabs()[0].focus()
    expect(document.activeElement).toBe(tabs()[0])

    fireEvent.click(tabs()[2])

    // Focus followed the selection instead of being stranded on an unselected tab.
    expect(document.activeElement).toBe(tabs()[2])
  })

  it('does not steal focus from elsewhere on the page', () => {
    render(
      <>
        <Harness initial="today" />
        <input aria-label="Search" />
      </>,
    )
    const input = screen.getByLabelText('Search')
    input.focus()

    fireEvent.click(tabs()[2])

    expect(document.activeElement).toBe(input)
  })

  it('exposes the shortcut and its description to assistive technology', () => {
    render(<Harness />)

    expect(tabList()).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+R')
    expect(tabList()).toHaveAttribute('aria-describedby', 'hint')
  })
})
