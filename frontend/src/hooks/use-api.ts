import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  authApi,
  userApi,
  apiKeysApi,
  screenshotsApi,
  webhooksApi,
  subscriptionsApi,
  scheduledScreenshotsApi,
  adminApi,
} from '@/services/api'
import type { UpdateWebhookRequest } from '@/types/api'

// Auth hooks
export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user)
      toast.success('Logged in successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Login failed')
    },
  })
}

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      toast.success('Registration successful! Please check your email to verify your account.')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Registration failed')
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  return () => {
    authApi.logout()
    queryClient.clear()
    window.location.href = '/login'
  }
}

// User hooks
export const useUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: userApi.getProfile,
    retry: false,
  })
}

export const useUsage = () => {
  return useQuery({
    queryKey: ['usage'],
    queryFn: userApi.getUsage,
  })
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast.success('Profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    },
  })
}

export const useChangePassword = () => {
  return useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password')
    },
  })
}

// API Keys hooks
export const useApiKeys = () => {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeysApi.list,
  })
}

export const useCreateApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast.success('API key created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create API key')
    },
  })
}

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiKeysApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast.success('API key deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete API key')
    },
  })
}

// Screenshots hooks
export const useScreenshots = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['screenshots', page, limit],
    queryFn: () => screenshotsApi.list(page, limit),
  })
}

export const useScreenshot = (id: string) => {
  return useQuery({
    queryKey: ['screenshot', id],
    queryFn: () => screenshotsApi.get(id),
    enabled: !!id,
  })
}

export const useCreateScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Screenshot created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create screenshot')
    },
  })
}

export const useCreateBulkScreenshots = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.createBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Screenshots created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create screenshots')
    },
  })
}

export const useDeleteScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      toast.success('Screenshot deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete screenshot')
    },
  })
}

// Webhooks hooks
export const useWebhooks = () => {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.list,
  })
}

export const useWebhook = (id: string) => {
  return useQuery({
    queryKey: ['webhook', id],
    queryFn: () => webhooksApi.get(id),
    enabled: !!id,
  })
}

export const useCreateWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create webhook')
    },
  })
}

export const useUpdateWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookRequest }) =>
      webhooksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update webhook')
    },
  })
}

export const useDeleteWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete webhook')
    },
  })
}

export const useTestWebhook = () => {
  return useMutation({
    mutationFn: webhooksApi.test,
    onSuccess: () => {
      toast.success('Webhook test triggered successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to test webhook')
    },
  })
}

// Subscriptions hooks
export const useSubscription = () => {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionsApi.getCurrent,
  })
}

export const useSubscriptionPlans = () => {
  return useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: subscriptionsApi.getPlans,
  })
}

export const usePayments = () => {
  return useQuery({
    queryKey: ['payments'],
    queryFn: subscriptionsApi.getPayments,
  })
}

export const useCreateCheckout = () => {
  return useMutation({
    mutationFn: subscriptionsApi.createCheckout,
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create checkout session')
    },
  })
}

export const useCancelSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: subscriptionsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast.success('Subscription cancelled successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription')
    },
  })
}

export const useReactivateSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: subscriptionsApi.reactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast.success('Subscription reactivated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reactivate subscription')
    },
  })
}

// Scheduled Screenshots hooks
export const useScheduledScreenshots = () => {
  return useQuery({
    queryKey: ['scheduledScreenshots'],
    queryFn: scheduledScreenshotsApi.list,
  })
}

export const useCreateScheduledScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduledScreenshotsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScreenshots'] })
      toast.success('Scheduled screenshot created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create scheduled screenshot')
    },
  })
}

export const useDeleteScheduledScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduledScreenshotsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScreenshots'] })
      toast.success('Scheduled screenshot deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete scheduled screenshot')
    },
  })
}

// Admin hooks
export const useAdminUsers = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['adminUsers', page, limit],
    queryFn: () => adminApi.listUsers(page, limit),
  })
}

export const useAdminAnalytics = () => {
  return useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: adminApi.getAnalytics,
  })
}

export const useAdminHealth = () => {
  return useQuery({
    queryKey: ['adminHealth'],
    queryFn: adminApi.getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
