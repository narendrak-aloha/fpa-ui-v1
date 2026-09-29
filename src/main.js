import { createApp } from 'vue'
import { FrappeUI } from 'frappe-ui'
import App from './App.vue'
import router from './router'
import './index.css'

const app = createApp(App)

app.use(router)
app.use(FrappeUI, { socketio: false })

// Root component instance: holds global state (this.$root.user, this.$root.api, ...)
router.app = app.mount('#app')
