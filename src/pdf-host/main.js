import '../utils/runtimePolyfills'

import { createApp } from 'vue'

import { initLocale } from '../i18n'
import '../style.css'
import PdfHostApp from './PdfHostApp.vue'

initLocale()

createApp(PdfHostApp).mount('#app')
