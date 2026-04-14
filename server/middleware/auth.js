// JWT auth middleware — validates Supabase Auth tokens
// Attach to routes that require a logged-in customer

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function requireAuth(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: 'Auth service not configured' });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user to request for downstream handlers
  req.authUser = user;
  next();
}

// Admin middleware — must be used after requireAuth
// Checks that the authenticated user has is_admin = true in customers table
async function requireAdmin(req, res, next) {
  if (!supabase || !req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('is_admin')
    .eq('auth_id', req.authUser.id)
    .limit(1)
    .single();

  if (!customer?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
