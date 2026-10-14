<script setup lang="ts">
/* eslint-disable better-tailwindcss/no-unknown-classes -- scoped plain CSS ported from reference kiosk design; classes are not Tailwind utilities */
import { computed, onMounted, ref } from 'vue'
import { useApiFetch } from '~/composables/useApiFetch'

definePageMeta({ layout: false })

useHead({
  title: 'ยืนยันยอดหุ้น-หนี้ · SSKH'
})

const route = useRoute()
const api = useApiFetch()

interface KioskSnapshot {
  share_balance: string | null
  active_loans: Array<{
    contract_number: string
    loan_type_name: string | null
    outstanding_principal: string
    accrued_interest: string
  }>
  savings: { balance: string | null, deposit_type_name: string | null } | null
  taken_at: number
}

interface ConfirmSession {
  member_code: string
  member_name: string
  section_name: string | null
  status: 'sent' | 'confirmed' | 'issue_reported'
  expired: boolean
  snapshot: KioskSnapshot
  issue_note: string | null
}

type Phase = 'loading' | 'ready' | 'not_found' | 'error'
const phase = ref<Phase>('loading')
const session = ref<ConfirmSession | null>(null)
const submitting = ref(false)
const actionError = ref('')
const showIssueForm = ref(false)
const issueNote = ref('')

// สถานะที่แสดง: resolved หรือ expired จะเล่าสถานะแทนฟอร์มยืนยัน
const resolved = computed(() => session.value && session.value.status !== 'sent')
const canAct = computed(() => session.value && !session.value.expired && !resolved.value && phase.value === 'ready')

const token = computed(() => String(route.params.token ?? ''))

onMounted(async () => {
  try {
    session.value = await api.get<ConfirmSession>(`/api/v-latest/kiosk/sessions/${token.value}`)
    phase.value = 'ready'
  } catch (e) {
    phase.value = ((e as { status?: number })?.status === 404 || (e as { statusCode?: number })?.statusCode === 404)
      ? 'not_found'
      : 'error'
  }
})

async function confirm() {
  if (!canAct.value || submitting.value) return
  submitting.value = true
  actionError.value = ''
  try {
    await api.post(`/api/v-latest/kiosk/sessions/${token.value}/confirm`, {})
    session.value = { ...session.value!, status: 'confirmed' }
  } catch (e) {
    applyActionError(e)
  } finally {
    submitting.value = false
  }
}

async function reportIssue() {
  if (!canAct.value || submitting.value) return
  submitting.value = true
  actionError.value = ''
  try {
    await api.post(`/api/v-latest/kiosk/sessions/${token.value}/issue`, { note: issueNote.value || undefined })
    session.value = { ...session.value!, status: 'issue_reported', issue_note: issueNote.value || null }
  } catch (e) {
    applyActionError(e)
  } finally {
    submitting.value = false
  }
}

function applyActionError(e: unknown) {
  const err = e as { data?: { error?: string } }
  actionError.value = err?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}

const money = (v: string | null | undefined) =>
  v == null || v === '' ? '-' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <div class="confirm-root">
    <div class="phone-card">
      <header class="head">
        <div class="head-brand">
          <span class="logo">SSKH</span>
          <div>
            <div class="head-title">
              ยืนยันยอดหุ้น–หนี้
            </div>
            <div class="head-sub">
              สหกรณ์ออมทรัพย์โรงพยาบาลศรีสะเกษ จำกัด
            </div>
          </div>
        </div>
      </header>

      <!-- loading -->
      <div
        v-if="phase === 'loading'"
        class="state"
      >
        <p>กำลังโหลดข้อมูล…</p>
      </div>

      <!-- not found -->
      <div
        v-else-if="phase === 'not_found'"
        class="state"
      >
        <div class="state-icon bad">
          !
        </div>
        <h2>ไม่พบรายการนี้</h2>
        <p class="muted">
          ลิงก์ไม่ถูกต้องหรือถูกยกเลิกไปแล้ว
        </p>
      </div>

      <!-- error -->
      <div
        v-else-if="phase === 'error'"
        class="state"
      >
        <div class="state-icon bad">
          !
        </div>
        <h2>เกิดข้อผิดพลาด</h2>
        <p class="muted">
          ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่
        </p>
      </div>

      <!-- ready / expired / resolved -->
      <div
        v-else-if="session"
        class="content"
      >
        <div class="who">
          <div class="avatar">
            {{ session.member_name.slice(0, 1) }}
          </div>
          <div>
            <div class="who-name">
              {{ session.member_name }}
            </div>
            <div class="who-meta">
              เลขสมาชิก {{ session.member_code }}<template v-if="session.section_name">
                · {{ session.section_name }}
              </template>
            </div>
          </div>
        </div>

        <p
          v-if="session.expired"
          class="banner warn"
        >
          ลิงก์นี้หมดอายุแล้ว (24 ชม.) — กรุณาทำรายการที่ตู้ kiosk ใหม่อีกครั้ง
        </p>

        <div
          v-else-if="resolved"
          class="state"
        >
          <div class="state-icon ok">
            ✓
          </div>
          <h2 v-if="session.status === 'confirmed'">
            ยืนยันยอดเรียบร้อยแล้ว
          </h2>
          <h2 v-else>
            ได้รับเรื่องแจ้งปัญหาแล้ว
          </h2>
          <p
            v-if="session.status === 'issue_reported' && session.issue_note"
            class="muted"
          >
            หมายเหตุ: {{ session.issue_note }}
          </p>
          <p class="muted">
            ขอบคุณที่ช่วยตรวจสอบยอดกับสหกรณ์
          </p>
        </div>

        <template v-else>
          <div class="card">
            <div class="card-title">
              หุ้นส่วน (share capital)
            </div>
            <div class="big-amount">
              <span>{{ money(session.snapshot.share_balance) }}</span> บาท
            </div>
          </div>

          <div class="card">
            <div class="card-title">
              เงินกู้คงค้าง
            </div>
            <table
              v-if="session.snapshot.active_loans.length"
              class="loans"
            >
              <thead>
                <tr>
                  <th>เลขสัญญา</th><th>ประเภท</th><th class="num">
                    เงินต้นคงเหลือ
                  </th><th class="num">
                    ดอกเบี้ยคงค้าง
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="loan in session.snapshot.active_loans"
                  :key="loan.contract_number"
                >
                  <td>{{ loan.contract_number }}</td>
                  <td>{{ loan.loan_type_name || '-' }}</td>
                  <td class="num">
                    {{ money(loan.outstanding_principal) }}
                  </td>
                  <td class="num">
                    {{ money(loan.accrued_interest) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              v-else
              class="muted"
            >
              ไม่มีเงินกู้คงค้าง
            </p>
          </div>

          <div class="card">
            <div class="card-title">
              เงินฝาก
            </div>
            <template v-if="session.snapshot.savings">
              <div class="big-amount">
                <span>{{ money(session.snapshot.savings.balance) }}</span> บาท
              </div>
              <p class="muted">
                {{ session.snapshot.savings.deposit_type_name || 'บัญชีเงินฝาก' }}
              </p>
            </template>
            <p
              v-else
              class="muted"
            >
              ไม่มีบัญชีเงินฝากที่ใช้งาน
            </p>
          </div>

          <p class="asof">
            ข้อมูล ณ วันที่ {{ new Date(session.snapshot.taken_at).toLocaleString('th-TH') }} (ยอด ณ ขณะส่ง)
          </p>

          <p
            v-if="actionError"
            class="banner warn"
          >
            {{ actionError }}
          </p>

          <button
            class="btn primary"
            :disabled="submitting"
            @click="confirm"
          >
            ยืนยันว่ายอดถูกต้อง
          </button>
          <button
            v-if="!showIssueForm"
            class="btn ghost"
            @click="showIssueForm = true"
          >
            ยอดไม่ถูกต้อง / แจ้งปัญหา
          </button>
          <div
            v-else
            class="card issue-form"
          >
            <label
              class="card-title"
              for="issue-note"
            >รายละเอียดปัญหา</label>
            <textarea
              id="issue-note"
              v-model="issueNote"
              rows="3"
              placeholder="เช่น มูลหนี้ไม่ถูกต้อง ยอดที่ถูกคือ …"
            />
            <button
              class="btn warn-btn"
              :disabled="submitting"
              @click="reportIssue"
            >
              ส่งเรื่องแจ้งปัญหา
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-root{font-family:'Anuphan',sans-serif;color:#0A2540;background:#E8DFD0;min-height:100dvh;
  display:flex;justify-content:center;padding:24px 12px}
.confirm-root *{margin:0;padding:0;box-sizing:border-box}
.phone-card{width:100%;max-width:480px;background:#FAF7F2;border-radius:28px;overflow:hidden;
  box-shadow:0 40px 90px -42px rgba(10,37,64,.45);height:fit-content}
.head{background:linear-gradient(160deg,#0F3B66,#0A2540);color:#fff;padding:26px 22px 30px}
.head-brand{display:flex;align-items:center;gap:14px}
.logo{flex:none;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.12);
  color:#D8B877;display:grid;place-items:center;font-weight:700;font-size:13px;letter-spacing:.05em}
.head-title{font-weight:700;font-size:20px}
.head-sub{font-size:12px;opacity:.75;margin-top:3px}
.content{padding:18px 18px 26px;display:flex;flex-direction:column;gap:14px}
.who{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #E7E0D2;border-radius:18px;padding:14px 16px}
.avatar{flex:none;width:46px;height:46px;border-radius:50%;background:linear-gradient(160deg,#0F3B66,#0A2540);
  color:#fff;display:grid;place-items:center;font-weight:700;font-size:18px}
.who-name{font-weight:700;font-size:17px}
.who-meta{font-size:13px;color:#7E93AB;margin-top:2px;font-variant-numeric:tabular-nums}
.card{background:#fff;border:1px solid #E7E0D2;border-radius:18px;padding:16px}
.card-title{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A6B33;margin-bottom:8px}
.big-amount{font-size:14px;color:#3E5876}
.big-amount span{font-size:30px;font-weight:700;color:#0A2540;font-variant-numeric:tabular-nums;margin-right:4px}
.loans{width:100%;border-collapse:collapse;font-size:13px}
.loans th{text-align:left;color:#7E93AB;font-weight:600;padding:6px 4px;border-bottom:1px solid #E7E0D2}
.loans td{padding:8px 4px;border-bottom:1px solid #F2EDE3}
.loans .num{text-align:right;font-variant-numeric:tabular-nums}
.muted{color:#7E93AB;font-size:14px;line-height:1.7}
.asof{font-size:11px;color:#7E93AB}
.banner{border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.7}
.banner.warn{background:#FBEDE8;color:#B42318;border:1px solid #F0D2C8}
.state{text-align:center;padding:36px 18px;display:flex;flex-direction:column;align-items:center;gap:10px}
.state-icon{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:700}
.state-icon.ok{background:#E4F0EC;color:#0E6B5C}
.state-icon.bad{background:#FBEDE8;color:#B42318}
.state h2{font-size:22px;font-weight:700}
.btn{border:0;cursor:pointer;font-family:'Anuphan',sans-serif;font-weight:700;border-radius:14px;
  padding:15px 18px;font-size:16px;transition:transform .15s ease}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.55;cursor:default}
.btn.primary{background:linear-gradient(180deg,#0E6B5C,#0A5748);color:#fff}
.btn.ghost{background:#fff;color:#8A6B33;border:1px solid #E7D9BC}
.btn.warn-btn{background:linear-gradient(180deg,#C29A55,#B08D4F);color:#fff;width:100%;margin-top:10px}
.issue-form textarea{width:100%;border:1px solid #E7E0D2;border-radius:12px;padding:10px 12px;
  font-family:'Anuphan',sans-serif;font-size:14px;resize:vertical;margin-bottom:2px}
</style>
