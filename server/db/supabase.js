const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://mfxqnuvbafnpgzwmrkui.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1meHFudXZiYWZucGd6d21ya3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzY0NTksImV4cCI6MjEwMTkxMjQ1OX0.FDvScnzTWEPt2gGJGcSjcabY8ZyA8P63S_8hiYlUGwo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
