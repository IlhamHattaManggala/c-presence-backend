"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
// Middleware to verify if a user is logged in via their Supabase JWT
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        // Attach user payload to request
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Internal Server Auth Error' });
    }
};
exports.requireAuth = requireAuth;
// Middleware to verify if the user has admin role
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const supabaseAdmin = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        // Fetch user details from public.users to verify role
        const { data: profile, error } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', req.user.id)
            .single();
        if (error || !profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin role required' });
        }
        next();
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Internal Server Auth Error' });
    }
};
exports.requireAdmin = requireAdmin;
