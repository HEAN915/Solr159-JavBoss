export const WEB_HOTKEY_ACTIONS = [
  { action: 'content_page_up', defaultKey: 'w' },
  { action: 'content_page_down', defaultKey: 's' },
  { action: 'continuous_scroll_up', defaultKey: 'Shift+w' },
  { action: 'continuous_scroll_down', defaultKey: 'Shift+s' },
  { action: 'edit_jav_query', defaultKey: 'Space' },
  { action: 'open_page_jump', defaultKey: 'f' },
  { action: 'previous_page', defaultKey: 'a' },
  { action: 'next_page', defaultKey: 'd' },
  { action: 'browser_back', defaultKey: '1' },
  { action: 'browser_forward', defaultKey: '2' },
]

const RESERVED_KEYS = new Set(['alt', 'control', 'meta', 'shift', 'escape', 'tab'])

export function normalizeWebHotkeyKey(value) {
  let rawKey = String(value ?? '')
  const shifted = rawKey.toLowerCase().startsWith('shift+')
  if (shifted) rawKey = rawKey.slice('shift+'.length)
  let normalizedKey = ''
  if (rawKey === ' ' || rawKey === 'Spacebar') {
    normalizedKey = 'Space'
  } else {
    const key = rawKey.trim()
    if (!key) return ''
    normalizedKey = key.length === 1 ? key.toLowerCase() : key
  }
  return shifted ? `Shift+${normalizedKey}` : normalizedKey
}

export function webHotkeyKeyId(value) {
  return normalizeWebHotkeyKey(value).toLocaleLowerCase()
}

export function isAllowedWebHotkeyKey(value) {
  const key = normalizeWebHotkeyKey(value)
  if (!key || key.length > 32) return false
  const baseKey = key.startsWith('Shift+') ? key.slice('Shift+'.length) : key
  if (baseKey.includes('+') && baseKey !== '+') return false
  return Boolean(baseKey) && !RESERVED_KEYS.has(baseKey.toLowerCase())
}

export function defaultWebHotkeys() {
  return WEB_HOTKEY_ACTIONS.map(({ action, defaultKey }) => ({ action, key: defaultKey }))
}

export function parseWebHotkeys(value) {
  const defaults = defaultWebHotkeys()
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = null
    }
  }

  if (!Array.isArray(parsed) || ![6, 8, 9, WEB_HOTKEY_ACTIONS.length].includes(parsed.length)) {
    return defaults
  }

  const configured = new Map()
  const usedKeys = new Set()
  for (const item of parsed) {
    const action = String(item?.action || '')
    const key = normalizeWebHotkeyKey(item?.key)
    const keyId = webHotkeyKeyId(key)
    if (
      !WEB_HOTKEY_ACTIONS.some((entry) => entry.action === action) ||
      configured.has(action) ||
      !isAllowedWebHotkeyKey(key) ||
      usedKeys.has(keyId)
    ) {
      return defaults
    }
    configured.set(action, key)
    usedKeys.add(keyId)
  }

  const items = WEB_HOTKEY_ACTIONS.map(({ action, defaultKey }) => ({
    action,
    key: configured.get(action) || defaultKey,
  }))
  if (
    items.some((item) => !configured.has(item.action) && usedKeys.has(webHotkeyKeyId(item.key)))
  ) {
    return defaults
  }
  return items
}

export function webHotkeysEqual(left, right) {
  const leftItems = parseWebHotkeys(left)
  const rightItems = parseWebHotkeys(right)
  return leftItems.every(
    (item, index) =>
      item.action === rightItems[index]?.action && item.key === rightItems[index]?.key
  )
}

export function formatWebHotkeyKey(value) {
  const key = normalizeWebHotkeyKey(value)
  if (key.startsWith('Shift+')) {
    const baseKey = key.slice('Shift+'.length)
    return `Shift+${baseKey.length === 1 ? baseKey.toUpperCase() : baseKey}`
  }
  return key.length === 1 ? key.toUpperCase() : key
}

export function webHotkeyFromKeyboardEvent(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return ''
  const key = normalizeWebHotkeyKey(event.key)
  if (!key || key === 'Shift') return key
  return normalizeWebHotkeyKey(event.shiftKey ? `Shift+${key}` : key)
}

export function isWebHotkeyEditingTarget(target) {
  if (!(target instanceof Element)) return false
  if (target.closest('textarea, select, [contenteditable]:not([contenteditable="false"])')) {
    return true
  }

  const input = target.closest('input')
  if (!input) return false
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    String(input.type || 'text').toLowerCase()
  )
}
