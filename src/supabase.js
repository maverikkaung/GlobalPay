import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

console.log("TechKarvo Supabase connected!");

supabase
  .from("jobs")
  .select("*")
  .then(function (result) {
    if (result.error) {
      console.log("Database Error:", result.error.message);
    } else {
      console.log("Database Connection Successful!");
      console.log("Jobs Data:", result.data);
    }
  });