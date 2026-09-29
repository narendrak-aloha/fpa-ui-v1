<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-gray-1 px-4">
    <h1 class="text-2xl font-semibold text-ink-gray-9">Page not found</h1>
    <Button variant="solid" v-on:click="$router.push({ name: 'Home' })">Back to the desk</Button>
  </div>
</template>

<script>
import { Button } from 'frappe-ui'
import PageTitle from '@/mixins/PageTitle'

export default {
  name: 'NotFound',

  components: { Button },

  mixins: [PageTitle],
}
</script>
