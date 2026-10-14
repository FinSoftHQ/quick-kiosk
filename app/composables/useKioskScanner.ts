import { ref, onUnmounted } from 'vue'

/**
 * Webcam QR scanner for the kiosk page (โน้ตบุค webcam + BarcodeDetector).
 * Browser kiosk is Chrome/Edge, which ship BarcodeDetector natively — no
 * fallback scanning library. When unsupported the page hides the scan panel
 * and shows the on-screen keypad only.
 *
 * Accepted payloads: `SSKH:<memberCode>` (QR created by the admin page) or a
 * bare 4–8 digit code.
 */

export const QR_PAYLOAD_RE = /^SSKH:(\d{3,8})$/
export const BARE_CODE_RE = /^(\d{3,8})$/

export function parseKioskPayload(raw: string): string | null {
  const text = raw.trim()
  return QR_PAYLOAD_RE.exec(text)?.[1] ?? BARE_CODE_RE.exec(text)?.[1] ?? null
}

export function useKioskScanner(onPayload: (memberCode: string) => void) {
  // Chrome/Edge ship BarcodeDetector natively; typed locally because no DOM lib declares it yet.
  type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
  type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window
  const scanning = ref(false)
  const error = ref('')

  let stream: MediaStream | null = null
  let loopTimer: ReturnType<typeof setInterval> | null = null
  // Cooldown so one held-up QR does not fire repeatedly.
  let lastPayload = ''
  let lastPayloadAt = 0

  async function start(videoEl: HTMLVideoElement) {
    if (!supported || scanning.value) return
    error.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      videoEl.srcObject = stream
      await videoEl.play()

      const DetectorCtor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
      const detector = new DetectorCtor({ formats: ['qr_code'] })
      const DETECT_INTERVAL_MS = 250
      const COOLDOWN_MS = 2000
      scanning.value = true
      loopTimer = setInterval(async () => {
        if (videoEl.readyState < 2) return
        try {
          const codes = await detector.detect(videoEl)
          if (!codes.length) return
          const code = parseKioskPayload(codes[0]?.rawValue ?? '')
          if (!code) return
          const now = Date.now()
          if (code === lastPayload && now - lastPayloadAt < COOLDOWN_MS) return
          lastPayload = code
          lastPayloadAt = now
          onPayload(code)
        } catch {
          // transient decode failure — next tick retries
        }
      }, DETECT_INTERVAL_MS)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'ไม่สามารถเปิดกล้องได้'
      stop()
    }
  }

  function stop() {
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
    stream?.getTracks().forEach(t => t.stop())
    stream = null
    scanning.value = false
  }

  onUnmounted(stop)

  return { supported, scanning, error, start, stop }
}
