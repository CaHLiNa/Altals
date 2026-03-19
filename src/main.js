import './utils/runtimePolyfills'

// Suppress SuperDoc's bundled Vue warning (it inlines its own Vue copy — unfixable)
const _warn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('compilerOptions')) return
  _warn.apply(console, args)
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import 'katex/dist/katex.min.css'

import { initLocale } from './i18n'
import { initTelemetry, setAppVersion } from './services/telemetry'
import { installTerminalEventBridge } from './services/terminal/terminalEvents'

initLocale()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
installTerminalEventBridge(pinia)

initTelemetry()
setAppVersion(__APP_VERSION__)
