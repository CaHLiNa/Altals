<template>
  <div class="min-h-screen bg-stone-950 text-stone-100 antialiased">
    <main class="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
      <div class="w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur">
        <p class="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
          Error {{ error?.statusCode || 500 }}
        </p>

        <h1 class="text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl">
          {{ title }}
        </h1>

        <p class="mt-4 text-base leading-relaxed text-stone-300">
          {{ description }}
        </p>

        <div class="mt-8">
          <button
            @click="handleError"
            class="rounded-full bg-white px-5 py-2 text-sm font-medium tracking-wide text-stone-950 transition-colors hover:bg-stone-200"
          >
            Return to bridge
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
const props = defineProps({
  error: Object,
})

const title = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return 'Page not found'
  if (code === 403) return 'Access denied'
  if (code === 500) return 'Something went wrong'
  return 'An error occurred'
})

const description = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return 'The page you are looking for does not exist or has been moved.'
  if (code === 403) return 'You do not have permission to access this page.'
  if (code === 500) return 'An internal error occurred. Please try again later.'
  return props.error?.message || 'An unexpected error occurred.'
})

const handleError = () => clearError({ redirect: '/' })
</script>
