<template>
  <div class="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-coop-600 via-coop-700 to-coop-900 text-white p-8 select-none">
    <div class="rounded-full bg-white p-5 shadow-2xl ring-8 ring-white/15">
      <img
        src="/images/coop-logo.png"
        alt="ตราสหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ"
        class="size-32 md:size-40"
      >
    </div>

    <p class="mt-8 text-xl md:text-2xl text-coop-100">
      ยินดีต้อนรับสู่
    </p>

    <h1 class="mt-2 text-center text-3xl md:text-5xl font-bold leading-snug">
      สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ จำกัด
    </h1>

    <div class="mt-10 w-full max-w-md rounded-2xl bg-white/10 backdrop-blur px-6 py-5 space-y-3 text-coop-50">
      <div class="flex items-center gap-3 text-base md:text-lg">
        <UIcon
          name="i-lucide-map-pin"
          class="size-6 shrink-0"
        />
        <p>0859 ถ.กสิกรรม ต.เมืองใต้ อ.เมือง จ.ศรีสะเกษ 33000</p>
      </div>

      <div class="flex items-center gap-3 text-base md:text-lg">
        <UIcon
          name="i-lucide-phone"
          class="size-6 shrink-0"
        />
        <p>045-611394</p>
      </div>

      <div class="flex items-center gap-3 text-base md:text-lg">
        <UIcon
          name="i-lucide-message-circle"
          class="size-6 shrink-0"
        />
        <p>Line ID: @917mwsfl</p>
      </div>

      <div class="flex items-center gap-3 text-base md:text-lg">
        <UIcon
          name="i-lucide-globe"
          class="size-6 shrink-0"
        />
        <p>www.saving-sskh.com</p>
      </div>
    </div>
  </div>
</template>
