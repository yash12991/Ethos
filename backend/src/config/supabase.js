const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY not configured; Supabase features disabled', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  });

  const disabledError = new Error('Supabase not configured');

  const throwIfCalled = () => {
    throw disabledError;
  };

  module.exports = {
    supabaseAnon: null,
    supabaseService: null,
    getUserScopedSupabase: throwIfCalled,
  };
} else {
  const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

  function getUserScopedSupabase(accessToken) {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  module.exports = {
    supabaseAnon,
    supabaseService,
    getUserScopedSupabase,
  };
}
