import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { api } from '@renderer/services/ipc-client'
import type { User } from '@shared/types/api.types'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

type FormValues = z.infer<typeof schema>

export function LoginScreen() {
  const { t } = useTranslation()
  const { setUser, setPermissions } = useAuthStore()
  const profile = useBusinessStore((s) => s.profile)
  const { error: toastError } = useNotificationStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const res = await api.auth.login(values)

    if (!res.success || !res.data) {
      setServerError(res.error?.message ?? t('auth.loginError'))
      return
    }

    const user = res.data as User
    setUser(user)

    // Load permissions. Do not block or delay login/navigation on this —
    // the user is already authenticated at this point. Just surface
    // feedback if it fails so a subsequently broken/limited UI isn't a
    // total mystery to the user.
    try {
      const permsRes = await api.auth.getPermissions()
      if (permsRes.success && Array.isArray(permsRes.data)) {
        setPermissions(permsRes.data as string[])
      } else {
        toastError(t('common.error'), permsRes.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-900 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <BrandIcon size={72} />
          </div>
          <h1 className="text-3xl font-bold text-dark dark:text-slate-100">
            {profile?.businessName ?? 'Sarang'}
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-1">Business OS Lite</p>
          <p className="text-sm text-brand mt-1 font-semibold inline-flex items-center gap-1.5">
            by Aszurex <AszurexMark width={16} />
          </p>
        </div>

        {/* Form */}
        <Card padding="lg" className="shadow-card">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">{t('auth.signIn')}</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label={t('auth.username')}
              placeholder={t('auth.username')}
              autoComplete="username"
              autoFocus
              error={errors.username?.message}
              required
              {...register('username')}
            />

            <div className="flex flex-col gap-2">
              <label className="text-base font-semibold text-slate-700 dark:text-slate-300">
                {t('auth.password')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.password')}
                  autoComplete="current-password"
                  className="w-full h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pr-12 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
            </div>

            {serverError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-4 py-3"
              >
                {serverError}
              </motion.p>
            )}

            <Button type="submit" size="lg" className="w-full mt-2" loading={isSubmitting}>
              {t('auth.signIn')}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-slate-400 mt-6 inline-flex items-center justify-center gap-1.5 w-full">
          {t('about.poweredBy')} <AszurexMark width={14} /> · {t('about.tagline')}
        </p>
      </motion.div>
    </div>
  )
}
