// Supabase project credentials.
// Set VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY in your .env file
// (or in Vercel environment variables) to use your own project.
// The values below are the defaults from the original Figma Make project.

export const projectId: string =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "vmehgaiafjqhfslydidq";

export const publicAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZWhnYWlhZmpxaGZzbHlkaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjQyNzAsImV4cCI6MjA5NTIwMDI3MH0.4pjo4OqZLnoplGLyOaQvnTFLFH6jaBkX6O6AwfbVrnI";
