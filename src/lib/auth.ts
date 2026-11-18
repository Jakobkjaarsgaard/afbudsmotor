import type { Clinic } from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultClinic, isUsingSupabase } from "@/lib/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface TenantContext {
  clinic: Clinic;
  userEmail: string;
  isDemoMode: boolean;
}

/**
 * Resolves the active clinic tenant for the current request.
 * - When Supabase Auth is configured and a user is signed in, returns their owned clinic.
 * - In local dev/demo mode (no Supabase env vars), returns the seeded demo clinic.
 */
export async function getTenantContext(): Promise<TenantContext> {
  if (isUsingSupabase()) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = createAdminSupabaseClient()!;
        const { data: clinic } = await admin
          .from("clinics")
          .select("*")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (clinic) {
          return {
            clinic: clinic as Clinic,
            userEmail: user.email ?? clinic.notification_email,
            isDemoMode: false,
          };
        }
      }
    }
  }

  const clinic = await getDefaultClinic();
  return {
    clinic,
    userEmail: clinic.notification_email,
    isDemoMode: !isUsingSupabase(),
  };
}
