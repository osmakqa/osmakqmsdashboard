// This file is kept to maintain import compatibility but Supabase is disabled.
// The app now uses Google Sheets as a backend.

export const supabase = {
  auth: {
    signInWithPassword: async () => ({ data: {}, error: null }),
    signUp: async () => ({ data: {}, error: null })
  },
  from: () => ({ select: () => ({}) })
};

// Always return false so the app knows not to try Supabase logic
export const isSupabaseConfigured = false;