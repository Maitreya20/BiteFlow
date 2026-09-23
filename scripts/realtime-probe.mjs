/**
 * Realtime probe: replicates exactly what the dashboard does — subscribe to the
 * orders table filtered by organization, then trigger an INSERT from a second
 * connection. If the dashboard is healthy this must fire in well under a second.
 *
 * Usage: node scripts/realtime-probe.mjs <orgId>
 * Needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local (reads them itself).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k) => env.match(new RegExp(`^${k}\\s*=\\s*(\\S+)`, 'm'))?.[1]
const URL = get('VITE_SUPABASE_URL')
const KEY = get('VITE_SUPABASE_ANON_KEY')
const ORG_ID = process.argv[2]
if (!URL || !KEY || !ORG_ID) {
  console.error('usage: node scripts/realtime-probe.mjs <orgId>  (needs .env.local creds)')
  process.exit(1)
}

const sb = createClient(URL, KEY)

// 1. Subscribe the way AppStore.subscribeRealtime does.
const channel = sb.channel('probe-' + Date.now())
let received = null
channel
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `organization_id=eq.${ORG_ID}` }, (payload) => {
    received = payload
  })
  .subscribe(async (status) => {
    console.log('subscribe status:', status)
    if (status !== 'SUBSCRIBED') return

    // 2. Insert an order row via the anon REST path (same as a guest order).
    const token = Math.random().toString(36).slice(2, 8)
    const { data, error } = await sb
      .from('orders')
      .insert({
        organization_id: ORG_ID,
        channel: 'dine_in',
        customer_name: `probe-${token}`,
        status: 'pending',
        subtotal: 0, tax_amount: 0, service_charge: 0, discount: 0, total: 0,
        notes: 'realtime probe — safe to delete',
        payment_status: 'unpaid',
      })
      .select('id, order_number')
      .single()
    console.log('insert:', error ? `ERROR ${error.message}` : `${data.order_number} (${data.id})`)
    if (error) process.exit(1)

    // 3. Wait for the event.
    const deadline = Date.now() + 8000
    const tick = setInterval(() => {
      if (received) {
        clearInterval(tick)
        const row = received.new ?? {}
        console.log(`REALTIME EVENT RECEIVED in ~${8000 - (deadline - Date.now())}ms — order_number=${row.order_number}`)
        console.log('VERDICT: realtime works ✅')
        sb.from('orders').delete().eq('id', data.id).then(() => process.exit(0))
      } else if (Date.now() > deadline) {
        clearInterval(tick)
        console.log('VERDICT: no event within 8s ❌ (publication/RLS/socket problem)')
        sb.from('orders').delete().eq('id', data.id).then(() => process.exit(2))
      }
    }, 250)
  })

setTimeout(() => { console.log('VERDICT: never subscribed ❌'); process.exit(3) }, 15000)
