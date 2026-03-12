'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface CurrentUser {
  id: string
  email: string | undefined
  profile: Profile | null
  loading: boolean
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    id: '',
    email: undefined,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setState({ id: '', email: undefined, profile: null, loading: false })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setState({ id: user.id, email: user.email, profile, loading: false })
    }

    fetchUser()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchUser()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return state
}
