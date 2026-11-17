import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './assets/style.css'
import App from './App.vue'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        registration.update().catch(() => {})
      }
    })
  },
})

createApp(App).mount('#app')
