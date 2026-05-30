import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function dbLoad(key, fallback) {
  const { data, error } = await supabase
    .from('store')
    .select('data')
    .eq('key', key)
    .single()
  if (error || !data) return fallback
  return data.data ?? fallback
}

export async function dbSave(key, value) {
  await supabase.from('store').upsert({ key, data: value })
}
