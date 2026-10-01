const { createClient } = require('@supabase/supabase-js');
const ApiError = require('../utils/ApiError');

let adminClient;

function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!process.env.SUPABASE_URL || !key) {
    throw new ApiError(
      503,
      'Configure SUPABASE_SECRET_KEY no ambiente do backend para gerenciar contas.'
    );
  }

  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}

module.exports = { getSupabaseAdmin };