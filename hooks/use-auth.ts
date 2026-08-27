"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Tier = "guest" | "user" | "admin" | "owner";

interface AuthState {
  user: User | null;
  tier: Tier;
  permissions: string[];
  loading: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    tier: "guest",
    permissions: [],
    loading: true,
  });
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    async function getUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        const user = error ? null : data.user;

        let tier: Tier = "guest";
        let permissions: string[] = [];

        if (user) {
          const { data: tierData } = await supabase
            .from("user_tiers")
            .select("tier, permissions")
            .eq("user_id", user.id)
            .single();
          tier = (tierData?.tier as Tier) || "user";
          permissions = (tierData?.permissions as string[]) ?? [];
        }

        if (mounted) {
          setState({ user, tier, permissions, loading: false });
        }
      } catch {
        if (mounted) {
          setState({ user: null, tier: "guest", permissions: [], loading: false });
        }
      }
    }

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        const user = session?.user ?? null;
        if (!user) {
          setState({ user: null, tier: "guest", permissions: [], loading: false });
          return;
        }
        setState((prev) => ({ ...prev, user }));
        supabase
          .from("user_tiers")
          .select("tier, permissions")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            if (mounted && data) {
              setState((prev) => ({
                ...prev,
                tier: (data.tier as Tier) || "user",
                permissions: (data.permissions as string[]) ?? [],
              }));
            }
          });
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, tier: "guest", permissions: [], loading: false });
    router.replace("/login");
    router.refresh();
  };

  const hasPermission = (perm: string) => {
    if (state.tier === "admin" || state.tier === "owner") return true;
    return state.permissions.includes(perm);
  };

  return { ...state, signOut, hasPermission };
}
