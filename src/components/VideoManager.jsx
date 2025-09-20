import React, { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'myvideo.urls.v2'
const FIRST_RUN_KEY = 'myvideo.firstRunSeeded.v2'

// -------- URL helpers --------
function isValidHttpUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function parseYouTubeId(value) {
  try {
    const u = new URL(value)
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null
    const host = u.hostname.toLowerCase()
    // reject playlist URLs
    if (u.searchParams.has('list')) return null
    // various formats
    if (host.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '')
      return id || null
    }
    if (u.pathname.startsWith('/watch')) {
      return u.searchParams.get('v')
    }
    if (u.pathname.startsWith('/shorts/')) {
      return u.pathname.split('/')[2] || null
    }
    if (u.pathname.startsWith('/embed/')) {
      return u.pathname.split('/')[2] || null
    }
    return null
  } catch {
    return null
  }
}

function normalizeUrl(value) {
  try {
    const u = new URL(value)
    // YouTube: normalize to canonical watch URL if possible
    const ytId = parseYouTubeId(value)
    if (ytId) {
      return `https://www.youtube.com/watch?v=${ytId}`
    }
    // generic: lower-case protocol/host, keep rest
    u.protocol = u.protocol.toLowerCase()
    u.hostname = u.hostname.toLowerCase()
    return u.toString()
  } catch {
    return value.trim()
  }
}

// oEmbed endpoints for common providers
function buildOEmbedUrl(url) {
  const u = new URL(url)
  if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
  }
  if (u.hostname.includes('vimeo.com')) {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
  }
  if (u.hostname.includes('dailymotion.com') || u.hostname.includes('dai.ly')) {
    return `https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(url)}`
  }
  // fallback unknown provider
  return null
}

async function expandShortUrlIfNeeded(url, { signal } = {}) {
  try {
    const host = new URL(url).hostname
    const shortHosts = ['naver.me', 'bit.ly', 'goo.gl', 't.co', 'is.gd', 'tinyurl.com']
    if (!shortHosts.some((h) => host.endsWith(h))) return url
    // Try unshorten.me (public service) to expand
    const res = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`, { signal })
    if (res.ok) {
      const data = await res.json()
      if (data?.resolved_url) return data.resolved_url
    }
  } catch {}
  return url
}

async function fetchOEmbed(url, { signal } = {}) {
  // Try to expand short URLs first
  const expanded = await expandShortUrlIfNeeded(url, { signal })
  const targetUrl = expanded || url
  // 1) Try native oEmbed for known providers
  const api = buildOEmbedUrl(targetUrl)
  if (api) {
    try {
      const res = await fetch(api, { signal })
      if (res.ok) {
        const data = await res.json()
        return {
          title: data.title || '',
          author: data.author_name || '',
          provider: data.provider_name || '',
          thumbnail: data.thumbnail_url || '',
        }
      }
    } catch {}
  }
  // 2) Fallback: noembed.com (supports many sites, may include KakaoTV depending on availability)
  try {
    const res2 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`, { signal })
    if (res2.ok) {
      const data2 = await res2.json()
      if (!data2.error) {
        return {
          title: data2.title || '',
          author: data2.author_name || '',
          provider: data2.provider_name || '',
          thumbnail: data2.thumbnail_url || '',
        }
      }
    }
  } catch {}
  // 3) Fallback: Microlink (generic metadata extractor, free tier; subject to rate limits)
  try {
    const res3 = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`, { signal })
    if (res3.ok) {
      const data3 = await res3.json()
      const d = data3?.data || {}
      const imageUrl = d.image?.url || d.logo?.url || ''
      const site = d.publisher || d.author || d.lang || ''
      if (d.title || imageUrl) {
        return {
          title: d.title || '',
          author: d.author || '',
          provider: d.publisher || site || '',
          thumbnail: imageUrl,
        }
      }
    }
  } catch {}
  // 4) Fallback: Microlink screenshot when no thumbnail available
  try {
    const res4 = await fetch(`https://api.microlink.io/?screenshot=true&meta=false&embed=screenshot.url&url=${encodeURIComponent(targetUrl)}`, { signal })
    if (res4.ok) {
      const data4 = await res4.json()
      const img = data4?.data?.screenshot?.url
      if (img) {
        return { title: '', author: '', provider: new URL(targetUrl).hostname, thumbnail: img }
      }
    }
  } catch {}
  return null
}

// -------- Component --------
export default function VideoManager() {
  const [url, setUrl] = useState('')
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('newest') // newest|oldest|az|za|pinned
  const [error, setError] = useState('')

  // helper to seed samples
  const buildSamples = () => {
    const samples = [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtu.be/9bZkp7q19f0',
          'https://www.youtube.com/shorts/aqz-KE-bpKQ',
          'https://vimeo.com/76979871',
          'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
          'https://youtu.be/tVj0ZTS4WF4',
          'https://www.youtube.com/embed/kXYiU_JCYtU',
          'https://vimeo.com/1084537',
          'https://www.youtube.com/watch?v=oHg5SJYRHA0',
          'https://www.dailymotion.com/video/x7u5g1g'
        ]
    const now = new Date().toISOString()
    return samples.map((s) => ({
      id: crypto.randomUUID(),
      url: normalizeUrl(s),
      createdAt: now,
      pinned: false,
      title: '',
      thumbnail: '',
      provider: '',
      tags: [],
      note: ''
    }))
  }

  // Load from localStorage and seed if first run (or empty array was saved previously)
  // Use functional setItems so we don't overwrite items added very early (e.g., via Web Share Target)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const seededFlag = localStorage.getItem(FIRST_RUN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems((prev) => (prev && prev.length ? prev : parsed))
        } else if (!seededFlag) {
          const seeded = buildSamples()
          setItems((prev) => (prev && prev.length ? prev : seeded))
          localStorage.setItem(FIRST_RUN_KEY, '1')
        } else {
          setItems((prev) => (prev && prev.length ? prev : []))
        }
      } else if (!seededFlag) {
        const seeded = buildSamples()
        setItems((prev) => (prev && prev.length ? prev : seeded))
        localStorage.setItem(FIRST_RUN_KEY, '1')
      }
    } catch {}
  }, [])

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  // Fetch oEmbed for items missing metadata
  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      const needs = items.filter((it) => !it.title && !it.thumbnail)
      for (const it of needs) {
        const meta = await fetchOEmbed(it.url, { signal: controller.signal })
        if (meta) {
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...meta } : p)))
        }
      }
    }
    if (items.length) run()
    return () => controller.abort()
  }, [items])

  const addUrlProgrammatically = async (rawUrl) => {
    const value = (rawUrl || '').trim()
    if (!value) return false
    if (!isValidHttpUrl(value)) {
      setError('올바른 URL을 입력하세요 (http/https)')
      return false
    }
    const normalized = normalizeUrl(value)
    if (!isValidHttpUrl(normalized)) {
      setError('지원되지 않는 URL 형식입니다')
      return false
    }
    const now = new Date().toISOString()
    const newItem = { id: crypto.randomUUID(), url: normalized, createdAt: now, pinned: false, title: '', thumbnail: '', provider: '', tags: [], note: '' }
    let added = false
    setItems((prev) => {
      if (prev.some((it) => it.url === normalized)) {
        setError('이미 등록된 URL입니다')
        return prev
      }
      added = true
      setError('')
      return [newItem, ...prev]
    })
    return added
  }

  const onAdd = async (e) => {
    e.preventDefault()
    const ok = await addUrlProgrammatically(url)
    if (ok) setUrl('')
  }

  const onDelete = (id) => setItems(items.filter((it) => it.id !== id))
  const onPinToggle = (id) => setItems(items.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it)))
  const onUpdate = (id, patch) => setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  // Import/Export
  const onExport = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'myvideo-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (Array.isArray(data)) {
          // minimal validation
          const sanitized = data.map((d) => ({
            id: d.id || crypto.randomUUID(),
            url: normalizeUrl(d.url || ''),
            createdAt: d.createdAt || new Date().toISOString(),
            pinned: !!d.pinned,
            title: d.title || '',
            thumbnail: d.thumbnail || '',
            provider: d.provider || '',
            tags: Array.isArray(d.tags) ? d.tags.slice(0, 10) : [],
            note: typeof d.note === 'string' ? d.note : ''
          }))
          setItems(sanitized)
        }
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Handle Web Share Target (GET): /?title=...&text=...&url=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const sharedUrl = params.get('url') || ''
      const text = params.get('text') || ''
      let candidate = sharedUrl
      if (!candidate && text) {
        const m = text.match(/https?:\/\/[^\s]+/)
        if (m) candidate = m[0]
      }
      if (candidate) {
        addUrlProgrammatically(candidate).then((added) => {
          if (added) {
            const urlNoQuery = window.location.origin + window.location.pathname
            window.history.replaceState({}, '', urlNoQuery)
          }
        })
      }
    } catch {}
  }, [])

  // Sorting and filtering
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    let arr = items
    if (q) {
      arr = arr.filter((it) =>
        it.url.toLowerCase().includes(q) ||
        (it.title || '').toLowerCase().includes(q) ||
        (it.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    }
    const byNewest = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
    const byOldest = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')
    const byAZ = (a, b) => (a.title || a.url).localeCompare(b.title || b.url)
    const byZA = (a, b) => (b.title || b.url).localeCompare(a.title || a.url)
    const byPinnedFirst = (a, b) => (Number(b.pinned) - Number(a.pinned)) || byNewest(a, b)
    const sorted = [...arr]
    if (sort === 'newest') sorted.sort(byNewest)
    else if (sort === 'oldest') sorted.sort(byOldest)
    else if (sort === 'az') sorted.sort(byAZ)
    else if (sort === 'za') sorted.sort(byZA)
    else if (sort === 'pinned') sorted.sort(byPinnedFirst)
    return sorted
  }, [items, filter, sort])

  return (
    <section id="manager" className="container section">
      <h2>내 비디오 URL 관리</h2>

      <form className="video-form" onSubmit={onAdd}>
        <input
          type="url"
          placeholder="예: https://www.youtube.com/watch?v=... 또는 https://vimeo.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="btn primary" type="submit">등록</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="video-toolbar">
        <input
          type="text"
          placeholder="검색(제목/URL/태그)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="az">A→Z</option>
          <option value="za">Z→A</option>
          <option value="pinned">핀 고정 우선</option>
        </select>
        <div className="toolbar-actions">
          <button className="btn" onClick={onExport} type="button">Export JSON</button>
          <label className="btn" role="button">
            Import JSON
            <input type="file" accept="application/json" onChange={onImport} hidden />
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const seeded = buildSamples()
              setItems(seeded)
              localStorage.setItem(FIRST_RUN_KEY, '1')
            }}
            title="샘플 10개 URL을 목록에 채웁니다"
          >샘플 10개 추가</button>
        </div>
        <span className="muted">총 {filtered.length}개</span>
      </div>

      <ul className="video-list">
        {filtered.map((it) => (
          <li key={it.id} className="video-item">
            <div className="left">
              <div className="thumb-wrap">
                {it.thumbnail ? (
                  <img src={it.thumbnail} alt={it.title || 'thumbnail'} />
                ) : (
                  // Fallback: show site favicon as a minimal cue
                  <img
                    src={`https://icons.duckduckgo.com/ip3/${new URL(it.url).hostname}.ico`}
                    alt="site icon"
                    onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'thumb-skeleton' })) }}
                  />
                )}
              </div>
              <div className="meta">
                <a className="title" href={it.url} target="_blank" rel="noreferrer" title={it.title || it.url}>
                  {it.title || it.url}
                </a>
                <div className="sub muted">
                  {it.provider ? `${it.provider} · ` : ''}{new URL(it.url).hostname}
                </div>
                {it.tags?.length > 0 && (
                  <div className="tags">
                    {it.tags.map((t, idx) => (
                      <span className="tag" key={idx}>#{t}</span>
                    ))}
                  </div>
                )}
                {it.note && <div className="note">{it.note}</div>}
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={async () => {
                const meta = await fetchOEmbed(it.url)
                if (meta) onUpdate(it.id, meta)
              }}>메타 새로고침</button>
              <button className="btn" onClick={() => onPinToggle(it.id)}>{it.pinned ? '핀 해제' : '핀 고정'}</button>
              <button className="btn" onClick={() => navigator.clipboard.writeText(it.url)}>복사</button>
              <button className="btn" onClick={() => onDelete(it.id)}>삭제</button>
            </div>
            <details className="editor">
              <summary>편집</summary>
              <div className="editor-grid">
                <div>
                  <label>태그(쉼표로 구분)</label>
                  <input
                    type="text"
                    placeholder="예: music, tutorial"
                    defaultValue={(it.tags || []).join(', ')}
                    onBlur={(e) => {
                      const tags = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 10)
                      onUpdate(it.id, { tags })
                    }}
                  />
                </div>
                <div>
                  <label>메모</label>
                  <textarea
                    rows={3}
                    placeholder="메모를 입력하세요"
                    defaultValue={it.note || ''}
                    onBlur={(e) => onUpdate(it.id, { note: e.target.value })}
                  />
                </div>
              </div>
            </details>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="video-empty muted">등록된 항목이 없습니다. URL을 추가해 보세요.</li>
        )}
      </ul>
    </section>
  )
}
