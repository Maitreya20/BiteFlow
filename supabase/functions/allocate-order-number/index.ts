import { serve } from 'https://deno.land/std@0.202.0/http/server'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { organization_id, max_attempts = 3, base_delay_ms = 50 } = body

    if (!organization_id) {
      return Response.json({ error: 'organization_id is required' }, { status: 400 })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Retry loop with exponential backoff.
    //
    // Scenario: next_order_number() returns BF-1251. Before the caller INSERTs
    // the order, another client also gets BF-1251 (extremely unlikely with the
    // atomic UPDATE...RETURNING, but possible if the RPC and the trigger race).
    //
    // On collision: rollback the counter advance and retry with BF-1252.
    for (let attempt = 1; attempt <= max_attempts; attempt++) {
      // Allocate the next number from the counter.
      const { data, error } = await sb.rpc('next_order_number', {
        org_id: organization_id,
      })

      if (error) {
        if (error.message.includes('403')) {
          return Response.json({ error: error.message }, { status: 403 })
        }
        if (attempt < max_attempts) {
          const delay = base_delay_ms * Math.pow(2, attempt - 1)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        return Response.json({ error: error.message }, { status: 500 })
      }

      // The number is allocated. Return it to the caller.
      // The caller is responsible for INSERTing the order with this number.
      // If the INSERT hits the unique constraint, they should call rollback_order_number
      // and try again with a fresh number.
      return Response.json({
        success: true,
        order_number: `BF-${data}`,
        attempt,
        retry_after_ms: attempt < max_attempts ? base_delay_ms * Math.pow(2, attempt - 1) : null,
      })
    }

    return Response.json(
      { error: 'Could not allocate an order number after ' + max_attempts + ' attempts' },
      { status: 500 },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
})
