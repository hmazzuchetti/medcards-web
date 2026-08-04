// Re-export from the new SSR-compatible client for backward compatibility
// Use @/lib/supabase/client for new code
import { createClient } from '@/lib/supabase/client';

export const supabase = createClient();
