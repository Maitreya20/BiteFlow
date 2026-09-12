import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.location.origin reliably in all environments;
// supabase.ts already falls back to `http://localhost:5173`, but remote checks
// can still trip on `public` fields. This is a minimal smoke-test harness, so we
// keep the demo dataset path and avoid live Supabase require().
