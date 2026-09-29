import { createRouter, createWebHistory } from 'vue-router'
import UserPermissions from '@/classes/UserPermissions'
import FpaApi from '@/classes/FpaApi'
import appConfig from '@/config/appConfig'

// Meta fields:
//   requiresAuth: default true. Set false for public routes.
//   pageTitle:    shown in the browser tab (see mixins/PageTitle.js)
const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { pageTitle: 'Dashboard' },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false, pageTitle: 'Log in' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { requiresAuth: false, pageTitle: 'Not found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  // router.app is the root component (set in main.js). On the very first
  // navigation it may not exist yet, so fall back to the persisted session.
  const user = router.app?.user ?? new UserPermissions(new FpaApi())
  const requiresAuth = appConfig.AUTH_ENABLED && to.meta.requiresAuth !== false

  if (requiresAuth && !user.isAuthenticated()) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'Login' && user.isAuthenticated()) {
    return { name: 'Home' }
  }
  return true
})

export default router
