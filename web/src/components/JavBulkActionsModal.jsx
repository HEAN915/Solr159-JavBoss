import { useEffect, useMemo, useState } from 'react'
import AppModal from '@/components/AppModal'
import {
  addJavTagToJavs,
  addJavsToFavoriteGroups,
  createJavFavoriteGroup,
  createJavTag,
} from '@/api'
import { isUserJavTag } from '@/constants/jav'
import { getErrorMessage } from '@/utils/errors'
import { zh } from '@/utils/i18n'
import { useStore } from '@/store'

function cleanIds(items) {
  return Array.from(
    new Set(
      (items || []).map((item) => Number(item?.id)).filter((id) => Number.isFinite(id) && id > 0)
    )
  )
}

export default function JavBulkActionsModal({ open, items, onClose, onDone }) {
  const javTagOptions = useStore((state) => state.javTagOptions || [])
  const favoriteGroups = useStore((state) => state.favoriteGroupsByType?.jav || [])
  const loadJavTags = useStore((state) => state.loadJavTags)
  const loadJavFavoriteGroups = useStore((state) => state.loadJavFavoriteGroups)
  const loadJavs = useStore((state) => state.loadJavs)
  const [section, setSection] = useState('tag')
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [tagSearch, setTagSearch] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const ids = useMemo(() => cleanIds(items), [items])
  const userTags = useMemo(() => javTagOptions.filter((tag) => isUserJavTag(tag)), [javTagOptions])
  const visibleTags = useMemo(() => {
    const query = tagSearch.trim().toLocaleLowerCase()
    if (!query) return userTags
    return userTags.filter((tag) =>
      String(tag?.name || '')
        .toLocaleLowerCase()
        .includes(query)
    )
  }, [tagSearch, userTags])
  const exactTag = useMemo(() => {
    const name = tagSearch.trim()
    return name ? userTags.find((tag) => String(tag?.name || '').trim() === name) : null
  }, [tagSearch, userTags])

  useEffect(() => {
    if (!open) return
    setSection('tag')
    setSelectedTagIds([])
    setSelectedGroupIds([])
    setTagSearch('')
    setNewGroupName('')
    setSaving(false)
    setCreating(false)
    setError('')
    void loadJavTags({ force: true })
    void loadJavFavoriteGroups('jav', { force: true })
  }, [loadJavFavoriteGroups, loadJavTags, open])

  if (!open) return null

  const toggle = (setter, id, checked) => {
    const normalized = Number(id)
    if (!Number.isFinite(normalized) || normalized <= 0) return
    setter((current) => {
      const next = new Set(current)
      if (checked) next.add(normalized)
      else next.delete(normalized)
      return Array.from(next)
    })
    setError('')
  }

  const createOrSelectTag = async () => {
    const name = tagSearch.trim()
    if (!name || saving || creating) return
    if (exactTag?.id) {
      toggle(setSelectedTagIds, exactTag.id, true)
      setTagSearch('')
      return
    }
    setCreating(true)
    setError('')
    try {
      const created = await createJavTag(name)
      const id = Number(created?.id)
      if (!Number.isFinite(id) || id <= 0) {
        throw new Error(zh('创建自定义标签失败', 'Failed to create custom tag'))
      }
      toggle(setSelectedTagIds, id, true)
      setTagSearch('')
      await loadJavTags({ force: true })
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  const createAndSelectGroup = async () => {
    const name = newGroupName.trim()
    if (!name || saving || creating) return
    setCreating(true)
    setError('')
    try {
      const created = await createJavFavoriteGroup('jav', name)
      const id = Number(created?.id)
      if (!Number.isFinite(id) || id <= 0) {
        throw new Error(zh('创建作品收藏夹失败', 'Failed to create JAV favorite group'))
      }
      toggle(setSelectedGroupIds, id, true)
      setNewGroupName('')
      await loadJavFavoriteGroups('jav', { force: true })
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  const saveTags = async () => {
    if (ids.length === 0 || selectedTagIds.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      for (const tagId of selectedTagIds) {
        await addJavTagToJavs(tagId, ids)
      }
      await Promise.all([loadJavTags({ force: true }), loadJavs({ force: true })])
      onDone?.(zh(`已给 ${ids.length} 部作品添加标签`, `Added tags to ${ids.length} works`))
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const saveFavorites = async () => {
    if (ids.length === 0 || selectedGroupIds.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      await addJavsToFavoriteGroups(ids, selectedGroupIds)
      await Promise.all([loadJavFavoriteGroups('jav', { force: true }), loadJavs({ force: true })])
      onDone?.(zh(`已将 ${ids.length} 部作品加入收藏夹`, `Added ${ids.length} works to favorites`))
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || creating
  const selectedTags = new Set(selectedTagIds)
  const selectedGroups = new Set(selectedGroupIds)
  return (
    <AppModal
      ariaLabel={zh('批量编辑作品', 'Batch edit works')}
      className="px-4"
      closeDisabled={busy}
      contentClassName="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl"
      onClose={onClose}
      zIndex={1800}
    >
      <div className="border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {zh('批量编辑作品', 'Batch edit works')}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {zh(`已选 ${ids.length} 部作品`, `${ids.length} works selected`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label={zh('关闭', 'Close')}
          >
            ✕
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSection('tag')}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-sm ${
              section === 'tag'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {zh('添加标签', 'Add tags')}
          </button>
          <button
            type="button"
            onClick={() => setSection('favorite')}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-sm ${
              section === 'favorite'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {zh('加入收藏夹', 'Add to favorites')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {section === 'tag' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  void createOrSelectTag()
                }}
                placeholder={zh('搜索或创建自定义标签', 'Search or create a custom tag')}
                disabled={busy}
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {tagSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => void createOrSelectTag()}
                  disabled={busy}
                  className="shrink-0 rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  {creating
                    ? zh('处理中…', 'Working...')
                    : exactTag
                      ? zh('选择', 'Select')
                      : zh('新建', 'Create')}
                </button>
              ) : null}
            </div>
            <SelectionList
              items={visibleTags}
              selected={selectedTags}
              onToggle={(id, checked) => toggle(setSelectedTagIds, id, checked)}
              disabled={busy}
              emptyText={zh('暂无可用的自定义标签', 'No custom tags available')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  void createAndSelectGroup()
                }}
                placeholder={zh('新建作品收藏夹', 'New work favorite group')}
                disabled={busy}
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => void createAndSelectGroup()}
                disabled={busy || !newGroupName.trim()}
                className="shrink-0 rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {creating ? zh('新建中…', 'Creating...') : zh('新建', 'Create')}
              </button>
            </div>
            <SelectionList
              items={favoriteGroups}
              selected={selectedGroups}
              onToggle={(id, checked) => toggle(setSelectedGroupIds, id, checked)}
              disabled={busy}
              emptyText={zh(
                '暂无作品收藏夹，可先新建一个',
                'No work favorite groups; create one first'
              )}
            />
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {zh('取消', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={() => void (section === 'tag' ? saveTags() : saveFavorites())}
          disabled={
            busy ||
            ids.length === 0 ||
            (section === 'tag' ? selectedTagIds.length === 0 : selectedGroupIds.length === 0)
          }
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {saving ? zh('保存中…', 'Saving...') : zh('确认添加', 'Confirm add')}
        </button>
      </div>
    </AppModal>
  )
}

function SelectionList({ items, selected, onToggle, disabled, emptyText }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="max-h-72 overflow-y-auto rounded border border-gray-200 p-1">
      {list.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-gray-500">{emptyText}</p>
      ) : (
        list.map((item) => {
          const id = Number(item?.id)
          const checked = selected.has(id)
          return (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onToggle(id, event.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{item?.name}</span>
              <span className="shrink-0 text-xs text-gray-500">
                {Math.max(0, Number(item?.count) || 0)}
              </span>
            </label>
          )
        })
      )}
    </div>
  )
}
