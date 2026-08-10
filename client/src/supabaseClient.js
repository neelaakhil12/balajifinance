import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mfxqnuvbafnpgzwmrkui.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1meHFudXZiYWZucGd6d21ya3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzY0NTksImV4cCI6MjEwMTkxMjQ1OX0.FDvScnzTWEPt2gGJGcSjcabY8ZyA8P63S_8hiYlUGwo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
