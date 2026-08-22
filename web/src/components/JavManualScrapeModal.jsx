import { useEffect, useState } from 'react'
import AppModal from '@/components/AppModal'
import { zh } from '@/utils/i18n'
import { getErrorMessage } from '@/utils/errors'

const CODE_PATTERN = /^[A-Z0-9_-]+$/

const emptyManualInfo = {
  code: '',
  title: '',
  studio: '',
  series: '',
  release_date: '',
  duration_min: '',
  tags_text: '',
  actors_text: '',
  cover_url: '',
  is_uncensored: '',
}

function listToText(values) {
  if (!Array.isArray(values)) return ''
  return values
    .map((item) => String(item?.name || item || '').trim())
    .filter(Boolean)
    .join('\n')
}

function textToList(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatReleaseDate(value) {
  const unix = Number(value)
  if (!Number.isFinite(unix) || unix <= 0) return ''
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

function initialManualInfo(item) {
  return {
    ...emptyManualInfo,
    code: String(item?.code || '')
      .trim()
      .toUpperCase(),
    title: String(item?.title || '').trim(),
    studio: String(item?.studio?.name || '').trim(),
    series: String(item?.series?.name || '').trim(),
    release_date: formatReleaseDate(item?.release_unix),
    duration_min: item?.duration_min ? String(item.duration_min) : '',
    tags_text: listToText(item?.tags),
    actors_text: listToText(item?.idols),
    is_uncensored:
      typeof item?.is_uncensored === 'boolean' ? (item.is_uncensored ? 'true' : 'false') : '',
  }
}

function infoFromProvider(data, fallbackCode = '') {
  return {
    code: String(data?.code || fallbackCode || '')
      .trim()
      .toUpperCase(),
    title: String(data?.title || '').trim(),
    studio: String(data?.studio || '').trim(),
    series: String(data?.series || '').trim(),
    release_date: String(data?.release_date || '').trim(),
    duration_min: data?.duration_min ? String(data.duration_min) : '',
    tags_text: listToText(data?.tags),
    actors_text: listToText(data?.actors),
    cover_url: String(data?.cover_url || '').trim(),
    is_uncensored:
      typeof data?.is_uncensored === 'boolean' ? (data.is_uncensored ? 'true' : 'false') : '',
  }
}

function manualPayload(info) {
  const duration = String(info.duration_min || '').trim()
  const isUncensored = String(info.is_uncensored || '')
  const payload = {
    code: String(info.code || '')
      .trim()
      .toUpperCase(),
    title: String(info.title || '').trim(),
    studio: String(info.studio || '').trim(),
    series: String(info.series || '').trim(),
    release_date: String(info.release_date || '').trim(),
    duration_min: duration === '' ? null : Number.parseInt(duration, 10),
    tags: textToList(info.tags_text),
    actors: textToList(info.actors_text),
    cover_url: String(info.cover_url || '').trim(),
  }
  if (isUncensored === 'true') payload.is_uncensored = true
  if (isUncensored === 'false') payload.is_uncensored = false
  return payload
}

// This is the catalog-only counterpart to the Video page manual-scrape form.
// Catalog entries have no file name or scan setting, so the work code is fixed
// and the dialog starts directly at metadata filling/editing.
export default function JavManualScrapeModal({
  open,
  item,
  saving = false,
  onClose,
  onLookupMetadata,
  onSave,
}) {
  const [manualInfo, setManualInfo] = useState(emptyManualInfo)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupProvider, setLookupProvider] = useState('')
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    if (!open) return
    setManualInfo(initialManualInfo(item))
    setLookupLoading(false)
    setLookupProvider('')
    setLookupError('')
  }, [open, item])

  if (!open) return null

  const rawCode = String(manualInfo.code || '').toUpperCase()
  const normalizedCode = rawCode.trim()
  const codeInvalid =
    rawCode.length > 0 && (rawCode !== normalizedCode || !CODE_PATTERN.test(rawCode))
  const codeValid = normalizedCode.length > 0 && !codeInvalid
  const manualDuration = String(manualInfo.duration_min || '').trim()
  const manualDurationValid =
    manualDuration === '' ||
    (Number.isFinite(Number.parseInt(manualDuration, 10)) &&
      Number.parseInt(manualDuration, 10) >= 0)
  const canSave = !saving && !lookupLoading && codeValid && manualDurationValid
  const displayName = String(item?.code || '').trim()

  const updateManual = (patch) => setManualInfo((current) => ({ ...current, ...patch }))

  const lookupMetadata = async (provider) => {
    if (!codeValid || lookupLoading || saving) return
    setLookupLoading(true)
    setLookupProvider(provider)
    setLookupError('')
    try {
      const data = await onLookupMetadata?.(normalizedCode, provider)
      // Do not allow a provider response to silently switch this catalog item
      // to a different code.
      const nextInfo = infoFromProvider(data, normalizedCode)
      setManualInfo((current) => ({ ...current, ...nextInfo, code: normalizedCode }))
    } catch (error) {
      setLookupError(getErrorMessage(error))
    } finally {
      setLookupLoading(false)
      setLookupProvider('')
    }
  }

  const submit = () => {
    if (!canSave) return
    onSave?.(manualPayload({ ...manualInfo, code: normalizedCode }))
  }

  return (
    <AppModal
      ariaLabel={zh('作品手动刮削', 'Manual Work Scrape')}
      className="px-4"
      closeDisabled={saving}
      contentClassName="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
      onClose={onClose}
    >
      <div className="shrink-0 p-3 pb-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold">
            {zh('作品手动刮削', 'Manual Work Scrape')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label={zh('关闭', 'Close')}
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          {displayName
            ? zh(`作品编号：${displayName}（编号不可修改）`, `Work code: ${displayName} (fixed)`)
            : ''}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <div className="grid gap-3 pb-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {zh('番号', 'Code')}
            </label>
            <input
              type="text"
              value={manualInfo.code}
              readOnly
              className="w-full rounded border bg-gray-50 px-3 py-1.5 text-sm uppercase text-gray-600"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-gray-500">
                {zh('自动填充', 'Autofill')}
              </span>
              {[
                ['avmoo', 'AvMoo'],
                ['javbus', 'JavBus'],
                ['avsox', 'AVSOX'],
              ].map(([provider, label]) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => lookupMetadata(provider)}
                  disabled={!codeValid || saving || lookupLoading}
                  className="rounded border bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  {lookupLoading && lookupProvider === provider
                    ? zh('填充中…', 'Filling...')
                    : label}
                </button>
              ))}
            </div>
            {lookupError ? <div className="mt-1 text-xs text-red-600">{lookupError}</div> : null}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {zh('标题', 'Title')}
            </label>
            <input
              type="text"
              value={manualInfo.title}
              onChange={(event) => updateManual({ title: event.target.value })}
              disabled={saving || lookupLoading}
              className="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <ManualTextInput
            label={zh('片商', 'Studio')}
            value={manualInfo.studio}
            onChange={(value) => updateManual({ studio: value })}
            disabled={saving || lookupLoading}
            placeholder={zh('优先填写英文名称', 'English name preferred')}
          />
          <ManualTextInput
            label={zh('系列', 'Series')}
            value={manualInfo.series}
            onChange={(value) => updateManual({ series: value })}
            disabled={saving || lookupLoading}
          />
          <ManualTextInput
            label={zh('发行日期', 'Release Date')}
            type="date"
            value={manualInfo.release_date}
            onChange={(value) => updateManual({ release_date: value })}
            disabled={saving || lookupLoading}
          />
          <ManualTextInput
            label={zh('时长（分钟）', 'Duration (min)')}
            type="number"
            min="0"
            value={manualInfo.duration_min}
            onChange={(value) => updateManual({ duration_min: value })}
            disabled={saving || lookupLoading}
          />
          <ManualTextarea
            label={zh('标签', 'Tags')}
            value={manualInfo.tags_text}
            onChange={(value) => updateManual({ tags_text: value })}
            disabled={saving || lookupLoading}
          />
          <ManualTextarea
            label={zh('女优', 'Actors')}
            value={manualInfo.actors_text}
            onChange={(value) => updateManual({ actors_text: value })}
            disabled={saving || lookupLoading}
          />
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {zh('封面链接', 'Cover URL')}
            </label>
            <input
              type="url"
              value={manualInfo.cover_url}
              onChange={(event) => updateManual({ cover_url: event.target.value })}
              disabled={saving || lookupLoading}
              className="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {zh('有码状态', 'Censor State')}
            </label>
            <select
              value={manualInfo.is_uncensored}
              onChange={(event) => updateManual({ is_uncensored: event.target.value })}
              disabled={saving || lookupLoading}
              className="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">{zh('未知', 'Unknown')}</option>
              <option value="false">{zh('有码', 'Censored')}</option>
              <option value="true">{zh('无码', 'Uncensored')}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="shrink-0 p-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {zh('取消', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="ml-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving
              ? zh('保存中…', 'Saving...')
              : zh('保存并更新分类', 'Save and update categories')}
          </button>
        </div>
      </div>
    </AppModal>
  )
}

function ManualTextInput({
  label,
  type = 'text',
  value,
  onChange,
  disabled,
  placeholder = '',
  min,
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
      />
    </div>
  )
}

function ManualTextarea({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={zh('每行一个，不要有多余空格', 'One per line, no extra spaces')}
        className="w-full resize-y rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
      />
    </div>
  )
}
