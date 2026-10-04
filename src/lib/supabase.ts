import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function sessionClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("Configuration Supabase manquante. Consultez le README.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) {
        try {
          for (const { name, value, options } of items)
            store.set(name, value, options);
        } catch {
          /* Le Proxy rafraîchit les cookies pour les Server Components. */
        }
      },
    },
  });
}
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
