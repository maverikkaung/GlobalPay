import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { JOB_FIELDS, presentJob } from "./job-discovery.js";

export function useJob(id, userId, attempt, showClient = false) {
  const key = `${id}:${userId || "public"}:${attempt}:${showClient}`;
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error } = await supabase.from("jobs").select(JOB_FIELDS).eq("id", id).maybeSingle();
        if (!active) return;
        if (error && error.code !== "22P02") throw error;
        if (!data) {
          setResult({ key, status: "missing" });
          return;
        }

        let company = "";
        if (showClient && userId && data.client_id) {
          const profile = await supabase.from("client_public_profiles").select("full_name")
            .eq("id", data.client_id).maybeSingle().then((value) => value, () => null);
          company = profile?.data?.full_name || "";
        }
        if (active) setResult({ key, status: "ready", job: presentJob(data, company) });
      } catch {
        if (active) setResult({ key, status: "error" });
      }
    }

    load();
    return () => { active = false; };
  }, [attempt, id, key, showClient, userId]);

  return result?.key === key ? result : { status: "loading" };
}
