import { useState } from 'react'
import { Badge, Button, Card, Field, Icon, Input, Select, Textarea, useToast } from '@/components/ui'
import { BUSINESS_TYPE_LABELS, type BusinessType } from '@/lib/types'

const CHANNELS = [
  { icon: 'mail', title: 'Sales & onboarding', detail: 'sales@biteflow.com', note: 'Replies within one business day' },
  { icon: 'support_agent', title: 'Existing customers', detail: 'support@biteflow.com', note: 'Priority routing on Growth and above' },
  { icon: 'call', title: 'Phone', detail: '+91 80 4711 2200', note: 'Mon–Sat, 9:00–19:00 IST' },
  { icon: 'location_on', title: 'Office', detail: 'Level 4, 18 Maple Lane', note: 'Bengaluru 560001, India' },
]

const TOPICS = [
  { value: 'demo', label: 'Book a guided demo' },
  { value: 'pricing', label: 'Pricing and plans' },
  { value: 'migration', label: 'Migrating from another system' },
  { value: 'support', label: 'Technical support' },
  { value: 'partnership', label: 'Partnership or reseller' },
]

export function ContactPage() {
  const toast = useToast()
  const [form, setForm] = useState({
    name: '',
    email: '',
    restaurant: '',
    businessType: 'restaurant' as BusinessType,
    topic: 'demo',
    message: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Your name is required'
    if (!form.email.trim()) next.email = 'We need an email to reply to'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'That email looks incomplete'
    if (form.message.trim().length < 10) next.message = 'A little more detail helps us route this'
    setErrors(next)
    if (Object.keys(next).length) return

    setSending(true)
    // Prototype: no backend mailer yet — acknowledge locally.
    await new Promise((r) => setTimeout(r, 650))
    setSending(false)
    setSent(true)
    toast.success('Message queued', 'A member of the team will reply shortly.')
  }

  return (
    <div className="flex flex-col">
      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-2xl lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <div className="flex flex-col gap-space-lg">
            <Badge tone="brand" icon="support_agent">
              Contact
            </Badge>
            <h1 className="font-display-hero-mobile text-display-hero-mobile tracking-tight lg:font-headline-xl lg:text-headline-xl">
              Talk to someone who has worked a service
            </h1>
            <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
              Tell us about your restaurant and how you take orders today. We'll show you the exact
              path from where you are to a live QR menu.
            </p>

            <div className="mt-space-sm grid gap-space-md sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <Card key={c.title} className="flex flex-col gap-space-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <Icon name={c.icon} size={20} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                      {c.title}
                    </span>
                    <span className="font-body-md text-body-md font-semibold text-on-surface">
                      {c.detail}
                    </span>
                    <span className="font-label-xs text-label-xs text-on-surface-variant">{c.note}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Card className="h-fit">
            {sent ? (
              <div className="flex flex-col items-center gap-space-sm py-space-2xl text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-success-bg text-status-success">
                  <Icon name="mark_email_read" size={28} />
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">Message received</h2>
                <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
                  Thanks {form.name.split(' ')[0]} — we've logged your enquiry about{' '}
                  {TOPICS.find((t) => t.value === form.topic)?.label.toLowerCase()}. Expect a reply at{' '}
                  {form.email}.
                </p>
                <Button
                  variant="secondary"
                  icon="restart_alt"
                  onClick={() => {
                    setSent(false)
                    setForm({
                      name: '',
                      email: '',
                      restaurant: '',
                      businessType: 'restaurant',
                      topic: 'demo',
                      message: '',
                    })
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form className="flex flex-col gap-space-md" onSubmit={submit} noValidate>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Send us a message</h2>

                <div className="grid gap-space-md sm:grid-cols-2">
                  <Field label="Your name" error={errors.name} required htmlFor="c-name">
                    <Input
                      id="c-name"
                      icon="person"
                      placeholder="Aarav Mehta"
                      value={form.name}
                      invalid={Boolean(errors.name)}
                      onChange={(e) => update('name', e.target.value)}
                    />
                  </Field>
                  <Field label="Email" error={errors.email} required htmlFor="c-email">
                    <Input
                      id="c-email"
                      type="email"
                      icon="mail"
                      placeholder="you@restaurant.com"
                      value={form.email}
                      invalid={Boolean(errors.email)}
                      onChange={(e) => update('email', e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-space-md sm:grid-cols-2">
                  <Field label="Restaurant name" htmlFor="c-restaurant">
                    <Input
                      id="c-restaurant"
                      icon="storefront"
                      placeholder="Urban Bean Cafe"
                      value={form.restaurant}
                      onChange={(e) => update('restaurant', e.target.value)}
                    />
                  </Field>
                  <Field label="Business type" htmlFor="c-type">
                    <Select
                      id="c-type"
                      value={form.businessType}
                      onChange={(e) => update('businessType', e.target.value as BusinessType)}
                      options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                  </Field>
                </div>

                <Field label="What can we help with?" htmlFor="c-topic">
                  <Select
                    id="c-topic"
                    value={form.topic}
                    onChange={(e) => update('topic', e.target.value)}
                    options={TOPICS}
                  />
                </Field>

                <Field
                  label="Message"
                  error={errors.message}
                  hint={`${form.message.length}/600 characters`}
                  required
                  htmlFor="c-message"
                >
                  <Textarea
                    id="c-message"
                    rows={5}
                    maxLength={600}
                    placeholder="We run two cafés and take orders at the counter today. We'd like table QRs…"
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                  />
                </Field>

                <Button type="submit" size="lg" block loading={sending} icon="send">
                  Send message
                </Button>
                <p className="text-center font-label-xs text-label-xs text-on-surface-variant">
                  Prototype note: enquiries are acknowledged locally and not emailed yet.
                </p>
              </form>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
