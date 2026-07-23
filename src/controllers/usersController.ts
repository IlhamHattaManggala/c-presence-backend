import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Delete from Auth (This will trigger profile deletion if ON DELETE CASCADE is set)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    
    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    // 2. Explicitly delete from public.users just in case cascade is not set
    await supabaseAdmin.from('users').delete().eq('id', id);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkImportEmployees = async (req: Request, res: Response) => {
  try {
    const { employeesData } = req.body;
    if (!Array.isArray(employeesData)) {
      return res.status(400).json({ success: false, error: 'employeesData must be an array' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const results = {
      totalSuccess: 0,
      failed: 0,
      errors: [] as string[]
    };

    const chunkSize = 20;
    for (let i = 0; i < employeesData.length; i += chunkSize) {
      const chunk = employeesData.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (data) => {
        try {
          // 1. Create Auth User directly (mark email as confirmed)
          const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password || 'password123',
            email_confirm: true
          });

          if (authErr) {
            results.failed++;
            results.errors.push(`${data.email}: ${authErr.message}`);
            return;
          }

          if (authUser.user) {
            // 2. Insert into public.users
            const { error: dbErr } = await supabaseAdmin.from('users').insert([{
              id: authUser.user.id,
              email: data.email,
              nik: data.nik,
              full_name: data.full_name,
              position: data.position,
              station_id: data.station_id,
              shift_code: data.shift_code,
              role: 'user'
            }]);

            if (dbErr) {
              results.failed++;
              results.errors.push(`${data.email} (DB): ${dbErr.message}`);
              // Clean up Auth user if DB insert fails
              await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            } else {
              results.totalSuccess++;
            }
          }
        } catch (e: any) {
          results.failed++;
          results.errors.push(`${data.email}: ${e.message}`);
        }
      }));
    }

    return res.status(200).json({ success: true, ...results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Create user in Auth using Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password || 'password123',
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    if (authUser.user) {
      // 2. Insert/Upsert user profile in public.users
      const { error: dbError } = await supabaseAdmin.from('users').upsert({
        id: authUser.user.id,
        email: userData.email,
        full_name: userData.full_name,
        nik: userData.nik || null,
        role: userData.role || 'user',
        position: userData.position || null,
        allowed_stations: userData.allowed_stations || null,
        shift_code: userData.shift_code || null,
        dinasan_start_time: userData.dinasan_start_time || null,
        dinasan_end_time: userData.dinasan_end_time || null
      }, { onConflict: 'id' });

      if (dbError) {
        // Clean up Auth user if DB insert fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return res.status(400).json({ success: false, error: dbError.message });
      }

      return res.status(201).json({ success: true, user: authUser.user });
    }

    return res.status(400).json({ success: false, error: 'Gagal membuat user' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch current auth user to check if they exist and check their provider
    let authUser: any = null;
    try {
      const { data: { user }, error: getError } = await supabaseAdmin.auth.admin.getUserById(id);
      if (!getError && user) {
        authUser = user;
      }
    } catch (e) {
      console.warn("Failed to fetch auth user details:", e);
    }

    // 2. Conditionally update Auth data only if there are changes and the user exists in auth.users
    if (authUser) {
      const authUpdatePayload: any = {};
      
      // Update password if provided
      if (userData.password && userData.password.trim() !== '') {
        authUpdatePayload.password = userData.password;
      }
      
      // Only update email if it has changed AND the user did not sign up via a third-party provider (like Google)
      const isGoogleUser = authUser.app_metadata?.provider === 'google' || authUser.identities?.some(id => id.provider === 'google');
      if (userData.email && userData.email.toLowerCase() !== authUser.email?.toLowerCase() && !isGoogleUser) {
        authUpdatePayload.email = userData.email;
      }

      if (Object.keys(authUpdatePayload).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);
        if (authError) {
          return res.status(400).json({ success: false, error: authError.message });
        }
      }
    } else {
      console.warn(`User ${id} not found in auth.users. Skipping auth update.`);
    }

    // 3. Update public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        email: userData.email,
        full_name: userData.full_name,
        nik: userData.nik || null,
        role: userData.role || 'user',
        position: userData.position || null,
        allowed_stations: userData.allowed_stations || null,
        shift_code: userData.shift_code || null,
        dinasan_start_time: userData.dinasan_start_time || null,
        dinasan_end_time: userData.dinasan_end_time || null
      })
      .eq('id', id);

    if (dbError) {
      return res.status(400).json({ success: false, error: dbError.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const { userId, notificationId } = req.body;
    if (!userId || !notificationId) {
      return res.status(400).json({ success: false, error: 'Missing userId or notificationId' });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('id', notificationId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const verifyDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: request, error: reqError } = await supabaseAdmin
      .from('approval_requests')
      .select('*, users:users!approval_requests_user_id_fkey(*)')
      .eq('id', id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ success: false, error: 'Dokumen tidak terdaftar atau tanda tangan tidak valid.' });
    }

    // Fetch Approver Info
    let name = request.approved_by_name || 'Admin KAI Commuter';
    let position = 'System Administrator';

    if (request.reviewed_by) {
      const { data: approver } = await supabaseAdmin
        .from('users')
        .select('full_name, position')
        .eq('id', request.reviewed_by)
        .single();
      
      if (approver) {
        name = approver.full_name;
        position = approver.position || 'Admin Staff';
      }
    } else if (request.approved_by_name) {
      const { data: approver } = await supabaseAdmin
        .from('users')
        .select('full_name, position')
        .eq('full_name', request.approved_by_name)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (approver) {
        position = approver.position || 'Admin Staff';
      }
    }

    return res.status(200).json({ 
      success: true, 
      requestData: request, 
      approverData: { name, position } 
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Terjadi kesalahan saat memverifikasi dokumen.' });
  }
};
