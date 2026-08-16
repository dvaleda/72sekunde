import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail loudly at boot rather than produce confusing runtime errors later.
  // eslint-disable-next-line no-console
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'The backend cannot talk to the database without them. See README.md.'
  );
}

// Service-role client. This key must NEVER be sent to the frontend.
// All business rules (one attempt per email, server-side timer, server-side
// scoring, etc.) are enforced in the Express routes before this client is used.
export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { persistSession: false },
});
