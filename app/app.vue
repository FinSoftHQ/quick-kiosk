<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'th'
  }
})

const title = 'สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ จำกัด'
const description = 'ระบบ Kiosk บริการสมาชิก สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ จำกัด'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
