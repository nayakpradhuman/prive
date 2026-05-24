// Supabase project credentials.
// Set VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY in your .env file
// (or in Vercel environment variables) to use your own project.
// The values below are the defaults from the original Figma Make project.

export const projectId: string =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "gmwuxrddqwyhpqqiijby";

export const publicAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3V4cmRkcXd5aHBxcWlpamJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjI2MDUsImV4cCI6MjA5NTEzODYwNX0.xvbX-h6FMG38Tno6SwIuciXuSrDuegglnUEf0GazMZ0";
