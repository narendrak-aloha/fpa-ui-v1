// Sets document.title from the route's meta.pageTitle. Use in all views.
export default {
  created() {
    const appTitle = this.$root.config.APP_TITLE
    const pageTitle = this.$route.meta.pageTitle
    document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle
  },
}
