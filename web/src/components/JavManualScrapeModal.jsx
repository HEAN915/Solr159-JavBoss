import { useEffect, useRef, useState } from 'react'
import AppModal from '@/components/AppModal'
import { zh } from '@/utils/i18n'
import { getErrorMessage } from '@/utils/errors'

const CODE_PATTERN = /^[A-Z0-9_-]+$/
const JAVBUS_ORIGIN = 'https://www.javbus.com'
const JAVLIBRARY_ORIGIN = 'https://www.javlibrary.com'
const JAVDB_ORIGIN = 'https://javdb.com'
const AVSOX_ORIGIN = 'https://avsox.click'
const BROWSER_SCRAPE_PROVIDERS = {
  javbus: { name: 'JavBus' },
  javlibrary: { name: 'JavLibrary' },
  javdb: { name: 'JavDB' },
  avsox: { name: 'AVSOX' },
}
const JAVBOSS_EXTENSION_ID = 'iikdjhkpjihfkehccfmkpkdmenmbaacn'
const JAVBOSS_EXTENSION_ORIGIN = `chrome-extension://${JAVBOSS_EXTENSION_ID}`
const JAVBOSS_EXTENSION_BRIDGE_URL = `${JAVBOSS_EXTENSION_ORIGIN}/bridge.html`
const SCRAPE_MESSAGE_CONNECT = 'JAVBOSS_EXTENSION_CONNECT'
const SCRAPE_MESSAGE_READY = 'JAVBOSS_EXTENSION_READY'
const SCRAPE_MESSAGE_METADATA = 'JAVBOSS_SCRAPE_METADATA'
const SCRAPE_MESSAGE_OPEN = 'JAVBOSS_SCRAPE_OPEN'
const SCRAPE_MESSAGE_OPEN_STATUS = 'JAVBOSS_SCRAPE_OPEN_STATUS'

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

function browserScrapeURL(provider, code) {
  const normalizedCode = String(code || '')
    .trim()
    .toUpperCase()
  const validCode = normalizedCode && CODE_PATTERN.test(normalizedCode)
  if (provider === 'javlibrary') {
    if (!validCode) return `${JAVLIBRARY_ORIGIN}/tw/`
    const url = new URL('/tw/vl_searchbyid.php', JAVLIBRARY_ORIGIN)
    url.searchParams.set('keyword', normalizedCode)
    return url.href
  }
  if (provider === 'javdb') {
    if (!validCode) return `${JAVDB_ORIGIN}/`
    const url = new URL('/search', JAVDB_ORIGIN)
    url.searchParams.set('q', normalizedCode)
    url.searchParams.set('f', 'all')
    return url.href
  }
  if (provider === 'avsox') {
    return validCode
      ? `${AVSOX_ORIGIN}/tw/search/${encodeURIComponent(normalizedCode)}`
      : `${AVSOX_ORIGIN}/tw`
  }
  return validCode ? `${JAVBUS_ORIGIN}/${encodeURIComponent(normalizedCode)}` : JAVBUS_ORIGIN
}

function newBrowserScrapeSessionId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return `javboss-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function limitedText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function limitedTextList(value, maxItems = 200) {
  if (!Array.isArray(value)) return []
  return value.slice(0, maxItems).map((item) => limitedText(item?.name || item, 200))
}

function safeExternalURL(value) {
  const candidate = limitedText(value, 2048)
  if (!candidate) return ''
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch {
    return ''
  }
}

function infoFromBrowserExtension(data, fallbackCode = '') {
  if (!data || typeof data !== 'object') return null
  const returnedCode = limitedText(data.code || fallbackCode, 64).toUpperCase()
  if (!returnedCode || !CODE_PATTERN.test(returnedCode)) return null
  const rawDuration = Number.parseInt(data.duration_min, 10)
  const releaseDate = limitedText(data.release_date, 10)
  return infoFromProvider(
    {
      code: returnedCode,
      title: limitedText(data.title, 5000),
      studio: limitedText(data.studio, 500),
      series: limitedText(data.series, 500),
      release_date: /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : '',
      duration_min:
        Number.isFinite(rawDuration) && rawDuration >= 0 && rawDuration <= 10000
          ? rawDuration
          : null,
      tags: limitedTextList(data.tags),
      actors: limitedTextList(data.actors, 100),
      cover_url: safeExternalURL(data.cover_url),
      is_uncensored: typeof data.is_uncensored === 'boolean' ? data.is_uncensored : undefined,
    },
    fallbackCode
  )
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
  const browserScrapeBridgeRef = useRef(null)
  const browserScrapeProviderRef = useRef('')
  const [browserScrapeSessionId, setBrowserScrapeSessionId] = useState('')
  const [browserScrapeExtensionReady, setBrowserScrapeExtensionReady] = useState(false)
  const [browserScrapeOpening, setBrowserScrapeOpening] = useState(false)
  const [browserScrapeStatus, setBrowserScrapeStatus] = useState('')
  const [browserScrapeSourceURL, setBrowserScrapeSourceURL] = useState('')

  useEffect(() => {
    if (!open) return
    setManualInfo(initialManualInfo(item))
    setLookupLoading(false)
    setLookupProvider('')
    setLookupError('')
    setBrowserScrapeSessionId(newBrowserScrapeSessionId())
    setBrowserScrapeExtensionReady(false)
    setBrowserScrapeOpening(false)
    setBrowserScrapeStatus('')
    setBrowserScrapeSourceURL('')
    browserScrapeProviderRef.current = ''
  }, [open, item])

  useEffect(() => {
    if (!open) return undefined

    const receiveBrowserScrapeMessage = (event) => {
      if (
        event.origin !== JAVBOSS_EXTENSION_ORIGIN ||
        event.source !== browserScrapeBridgeRef.current?.contentWindow
      ) {
        return
      }
      const message = event.data
      if (!message || message.version !== 1 || message.sessionId !== browserScrapeSessionId) return

      if (message.type === SCRAPE_MESSAGE_READY) {
        setBrowserScrapeExtensionReady(true)
        setBrowserScrapeStatus(zh('JavBoss 助手已连接', 'JavBoss Assistant connected'))
        return
      }
      if (message.type === SCRAPE_MESSAGE_OPEN_STATUS) {
        setBrowserScrapeOpening(false)
        setBrowserScrapeStatus(
          message.ok
            ? zh(
                `已打开 ${browserScrapeProviderRef.current || '元数据网站'} 新标签页。`,
                `Opened a new ${browserScrapeProviderRef.current || 'metadata site'} tab.`
              )
            : zh(
                `打开新标签页失败：${limitedText(message.error, 300)}`,
                `Failed to open a new tab: ${limitedText(message.error, 300)}`
              )
        )
        return
      }
      if (message.type !== SCRAPE_MESSAGE_METADATA) return

      const fallbackCode = String(item?.code || '')
        .trim()
        .toUpperCase()
      const nextInfo = infoFromBrowserExtension(message.payload, fallbackCode)
      if (!nextInfo) {
        setBrowserScrapeStatus(
          zh('扩展返回的数据无效，请确认当前是作品详情页。', 'The extension returned invalid data.')
        )
        return
      }
      // A custom work's code is its stable identity. Never replace it with a
      // potentially similar code parsed from a third-party page.
      setManualInfo((current) => ({ ...current, ...nextInfo, code: fallbackCode }))
      setBrowserScrapeSourceURL(safeExternalURL(message.payload?.source_url))
      const sourceName = limitedText(message.payload?.source_name, 50) || '元数据网站'
      setBrowserScrapeStatus(
        zh(
          `已从 ${sourceName} 回填 ${fallbackCode}，请检查后保存。`,
          `Filled ${fallbackCode} from ${sourceName}. Review it before saving.`
        )
      )
    }

    window.addEventListener('message', receiveBrowserScrapeMessage)
    return () => window.removeEventListener('message', receiveBrowserScrapeMessage)
  }, [browserScrapeSessionId, item?.code, open])

  useEffect(() => {
    if (!open || !browserScrapeSessionId) return undefined
    const connect = () => {
      browserScrapeBridgeRef.current?.contentWindow?.postMessage(
        { type: SCRAPE_MESSAGE_CONNECT, sessionId: browserScrapeSessionId },
        JAVBOSS_EXTENSION_ORIGIN
      )
    }
    const timers = [0, 300, 1000].map((delay) => window.setTimeout(connect, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [browserScrapeSessionId, open])

  useEffect(() => {
    if (!open || !browserScrapeSessionId || browserScrapeExtensionReady) return undefined
    const timer = window.setTimeout(() => {
      setBrowserScrapeStatus(
        zh(
          '尚未检测到扩展。请重新加载 browser-extension 目录并刷新 JavBoss。',
          'Extension not detected. Reload the browser-extension directory, then reload JavBoss.'
        )
      )
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [browserScrapeExtensionReady, browserScrapeSessionId, open])

  useEffect(() => {
    if (!browserScrapeOpening) return undefined
    const timer = window.setTimeout(() => {
      setBrowserScrapeOpening(false)
      setBrowserScrapeStatus(
        zh(
          '打开元数据网站超时，请重新加载扩展后重试。',
          'Opening the metadata site timed out. Reload the extension and try again.'
        )
      )
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [browserScrapeOpening])

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

  const openBrowserScrapeProvider = (provider) => {
    if (browserScrapeOpening) return
    const providerConfig = BROWSER_SCRAPE_PROVIDERS[provider]
    if (!providerConfig) return
    if (!browserScrapeSessionId || !browserScrapeExtensionReady) {
      setBrowserScrapeStatus(
        zh(
          '未连接到扩展，请确认已重新加载扩展并刷新 JavBoss。',
          'Extension is not connected. Reload the extension and the JavBoss page.'
        )
      )
      return
    }
    setBrowserScrapeSourceURL('')
    setBrowserScrapeOpening(true)
    browserScrapeProviderRef.current = providerConfig.name
    setBrowserScrapeStatus(
      zh(`正在打开 ${providerConfig.name} 新标签页…`, `Opening a new ${providerConfig.name} tab...`)
    )
    browserScrapeBridgeRef.current?.contentWindow?.postMessage(
      {
        type: SCRAPE_MESSAGE_OPEN,
        sessionId: browserScrapeSessionId,
        url: browserScrapeURL(provider, normalizedCode),
      },
      JAVBOSS_EXTENSION_ORIGIN
    )
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
            <div className="mt-3 rounded border border-dashed border-blue-200 bg-blue-50/60 p-3">
              <div className="text-xs font-medium text-gray-700">
                {zh('浏览器助手回填', 'Browser assistant fill')}
              </div>
              <div className="mt-1 text-[11px] leading-4 text-gray-500">
                {zh(
                  '直接刮削失败时，点击下方网站并在作品详情页点“回填到 JavBoss”；资料只会填入当前窗口，确认后再保存。',
                  'When direct lookup fails, open a site below and click “Fill JavBoss” on its work page. Data is only filled into this window until you save it.'
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(BROWSER_SCRAPE_PROVIDERS).map(([provider, providerConfig]) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => openBrowserScrapeProvider(provider)}
                    disabled={saving || lookupLoading || browserScrapeOpening}
                    className="rounded border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {browserScrapeOpening &&
                    browserScrapeProviderRef.current === providerConfig.name
                      ? zh('正在打开…', 'Opening...')
                      : zh(`打开 ${providerConfig.name}`, `Open ${providerConfig.name}`)}
                  </button>
                ))}
              </div>
              {browserScrapeStatus ? (
                <div
                  className={`mt-2 text-xs leading-5 ${
                    browserScrapeExtensionReady ? 'text-blue-700' : 'text-amber-700'
                  }`}
                >
                  {browserScrapeStatus}
                </div>
              ) : null}
              {browserScrapeSourceURL ? (
                <div className="mt-1 truncate text-xs text-gray-400" title={browserScrapeSourceURL}>
                  {browserScrapeSourceURL}
                </div>
              ) : null}
            </div>
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
      <iframe
        ref={browserScrapeBridgeRef}
        src={JAVBOSS_EXTENSION_BRIDGE_URL}
        title={zh('JavBoss 扩展通信桥', 'JavBoss extension bridge')}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onLoad={() => {
          if (!browserScrapeSessionId) return
          browserScrapeBridgeRef.current?.contentWindow?.postMessage(
            { type: SCRAPE_MESSAGE_CONNECT, sessionId: browserScrapeSessionId },
            JAVBOSS_EXTENSION_ORIGIN
          )
        }}
      />
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
