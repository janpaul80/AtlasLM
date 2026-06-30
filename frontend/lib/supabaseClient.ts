import { createBrowserClient } from '@supabase/ssr'

// Browser client is used for client‑side interactions
export const supabaseBrowser = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export type AtlasTier = "Free" | "Pro" | "Team";

export interface AtlasProfile {
  id: string;
  email: string;
  full_name: string | null;
  tier: AtlasTier;
}

export async function getCurrentProfile(): Promise<AtlasProfile | null> {
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, tier")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("Failed to fetch profile", error);
    return null;
  }
  return data as AtlasProfile;
}

export async function signOut() {
  const supabase = supabaseBrowser();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out failed", error);
    throw error;
  }
}
