import './utils/runtimePolyfills'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import 'katex/dist/katex.min.css'

import { initLocale } from './i18n'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.mount('#app')

  void initLocale().catch((error) => {
    console.error('Failed to initialize locale', error)
  })
}

void bootstrap()
