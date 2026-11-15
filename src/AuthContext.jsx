import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase.js";
import { AuthContext } from "./auth-context.js";
import { useAuth } from "./useAuth.js";
import { normalizeAccountType } from "./marketplace.js";

function toAppUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email || "Member",
    email: authUser.email || "",
    accountType: normalizeAccountType(profile?.account_type)
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadedProfile, setLoadedProfile] = useState({ userId: null, profile: null });

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Unable to restore authentication session:", error.message);
      setSession((current) => current?.user?.id === data.session?.user?.id ? current : data.session);
      setAuthReady(true);
    }).catch((error) => {
      if (!active) return;
      console.error("Unable to restore authentication session:", error.message);
      setSession(null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const authUser = session?.user || null;
  const userId = authUser?.id || null;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    supabase.from("profiles").select("full_name, account_type")
      .eq("id", userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Unable to load profile role:", error.message);
        setLoadedProfile({ userId, profile: data || null });
      }).catch((error) => {
        if (!active) return;
        console.error("Unable to load profile role:", error.message);
        setLoadedProfile({ userId, profile: null });
      });

    return () => { active = false; };
  }, [userId]);

  const value = useMemo(() => {
    const profile = loadedProfile.userId === userId ? loadedProfile.profile : null;
    return {
      user: toAppUser(authUser, profile),
      session,
      loading: !authReady || Boolean(userId && loadedProfile.userId !== userId)
    };
  }, [authReady, authUser, loadedProfile, session, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <main className="route-loading" aria-live="polite">Checking your account…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !user.accountType) return <Navigate to="/login" replace state={{ from: location, profileIncomplete: true }} />;

  if (roles && !roles.includes(user.accountType)) {
    const destination = user.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";
    return <Navigate to={destination} replace />;
  }

  return children;
}
