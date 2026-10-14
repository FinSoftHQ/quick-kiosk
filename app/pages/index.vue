<script setup lang="ts">
/* eslint-disable better-tailwindcss/no-unknown-classes -- scoped plain CSS ported from reference kiosk design; classes are not Tailwind utilities */
import { onUnmounted, ref } from 'vue'
import { parseKioskPayload, useKioskScanner } from '~/composables/useKioskScanner'

definePageMeta({ layout: false })

useHead({
  title: 'SSKH Kiosk — ยืนยันยอดหุ้น-หนี้'
})

type Step = 'idle' | 'verify' | 'sent'

const step = ref<Step>('idle')

interface LookupMember {
  member_code: string
  full_name: string
  section_name: string | null
  member_status: string | null
}

const verified = ref<LookupMember | null>(null)

interface SessionDto {
  token: string
  confirm_path: string
  member_name: string
  member_code: string
  confirm_url: string
  line_delivered: boolean
}

const sentSession = ref<SessionDto | null>(null)

// ── countdown on the sent screen ──
const COUNTDOWN_SECONDS = 15
const countdown = ref(COUNTDOWN_SECONDS)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function startCountdown() {
  stopCountdown()
  countdown.value = COUNTDOWN_SECONDS
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) resetToIdle()
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function resetToIdle() {
  stopCountdown()
  step.value = 'idle'
  verified.value = null
  sentSession.value = null
  scanBuffer.value = ''
}

// ── scanner ──
function handlePayload(memberCode: string) {
  if (step.value !== 'idle') return
  showVerify(memberCode)
}

const { supported: scannerSupported, scanning, error: cameraError, start: startScanner, stop: stopScanner }
  = useKioskScanner(handlePayload)

const videoEl = ref<HTMLVideoElement | null>(null)

async function initScanner() {
  if (step.value === 'idle' && scannerSupported && videoEl.value) {
    await startScanner(videoEl.value)
  }
}

// ── USB scanner (keyboard wedge): เครื่องสแกนพิมพ์ payload + Enter เอง ──
const scanBuffer = ref('')

function submitScanBuffer() {
  const code = parseKioskPayload(scanBuffer.value)
  scanBuffer.value = ''
  if (!code) return
  showVerify(code)
}

function onScannerKey(e: KeyboardEvent) {
  if (step.value !== 'idle') return
  if (e.key === 'Enter') {
    e.preventDefault()
    submitScanBuffer()
  } else if (e.key.length === 1 && scanBuffer.value.length < 200) {
    scanBuffer.value += e.key
  } else if (e.key === 'Backspace') {
    scanBuffer.value = scanBuffer.value.slice(0, -1)
  } else if (e.key === 'Escape') {
    scanBuffer.value = ''
  }
}

// ── flow ──
function showVerify(memberCode: string) {
  verified.value = {
    member_code: memberCode,
    full_name: 'ทดสอบ สมาชิกทดสอบ',
    section_name: 'การเงิน',
    member_status: 'ปกติ'
  }
  step.value = 'verify'
  stopScanner()
}

function publishConfirmation(memberCode: string) {
  $fetch('/api/ably/publish-confirmation', { method: 'POST', body: { member_code: memberCode } })
    .catch(e => console.warn('[kiosk] confirmation publish failed', e))
}

function confirmMember() {
  if (!verified.value) return
  sentSession.value = {
    token: 'mock',
    confirm_path: '',
    member_name: verified.value.full_name,
    member_code: verified.value.member_code,
    confirm_url: '',
    line_delivered: true
  }
  step.value = 'sent'
  startCountdown()
  publishConfirmation(verified.value.member_code)
}

const clock = ref('')

function tick() {
  const d = new Date()
  clock.value
    = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
let clockTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tick()
  clockTimer = setInterval(tick, 1000)
  window.addEventListener('keydown', onScannerKey)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  stopCountdown()
  stopScanner()
  window.removeEventListener('keydown', onScannerKey)
})
</script>

<template>
  <div class="kiosk-root">
    <!-- ═══ STEP 1 · IDLE ═══ -->
    <section
      v-if="step === 'idle'"
      class="screen active"
    >
      <header class="top">
        <div class="brand">
          <img
            class="brandmark"
            src="/sskh-logo.png"
            alt="โลโก้สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ"
          >
          <div>
            <div class="nm">
              สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ จำกัด
            </div>
            <div class="sb">
              Self-Service Kiosk
            </div>
          </div>
        </div>
        <div class="right">
          <div class="clock">
            {{ clock }}
          </div>
        </div>
      </header>

      <div class="body">
        <div class="txt">
          <span class="kicker">ยืนยันยอดหุ้น–หนี้ รายงวด</span>
          <h1>เช็กยอดหุ้น–หนี้<br>ให้ตรงกัน ผ่าน<em>LINE</em></h1>
          <p class="lede">
            ชู QR จาก LINE OA ระบบจะส่งยอดหุ้นและหนี้ล่าสุดของท่านเข้า LINE ส่วนตัว — ตรวจสอบให้ตรงกัน แล้วกด<b>ยืนยัน</b>หรือ<b>แจ้งปัญหา</b>ได้ทันที ไม่ต้องเดินไปที่เคาน์เตอร์
          </p>
          <div class="scan-lead">
            <span class="cam-pointer">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
              กล้องสแกน QR อยู่ <b>บนสุดของเครื่อง</b>
            </span>
            <div
              class="cam-line"
              aria-hidden="true"
            >
              <span class="dot" /><span class="dash" />
            </div>
          </div>
        </div>

        <aside class="scan-side">
          <aside class="scan-card">
            <span class="ribbon">Scan · QR ของฉัน</span>
            <div
              class="scan-well"
              :data-live="scanning"
            >
              <video
                v-show="scanning"
                ref="videoEl"
                class="scan-video"
                playsinline
                muted
              />
              <div
                v-if="scanning"
                class="scan-frame"
                aria-hidden="true"
              />
              <div
                v-else
                class="illu-scan"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 220 200"
                  fill="none"
                >
                  <!-- กล้องบนตู้ kiosk -->
                  <g
                    stroke="#243B55"
                    stroke-width="2.6"
                  >
                    <rect
                      x="66"
                      y="8"
                      width="88"
                      height="28"
                      rx="9"
                      fill="#fff"
                    />
                  </g>
                  <circle
                    class="lens"
                    cx="110"
                    cy="22"
                    r="7"
                    stroke="#243B55"
                    stroke-width="2.6"
                    fill="#F1F0E8"
                  />
                  <circle
                    cx="110"
                    cy="22"
                    r="2.6"
                    fill="#B08D4F"
                  />
                  <circle
                    class="iring r1"
                    cx="110"
                    cy="22"
                    r="7"
                    stroke="#B08D4F"
                    stroke-width="1.6"
                  />
                  <circle
                    class="iring r2"
                    cx="110"
                    cy="22"
                    r="7"
                    stroke="#B08D4F"
                    stroke-width="1.6"
                  />
                  <!-- เส้นประสัญญาณไหลขึ้น -->
                  <g
                    stroke="#B08D4F"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-dasharray="3 7"
                    class="beam"
                  >
                    <path d="M110 44v46" />
                  </g>
                  <path
                    d="M104 50l6-6 6 6"
                    stroke="#B08D4F"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="beamhead"
                  />
                  <!-- มือถือ + มือ ยื่นขึ้นหากล้อง -->
                  <g class="lift">
                    <!-- ฝ่ามือ (หลังเครื่อง) -->
                    <g transform="rotate(-10 150 140)">
                      <path
                        d="M172 130c11 0 19 9 19 20v16c0 11-8 20-19 20h-8v-56Z"
                        fill="#EDC9A4"
                      />
                    </g>
                    <!-- เครื่องมือถือ -->
                    <g
                      class="phone"
                      transform="rotate(-10 150 140)"
                    >
                      <rect
                        x="126"
                        y="84"
                        width="56"
                        height="106"
                        rx="14"
                        fill="#fff"
                        stroke="#243B55"
                        stroke-width="2.6"
                      />
                      <rect
                        x="132"
                        y="90"
                        width="44"
                        height="94"
                        rx="8"
                        fill="#F6F5F0"
                      />
                      <!-- QR บนจอ -->
                      <g>
                        <rect
                          x="137"
                          y="95"
                          width="15"
                          height="15"
                          rx="2.5"
                          fill="#243B55"
                        />
                        <rect
                          x="140"
                          y="98"
                          width="9"
                          height="9"
                          rx="1.5"
                          fill="#F6F5F0"
                        />
                        <rect
                          x="142.5"
                          y="100.5"
                          width="4"
                          height="4"
                          rx="1"
                          fill="#243B55"
                        />
                        <rect
                          x="156"
                          y="95"
                          width="15"
                          height="15"
                          rx="2.5"
                          fill="#243B55"
                        />
                        <rect
                          x="159"
                          y="98"
                          width="9"
                          height="9"
                          rx="1.5"
                          fill="#F6F5F0"
                        />
                        <rect
                          x="161.5"
                          y="100.5"
                          width="4"
                          height="4"
                          rx="1"
                          fill="#243B55"
                        />
                        <rect
                          x="137"
                          y="114"
                          width="15"
                          height="15"
                          rx="2.5"
                          fill="#243B55"
                        />
                        <rect
                          x="140"
                          y="117"
                          width="9"
                          height="9"
                          rx="1.5"
                          fill="#F6F5F0"
                        />
                        <rect
                          x="142.5"
                          y="119.5"
                          width="4"
                          height="4"
                          rx="1"
                          fill="#243B55"
                        />
                        <rect
                          x="157"
                          y="114"
                          width="6"
                          height="6"
                          rx="1.5"
                          fill="#243B55"
                        />
                        <rect
                          x="165"
                          y="117"
                          width="6"
                          height="6"
                          rx="1.5"
                          fill="#243B55"
                        />
                        <rect
                          x="157"
                          y="122"
                          width="6"
                          height="6"
                          rx="1.5"
                          fill="#243B55"
                        />
                        <rect
                          x="137"
                          y="134"
                          width="36"
                          height="6"
                          rx="3"
                          opacity=".25"
                        />
                        <rect
                          x="137"
                          y="146"
                          width="24"
                          height="6"
                          rx="3"
                          opacity=".25"
                        />
                      </g>
                    </g>
                    <!-- มือ: นิ้วทับหน้าเครื่อง + โป้ง -->
                    <g transform="rotate(-10 150 140)">
                      <rect
                        x="116"
                        y="136"
                        width="52"
                        height="11"
                        rx="5.5"
                        fill="#F1D4B0"
                      />
                      <rect
                        x="114"
                        y="151"
                        width="56"
                        height="11"
                        rx="5.5"
                        fill="#EDC9A4"
                      />
                      <rect
                        x="115"
                        y="166"
                        width="53"
                        height="11"
                        rx="5.5"
                        fill="#F1D4B0"
                      />
                      <rect
                        x="119"
                        y="181"
                        width="44"
                        height="11"
                        rx="5.5"
                        fill="#E9C199"
                      />
                      <path
                        d="M116 136c-5 0-9 4-9 10v20c0 6 4 11 10 11l20-3c5-1 8-5 8-10v-16c0-6-4-10-9-10l-20-2Z"
                        fill="#EDC9A4"
                      />
                    </g>
                  </g>
                </svg>
              </div>
            </div>
            <p class="hint">
              ยื่น <b>QR Code</b> ไปที่กล้องบริเวณขอบด้านบนของเครื่อง<br>ระบบจะสแกนให้อัตโนมัติ
            </p>
            <p
              v-if="cameraError"
              class="cam-err"
            >
              {{ cameraError }}
            </p>
            <button
              v-if="!cameraError && scannerSupported && !scanning"
              class="btn btn-primary btn-scan"
              @click="initScanner"
            >
              เริ่มการสแกน
            </button>
            <p
              v-if="!scanning"
              class="subtle"
            >
              ใช้เวลาเพียงเสี้ยววินาที
            </p>
          </aside>
        </aside>

        <div class="ledger-wrap">
          <div class="ledger">
            <div class="row">
              <span class="n">01</span><span class="t">เปิดแอป <b>LINE OA</b> ของสหกรณ์</span>
            </div>
            <div class="row">
              <span class="n">02</span><span class="t">เลือกเมนู <b>“QR ของฉัน”</b></span>
            </div>
            <div class="row">
              <span class="n">03</span><span class="t">ยื่น QR ไปที่ <b>กล้อง</b> — ยืนยันยอดใน LINE</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="foot">
        <span class="foot-secure">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><rect
            x="4"
            y="11"
            width="16"
            height="10"
            rx="2"
          /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          ข้อมูลของท่านเข้ารหัสลับตลอดการใช้งาน
        </span>
        <span>SSKH CO-OP</span>
      </footer>
    </section>

    <!-- ═══ STEP 2 · VERIFY ═══ -->
    <section
      v-else-if="step === 'verify' && verified"
      class="screen screen-verify"
    >
      <header class="top">
        <div class="brand">
          <img
            class="brandmark"
            src="/sskh-logo.png"
            alt="โลโก้สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ"
          >
          <div>
            <div class="nm">
              SSKH KIOSK
            </div>
            <div class="sb">
              ตรวจสอบตัวตน
            </div>
          </div>
        </div>
        <div class="right">
          <div class="clock">
            ขั้นตอน 2 จาก 3
          </div>
        </div>
      </header>

      <div class="vcard">
        <div class="seal">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="8.5"
            r="4"
          /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
        </div>
        <div>
          <span class="vpill">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M20 6 9 17l-5-5" /></svg>
            พบข้อมูลสมาชิก</span>
        </div>
        <h2>{{ verified.full_name }}</h2>
        <p class="mno">
          เลขสมาชิก <b>{{ verified.member_code }}</b><template v-if="verified.section_name">
            &nbsp;·&nbsp; {{ verified.section_name }}
          </template>
        </p>
        <div class="sep" />
        <p class="prompt">
          โปรดตรวจสอบว่าเป็นท่านถูกต้อง<br>กดยืนยันเพื่อส่งยอดเข้า LINE ส่วนตัวของท่าน
        </p>
        <div class="acts">
          <button
            class="btn btn-ghost"
            @click="resetToIdle"
          >
            ไม่ใช่ — เริ่มใหม่
          </button>
          <button
            class="btn btn-primary"
            @click="confirmMember"
          >
            ถูกต้อง ส่งยอดเข้า LINE
          </button>
        </div>
      </div>

      <footer class="foot">
        <span>ยืนยันการใช้งานด้วยตนเองเท่านั้น</span><span>SSKH CO-OP</span>
      </footer>
    </section>

    <!-- ═══ STEP 3 · SENT ═══ -->
    <section
      v-else-if="step === 'sent' && sentSession"
      class="screen screen-sent"
    >
      <header class="top">
        <div class="brand">
          <img
            class="brandmark"
            src="/sskh-logo.png"
            alt="โลโก้สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ"
          >
          <div>
            <div class="nm">
              SSKH KIOSK
            </div>
            <div class="sb">
              เสร็จสิ้น
            </div>
          </div>
        </div>
        <div class="right">
          <div class="clock">
            เสร็จสมบูรณ์
          </div>
        </div>
      </header>

      <div class="sent-wrap">
        <div class="vcard sent-card">
          <div class="ring">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M4 12.5l5.5 5.5L20 6.5" /></svg>
          </div>
          <h2 class="sent-h2">
            {{ sentSession.line_delivered ? 'ส่งยอดเข้า LINE ของท่านแล้ว' : 'สแกนเพื่อดูยอดบนมือถือของท่าน' }}
          </h2>
          <p class="who">
            <b>{{ sentSession.member_name }}</b> · {{ sentSession.member_code }}
          </p>

          <div
            v-if="sentSession.line_delivered"
            class="journey"
          >
            <div class="jr">
              <span class="n">๑</span>ดูมือถือของท่านตอนนี้
            </div>
            <span class="arrow">→</span>
            <div class="jr">
              <span class="n">๒</span>ตรวจยอดหุ้น–หนี้ให้ตรงกัน
            </div>
            <span class="arrow">→</span>
            <div class="jr hot">
              <span class="n">๓</span>กดยืนยัน / แจ้งปัญหา
            </div>
          </div>

          <p class="calm">
            ยืนยันเสร็จบนมือถือของท่านเท่านั้น — ปิดหน้าจอนี้ได้เลย
          </p>
          <div class="track">
            <div
              class="bar"
              style="--ttl:15s"
            />
          </div>
          <p class="cd">
            กลับหน้าสแกนอัตโนมัติใน <span>{{ countdown }}</span> วินาที
          </p>
          <button
            class="btn btn-primary"
            @click="resetToIdle"
          >
            กลับหน้ารอสแกน
          </button>
        </div>
      </div>

      <footer class="foot">
        <span>ยืนยันยอดบนมือถือของท่าน</span><span>SSKH CO-OP</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
/* Ported from prototype-kiosk design (kiosk-final.html) — Anuphan / navy-gold */
.kiosk-root {
  font-family: 'Anuphan', sans-serif;
  color: #0A2540;
  background:
    radial-gradient(1100px 520px at 88% -12%, #E7EEF6 0%, transparent 60%),
    radial-gradient(800px 420px at -8% 112%, #E9EFEF 0%, transparent 55%),
    #F4F6F9;
  min-height: 100dvh;
}
.kiosk-root *{margin:0;padding:0;box-sizing:border-box}
.screen{
  min-height:100dvh;display:flex;flex-direction:column;
  padding:clamp(18px,3.8vmin,44px) clamp(22px,5.4vw,84px) clamp(64px,9vh,88px);
  max-width:1480px;margin:0 auto;width:100%;position:relative;
  animation:reveal .55s cubic-bezier(.2,.8,.3,1);
}
@keyframes reveal{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.top{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;
  padding-bottom:clamp(14px,2.8vmin,26px);border-bottom:1px solid #DFE6EE;position:relative}
.top::after{content:"";position:absolute;left:0;bottom:-1px;width:clamp(64px,10vw,120px);height:2px;background:#B08D4F}
.brand{display:flex;align-items:center;gap:clamp(10px,1.8vmin,16px);min-width:0}
.brandmark{flex:none;width:clamp(60px,9.5vmin,92px);height:clamp(60px,9.5vmin,92px);object-fit:contain;display:block}
.brand .nm{font-weight:700;font-size:clamp(18px,3.2vmin,30px)}
.brand .sb{font-size:clamp(12px,2vmin,17px);color:#7E93AB;letter-spacing:.22em;text-transform:uppercase;margin-top:4px}
.top .right{display:flex;align-items:center;gap:clamp(12px,2.4vmin,24px)}
.clock{font-size:clamp(10px,1.5vmin,13px);color:#7E93AB;font-variant-numeric:tabular-nums;white-space:nowrap}
.kicker{display:inline-flex;align-items:center;gap:12px;font-size:clamp(10px,1.5vmin,13px);font-weight:600;
  letter-spacing:.3em;text-transform:uppercase;color:#B08D4F}
.kicker::before{content:"";width:clamp(24px,4vmin,40px);height:1px;background:#B08D4F}
h1{font-weight:600;font-size:clamp(30px,6vmin,62px);line-height:1.22;letter-spacing:-.015em;
  margin:clamp(14px,3vmin,26px) 0 clamp(12px,2.6vmin,20px)}
h1 em{font-style:normal;color:#0F3B66;position:relative;white-space:nowrap}
h1 em::after{content:"";position:absolute;left:0;right:0;bottom:.06em;height:.32em;background:#F4EBDB;z-index:-1}
.lede{font-size:clamp(13.5px,2.1vmin,18px);color:#3E5876;line-height:1.95;max-width:46ch}
.lede b{font-weight:600;color:#0A2540}
.body{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:clamp(16px,3vmin,30px);padding-top:clamp(8px,2vmin,18px)}
.txt{max-width:680px}
.txt .kicker{justify-content:center}
.txt .kicker::after{content:"";width:clamp(24px,4vmin,40px);height:1px;background:#B08D4F}
.lede{margin:0 auto}
.scan-lead{display:flex;flex-direction:column;align-items:center;gap:0;margin-top:clamp(10px,2vmin,18px)}
.cam-pointer{display:inline-flex;align-items:center;gap:10px;
  background:#F4EBDB;border:1px solid #E7D9BC;color:#8A6B33;
  font-size:clamp(11px,1.7vmin,14px);font-weight:600;padding:9px 20px;border-radius:999px}
.cam-pointer svg{width:14px;height:14px}
.cam-pointer b{color:#6E5426}
.cam-line{display:flex;flex-direction:column;align-items:center;margin-top:clamp(4px,1vmin,8px)}
.cam-line .dot{width:9px;height:9px;border-radius:50%;background:#B08D4F;animation:blink 1.4s ease-in-out infinite}
.cam-line .dash{width:2px;height:clamp(18px,3.4vmin,34px);
  background:repeating-linear-gradient(180deg,#B08D4F 0 6px,transparent 6px 12px)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
.ledger-wrap{width:100%;display:flex;justify-content:center}
.ledger{margin-top:clamp(6px,1.6vmin,14px);max-width:640px;width:100%;text-align:left}
.ledger .row{display:flex;align-items:baseline;gap:clamp(12px,2.2vmin,20px);padding:clamp(12px,2.2vmin,18px) 2px;
  border-top:1px solid #DFE6EE;font-size:clamp(12.5px,1.95vmin,16.5px);color:#3E5876}
.ledger .row:last-child{border-bottom:1px solid #DFE6EE}
.ledger .n{font-weight:700;color:#B08D4F;font-size:clamp(10px,1.5vmin,12.5px);letter-spacing:.12em;flex:none;width:26px}
.ledger .t b{color:#0A2540;font-weight:600}
.illu-scan{width:clamp(200px,34vmin,310px);margin:0 auto}
.illu-scan svg{width:100%;height:auto;display:block;overflow:visible}
.illu-scan .lift{animation:liftUp 2.6s cubic-bezier(.45,0,.35,1) infinite;transform-box:fill-box;transform-origin:center}
@keyframes liftUp{
  0%{transform:translateY(6px)}
  45%{transform:translateY(-38px)}
  65%{transform:translateY(-38px)}
  100%{transform:translateY(6px)}
}
.illu-scan .iring{transform-box:fill-box;transform-origin:center;opacity:0}
.illu-scan .r1{animation:pulse 2s ease-out infinite}
.illu-scan .r2{animation:pulse 2s ease-out 1s infinite}
.illu-scan .beam{animation:flow 1.4s linear infinite}
@keyframes flow{0%{stroke-dashoffset:20}100%{stroke-dashoffset:0}}
.illu-scan .beamhead{animation:headUp 1.4s ease-in-out infinite}
@keyframes headUp{0%,100%{opacity:.25}50%{opacity:1}}
.scan-card .subtle{margin-top:clamp(8px,1.5vmin,12px);font-size:clamp(10.5px,1.6vmin,13px);color:#7E93AB}
.btn-scan{margin-top:clamp(12px,2.2vmin,18px);width:min(100%,520px)}
.foot-secure{display:inline-flex;align-items:center;gap:8px}
.foot-secure svg{width:14px;height:14px;color:#0E6B5C}
.scan-side{display:flex;flex-direction:column;gap:clamp(14px,2.6vmin,24px);width:min(100%,680px)}
.scan-card{background:#fff;border:1px solid #DFE6EE;border-radius:26px;align-self:stretch;
  padding:clamp(24px,4.4vmin,42px) clamp(22px,4.4vmin,42px) clamp(20px,3.6vmin,34px);
  display:flex;flex-direction:column;align-items:center;text-align:center;
  box-shadow:0 40px 90px -42px rgba(10,37,64,.35), 0 12px 30px -18px rgba(10,37,64,.18)}
.ribbon{display:inline-flex;align-items:center;gap:8px;margin-bottom:clamp(14px,2.8vmin,24px);
  background:#F4EBDB;color:#8A6B33;border:1px solid #E7D9BC;font-size:clamp(9.5px,1.4vmin,12px);
  font-weight:600;letter-spacing:.18em;padding:7px 18px;border-radius:999px;text-transform:uppercase}
.scan-well{position:relative;width:clamp(200px,32vmin,340px);height:clamp(200px,32vmin,340px);
  border-radius:22px;background:linear-gradient(180deg,#FBFCFE,#F4F7FA);border:1px solid #DFE6EE;
  overflow:hidden;box-shadow:inset 0 2px 10px rgba(10,37,64,.06)}
.scan-video{width:100%;height:100%;object-fit:cover;display:block}
.scan-frame{position:absolute;inset:14px;border:2px solid #B08D4F;border-radius:14px;pointer-events:none;
  -webkit-mask:linear-gradient(#fff,#fff) top left/34px 34px no-repeat,linear-gradient(#fff,#fff) top right/34px 34px no-repeat,linear-gradient(#fff,#fff) bottom left/34px 34px no-repeat,linear-gradient(#fff,#fff) bottom right/34px 34px no-repeat;
  mask:linear-gradient(#fff,#fff) top left/34px 34px no-repeat,linear-gradient(#fff,#fff) top right/34px 34px no-repeat,linear-gradient(#fff,#fff) bottom left/34px 34px no-repeat,linear-gradient(#fff,#fff) bottom right/34px 34px no-repeat}
.scan-card .hint{margin-top:clamp(14px,2.8vmin,26px);font-size:clamp(12.5px,2vmin,16.5px);color:#3E5876;line-height:1.8}
.scan-card .hint b{color:#0A2540;font-weight:600}
.cam-err{margin-top:12px;color:#B42318;font-size:clamp(11px,1.6vmin,14px)}
.btn{-webkit-tap-highlight-color:transparent;border:0;cursor:pointer;font-family:'Anuphan',sans-serif;
  font-weight:600;border-radius:14px;font-size:clamp(14px,2.2vmin,17.5px);
  padding:clamp(14px,2.4vmin,20px) clamp(26px,4.6vmin,52px);color:#fff;
  transition:transform .18s ease, box-shadow .25s ease}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:default}
.btn-primary{background:linear-gradient(180deg,#0F3B66,#0A2540);box-shadow:0 18px 34px -14px rgba(10,37,64,.55)}
.btn-gold{background:linear-gradient(180deg,#C29A55,#B08D4F);box-shadow:0 18px 34px -14px rgba(176,141,79,.55)}
.btn-ghost{background:transparent;color:#3E5876;border:1px solid #DFE6EE}
.btn-ghost:hover{background:#fff;border-color:#CBD6E2;color:#0A2540}
/* scanner input */
/* verify / sent cards */
.screen-verify{align-items:center}
.screen-verify .vcard{margin:auto 0}
.vcard{background:#fff;border:1px solid #DFE6EE;border-radius:28px;
  width:min(840px,100%);margin:clamp(20px,5vmin,48px) auto 0;
  padding:clamp(28px,6vmin,54px) clamp(28px,7vmin,90px) clamp(26px,5vmin,48px);
  box-shadow:0 40px 90px -42px rgba(10,37,64,.35);text-align:center;position:relative}
.vcard::before{content:"";position:absolute;top:0;left:clamp(24px,6vmin,68px);right:clamp(24px,6vmin,68px);
  height:2px;background:linear-gradient(90deg,transparent,#B08D4F,transparent)}
.seal{width:clamp(76px,13vmin,108px);height:clamp(76px,13vmin,108px);border-radius:50%;margin:0 auto;
  background:linear-gradient(160deg,#0F3B66,#0A2540);display:grid;place-items:center;
  box-shadow:0 0 0 10px #EDF1F6, 0 20px 40px -18px rgba(10,37,64,.5)}
.seal svg{width:46%;height:46%;color:#fff}
.vpill{display:inline-flex;align-items:center;gap:8px;margin-top:clamp(16px,3vmin,24px);
  background:#E4F0EC;color:#0E6B5C;border:1px solid #CBE0D9;font-size:clamp(11px,1.7vmin,14px);
  font-weight:600;padding:9px 22px;border-radius:999px}
.vpill svg{width:14px;height:14px}
h2{font-weight:600;font-size:clamp(26px,5.4vmin,46px);letter-spacing:-.01em;margin-top:clamp(14px,2.8vmin,22px)}
.mno{margin-top:12px;font-size:clamp(16px,2.8vmin,24px);color:#7E93AB;font-variant-numeric:tabular-nums;letter-spacing:.07em}
.mno b{color:#0F3B66;font-weight:700;font-size:1.15em;letter-spacing:.1em}
.sep{height:1px;background:#DFE6EE;margin:clamp(18px,3.4vmin,30px) clamp(6px,2vmin,24px) clamp(14px,3vmin,26px);position:relative}
.sep::after{content:"✦";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  background:#fff;padding:0 14px;color:#B08D4F;font-size:11px}
.prompt{font-size:clamp(13px,2.1vmin,17.5px);color:#3E5876;line-height:1.9}
.acts{display:flex;gap:14px;margin-top:clamp(20px,4.2vmin,36px);flex-wrap:wrap;justify-content:center}
.acts .btn{flex:1;min-width:220px;white-space:nowrap}
.sent-wrap{flex:1;display:flex;align-items:center;width:100%;justify-content:center}
.screen-sent{align-items:center}
.sent-card{width:min(840px,100%);margin:auto 0;padding-top:clamp(56px,10vmin,84px)}
/* ring ยื่นลอยเหนือขอบการ์ดตาม prototype */
.sent-card .ring{margin-top:calc(-1 * clamp(90px,15vmin,130px))}
.sent-card .journey{margin-top:clamp(20px,4vmin,34px);gap:clamp(6px,1.2vmin,12px)}
.sent-card .jr{padding:clamp(10px,1.8vmin,14px) clamp(10px,1.8vmin,18px);font-size:clamp(11px,1.7vmin,14px);gap:8px}
.sent-card .jr .n{width:20px;height:20px;font-size:10px}
.sent-card .btn-primary{margin-top:clamp(16px,3.2vmin,28px);width:100%}
.sent-h2{margin-top:clamp(16px,3.2vmin,26px)}
.ring{width:clamp(84px,14vmin,116px);height:clamp(84px,14vmin,116px);border-radius:50%;margin:0 auto;
  background:linear-gradient(160deg,#0F3B66,#0A2540);display:grid;place-items:center;
  box-shadow:0 0 0 12px #EDF1F6, 0 26px 50px -20px rgba(10,37,64,.5)}
.ring svg{width:46%;height:46%;color:#B08D4F}
.ring{position:relative}
.ring::after{content:"";position:absolute;inset:-12px;border-radius:50%;
  border:2px solid #B08D4F;opacity:0;animation:pulse 2.2s ease-out .4s}
.ring svg path{stroke-dasharray:40;stroke-dashoffset:40;animation:draw .7s .3s ease forwards}
@keyframes pulse{0%{transform:scale(.9);opacity:.8}100%{transform:scale(1.25);opacity:0}}
@keyframes draw{to{stroke-dashoffset:0}}
.who{margin-top:12px;font-size:clamp(13px,2.2vmin,18.5px);color:#3E5876}
.who b{color:#0A2540;font-weight:600}
.journey{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:clamp(8px,1.8vmin,16px);
  margin-top:clamp(24px,4.8vmin,42px)}
.jr{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #DFE6EE;border-radius:16px;
  padding:clamp(11px,2vmin,16px) clamp(14px,2.8vmin,26px);font-size:clamp(11.5px,1.9vmin,15.5px);
  color:#3E5876;box-shadow:0 4px 14px -8px rgba(10,37,64,.15)}
.jr .n{width:clamp(21px,3.2vmin,27px);height:clamp(21px,3.2vmin,27px);border-radius:50%;background:#EDF1F6;
  border:1px solid #DFE6EE;display:grid;place-items:center;font-size:clamp(9px,1.35vmin,12px);font-weight:700;color:#7E93AB;flex:none}
.jr.hot{border-color:#E0D3B6;background:linear-gradient(180deg,#FDFBF6,#F9F3E7);color:#7A5F2E;font-weight:600}
.jr.hot .n{background:#B08D4F;border-color:#B08D4F;color:#fff}
.arrow{color:#B9C6D4}
.calm{margin-top:clamp(16px,3.4vmin,28px);font-size:clamp(12px,1.9vmin,15.5px);color:#7E93AB}
.track{width:min(320px,74%);height:3px;border-radius:3px;background:#DFE6EE;overflow:hidden;
  margin:clamp(18px,3.8vmin,32px) auto 0}
.track .bar{height:100%;background:linear-gradient(90deg,#B08D4F,#C29A55);transform-origin:left;
  animation:drain var(--ttl,15s) linear forwards}
@keyframes drain{to{transform:scaleX(0)}}
.cd{margin-top:12px;font-size:clamp(10px,1.5vmin,12.5px);color:#7E93AB;letter-spacing:.12em;font-variant-numeric:tabular-nums}
.foot{position:absolute;left:clamp(22px,5.4vw,84px);right:clamp(22px,5.4vw,84px);
  bottom:clamp(14px,3vh,30px);display:flex;justify-content:space-between;gap:12px;
  font-size:clamp(9.5px,1.4vmin,12.5px);color:#7E93AB;letter-spacing:.05em;
  border-top:1px solid #DFE6EE;padding-top:clamp(10px,2vmin,16px)}
/* จอแนวตั้งต่ำกว่าจอตู้ (เช่น 800×1280): หดบ่อสแกนเล็กน้อยเพื่อไม่ให้หน้าเลื่อน */
@media (max-height:1399px){
  .scan-well{width:clamp(180px,26vmin,256px);height:clamp(180px,26vmin,256px)}
  .illu-scan{width:clamp(180px,26vmin,256px)}
}
/* จอตู้จริง 1080×1920 */
@media (min-width:1000px) and (min-height:1700px){
  .screen{padding:44px 88px 104px}
  .brand .nm{font-size:26px}
  .clock{font-size:20px}
  .kicker{font-size:18px}
  h1{font-size:60px}
  .lede{font-size:22px}
  .ledger .row{font-size:22px}
  .scan-well{width:400px;height:400px}
  h2{font-size:48px}
  .btn{font-size:24px;padding:22px 54px;border-radius:16px}
  .foot{font-size:17px}
}
</style>
