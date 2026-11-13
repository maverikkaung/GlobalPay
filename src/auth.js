import { supabase } from "./supabase.js";

const CURRENT_USER_KEY = "TechKarvo_current_user";

export function getUsers() {
  return [];
}

export function registerUser(user) {
  return {
    success: false,
    message: "Please use Supabase Signup."
  };
}

export function loginUser(email, password) {
  return {
    success: false,
    message: "Please use Supabase Login."
  };
}

export function getCurrentUser() {
  try {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);

    if (!savedUser) {
      return null;
    }

    return JSON.parse(savedUser);
  } catch (error) {
    return null;
  }
}

export async function logoutUser() {
  const result = await supabase.auth.signOut();

  localStorage.removeItem(CURRENT_USER_KEY);

  return result;
}