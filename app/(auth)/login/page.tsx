'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
})

type FormValues = z.infer<typeof schema>

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1 },
}

export default function LoginPage() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormValues) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setError('root', { message: error.message })
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Full-screen background image */}
      <img
        src="/matcha-field.jpg"
        alt="Matcha field"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Centered login card */}
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm rounded-2xl bg-white/60 backdrop-blur-md p-8 shadow-2xl flex flex-col gap-6"
        >
          {/* Logo */}
          <motion.div variants={item}>
            <img src="/hisa-logo.png" alt="HISA" className="h-10 w-auto" />
          </motion.div>

          {/* Heading */}
          <motion.div variants={item}>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your account
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <motion.div variants={item} className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@hisamatcha.com"
                autoComplete="email"
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </motion.div>

            <motion.div variants={item} className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </motion.div>

            {errors.root && (
              <motion.p
                variants={item}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {errors.root.message}
              </motion.p>
            )}

            <motion.div variants={item}>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
