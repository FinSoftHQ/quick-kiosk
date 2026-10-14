<script setup lang="ts">
/* eslint-disable better-tailwindcss/no-unknown-classes -- scoped plain CSS ported from reference kiosk design; classes are not Tailwind utilities */
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { useApiFetch } from '~/composables/useApiFetch'

useHead({ title: 'Kiosk — รายการยืนยันยอด · SSKH' })

const api = useApiFetch()

interface KioskSessionRow {
  id: string
  memberCode: string
  memberName: string
  sectionName: string | null
  source: string
  status: 'sent' | 'confirmed' | 'issue_reported'
  issueNote: string | null
  createdAt: number
  resolvedAt: number | null
}

const items = ref<KioskSessionRow[]>([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (search.value.trim()) params.set('q', search.value.trim())
    const res = await api.get<{ items: KioskSessionRow[] }>(
      `/api/v-latest/kiosk/sessions${params.size ? `?${params}` : ''}`
    )
    items.value = res.items
  } catch (e) {
    error.value = (e as { data?: { error?: string } })?.data?.error || 'โหลดรายการไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const STATUS_LABEL: Record<string, string> = {
  sent: 'ส่งเข้า LINE แล้ว',
  confirmed: 'ยืนยันยอด (จาก LINE)',
  issue_reported: 'แจ้งหมายเหตุ (จาก LINE)'
}

function rowDetail(row: KioskSessionRow): string {
  if (row.status === 'sent') {
    return `ตู้ kiosk ${row.source === 'qr' ? 'สแกน QR สำเร็จ' : 'พิมพ์รหัสสมาชิก'} ส่งยอดเข้า LINE สมาชิก`
  }
  if (row.status === 'confirmed') return 'ยอดถูกต้องทุกรายการ'
  return row.issueNote?.trim() || 'ไม่ระบุรายละเอียด'
}

function fmtTime(ms: number | null): string {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

// ── CSV export (client-side, BOM for Excel) ──
function exportCsv() {
  const esc = (s: unknown) => `"${String(s ?? '').replaceAll('"', '""')}"`
  const header = ['วัน-เวลา', 'รหัสสมาชิก', 'ชื่อ-สกุล', 'การทำรายการ', 'รายละเอียด', 'เวลาดำเนินการ']
  const rows = items.value.map(r =>
    [fmtTime(r.createdAt), r.memberCode, r.memberName, STATUS_LABEL[r.status] ?? r.status, rowDetail(r), fmtTime(r.resolvedAt)]
      .map(esc)
      .join(',')
  )
  const csv = '\uFEFF' + [header.join(','), ...rows].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `kiosk-sessions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── QR builder ──
const qrOpen = ref(false)
const qrCode = ref('')
const qrName = ref('')
const qrDataUrl = ref('')
const qrError = ref('')
const qrModalEl = ref<HTMLDivElement | null>(null)

async function openQr() {
  const code = qrCode.value.trim()
  qrError.value = ''
  if (!/^\d{3,8}$/.test(code)) {
    qrError.value = 'รหัสสมาชิกต้องเป็นตัวเลข 3–8 หลัก'
    return
  }
  try {
    const member = await api.get<{ full_name: string }>(`/api/v-latest/kiosk/lookup?code=${encodeURIComponent(code)}`)
    qrName.value = member.full_name
    qrDataUrl.value = await QRCode.toDataURL(`SSKH:${code}`, { width: 320, margin: 2 })
    qrOpen.value = true
  } catch (e) {
    qrError.value = (e as { data?: { error?: string } })?.data?.error || 'ไม่พบรหัสสมาชิกนี้'
  }
}

function printQr() {
  if (!qrModalEl.value) return
  const win = window.open('', '_blank', 'width=480,height=640')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>QR ${qrCode.value}</title>
  <style>body{font-family:sans-serif;text-align:center;padding:32px}img{width:280px}</style></head>
  <body><h2>SSKH — ยืนยันยอดหุ้น-หนี้</h2><img src="${qrDataUrl.value}" alt="QR" />
  <h3>${qrName.value} (${qrCode.value})</h3><script>window.onload=()=>window.print();<\/script></body></html>`) // eslint-disable-line no-useless-escape -- escape required: a literal closing script tag would end the SFC block
  win.document.close()
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-head">
      <h1>รายการยืนยันยอดจากตู้ Kiosk</h1>
      <div class="head-actions">
        <select
          v-model="statusFilter"
          class="ctrl"
          @change="load"
        >
          <option value="">
            ทั้งหมด
          </option>
          <option value="sent">
            ส่งเข้า LINE แล้ว
          </option>
          <option value="confirmed">
            ยืนยันยอด (จาก LINE)
          </option>
          <option value="issue_reported">
            แจ้งหมายเหตุ (จาก LINE)
          </option>
        </select>
        <input
          v-model="search"
          class="ctrl"
          placeholder="ค้นหารหัส/ชื่อสมาชิก"
          @keyup.enter="load"
        >
        <button
          class="btn"
          @click="load"
        >
          ↻ รีเฟรช
        </button>
        <button
          class="btn primary"
          @click="exportCsv"
        >
          ▤ ดาวน์โหลด Excel
        </button>
      </div>
    </header>

    <section class="qr-builder">
      <h2>สร้าง QR สำหรับสมาชิก</h2>
      <div class="qr-row">
        <input
          v-model="qrCode"
          class="ctrl"
          inputmode="numeric"
          placeholder="รหัสสมาชิก เช่น 003213"
          @keyup.enter="openQr"
        >
        <button
          class="btn primary"
          @click="openQr"
        >
          สร้าง QR
        </button>
      </div>
      <p
        v-if="qrError"
        class="err"
      >
        {{ qrError }}
      </p>
    </section>

    <p
      v-if="error"
      class="err"
    >
      {{ error }}
    </p>
    <p
      v-if="!loading && !items.length"
      class="empty"
    >
      ยังไม่มีรายการ — ทำรายการที่ตู้ kiosk ก่อน
    </p>

    <div
      v-if="items.length"
      class="table-wrap"
    >
      <table>
        <thead>
          <tr>
            <th>วัน-เวลา</th>
            <th>รหัสสมาชิก</th>
            <th>ชื่อ-สกุล</th>
            <th>ช่องทาง</th>
            <th>การทำรายการ</th>
            <th>รายละเอียด</th>
            <th>ยืนยัน/แก้ไขเมื่อ</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in items"
            :key="row.id"
          >
            <td class="mono">
              {{ fmtTime(row.createdAt) }}
            </td>
            <td class="mono">
              {{ row.memberCode }}
            </td>
            <td>{{ row.memberName }}</td>
            <td>{{ row.source === 'qr' ? 'QR' : 'พิมพ์รหัส' }}</td>
            <td>
              <span
                class="badge"
                :class="row.status"
              >{{ STATUS_LABEL[row.status] }}</span>
            </td>
            <td class="note">
              {{ rowDetail(row) }}
            </td>
            <td class="mono">
              {{ fmtTime(row.resolvedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- QR modal -->
    <div
      v-if="qrOpen"
      class="modal-backdrop"
      @click.self="qrOpen = false"
    >
      <div
        ref="qrModalEl"
        class="modal"
      >
        <h3>QR ยืนยันยอด</h3>
        <img
          :src="qrDataUrl"
          alt="QR code"
          width="280"
          height="280"
        >
        <p class="qr-name">
          {{ qrName }} ({{ qrCode }})
        </p>
        <p class="qr-payload mono">
          SSKH:{{ qrCode }}
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            @click="printQr"
          >
            🖨 พิมพ์
          </button>
          <button
            class="btn ghost"
            @click="qrOpen = false"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page{margin:0 auto;padding:24px clamp(16px,3vw,40px) 40px;font-family:'Anuphan',sans-serif;color:#1F2937}
.admin-page *{box-sizing:border-box}
.admin-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.admin-head h1{font-size:22px;font-weight:700;margin:0}
.head-actions{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}
.ctrl{border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;background:#fff}
.btn{border:1px solid #D1D5DB;background:#fff;border-radius:8px;padding:8px 14px;font-size:14px;font-weight:600;
  cursor:pointer;font-family:inherit}
.btn.primary{background:#0E6B5C;border-color:#0E6B5C;color:#fff}
.btn.ghost{color:#6B7280}
.qr-builder{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:14px;padding:16px;margin-bottom:18px}
.qr-builder h2{font-size:15px;font-weight:700;margin:0 0 10px}
.qr-row{display:flex;gap:8px}
.qr-row .ctrl{max-width:260px}
.err{color:#B42318;font-size:14px;margin:10px 0}
.empty{color:#9CA3AF;text-align:center;padding:48px 0}
.table-wrap{background:#fff;border:1px solid #E5E7EB;border-radius:14px;overflow-x:auto;max-height:calc(100vh - 260px);overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
thead{background:#F9FAFB;color:#6B7280;text-align:left;position:sticky;top:0;z-index:1;box-shadow:0 1px 0 #E5E7EB}
th{padding:12px 16px;font-weight:600;white-space:nowrap}
td{padding:10px 16px;border-top:1px solid #F3F4F6;vertical-align:middle}
tbody tr:hover td{background:#F8FAF9}
.mono{font-variant-numeric:tabular-nums;white-space:nowrap}
.note{color:#6B7280;max-width:480px}
.badge{display:inline-block;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;white-space:nowrap}
td .btn{padding:6px 12px;font-size:13px}
.badge.sent{background:#E0F2FE;color:#0369A1}
.badge.confirmed{background:#D1FAE5;color:#047857}
.badge.issue_reported{background:#FEE2E2;color:#B91C1C}
.modal-backdrop{position:fixed;inset:0;background:rgba(10,37,64,.45);display:grid;place-items:center;z-index:50}
.modal{background:#fff;border-radius:20px;padding:28px;text-align:center}
.modal h3{margin:0 0 14px;font-size:18px}
.qr-name{font-weight:700;margin-top:12px}
.qr-payload{color:#6B7280;font-size:13px;margin-top:4px}
.modal-actions{display:flex;gap:10px;justify-content:center;margin-top:18px}
</style>
