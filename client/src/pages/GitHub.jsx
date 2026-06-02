import { useState, useEffect, useCallback } from 'react'
import { fmtDate, timeAgo } from '../lib/utils'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
  Ruby: '#701516', Go: '#00ADD8', Rust: '#dea584',
  Vue: '#41b883', React: '#61dafb', PHP: '#4F5D95',
  Swift: '#FA7343', Kotlin: '#A97BFF', Dart: '#00B4AB',
  default: '#888',
}

const EVENT_ICONS = {
  PushEvent: '↑',
  CreateEvent: '✦',
  DeleteEvent: '✕',
  IssuesEvent: '◎',
  PullRequestEvent: '⌥',
  IssueCommentEvent: '◉',
  WatchEvent: '★',
  ForkEvent: '⑂',
  ReleaseEvent: '◈',
}

function langColor(lang) {
  return LANG_COLORS[lang] || LANG_COLORS.default
}

function formatSize(kb) {
  if (!kb) return ''
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function GitHub() {
  const [repos, setRepos] = useState([])
  const [activity, setActivity] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeRepo, setActiveRepo] = useState(null)
  const [repoDetail, setRepoDetail] = useState(null)
  const [repoLoading, setRepoLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState('All')
  const [view, setView] = useState('repos') // repos | activity

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reposData, activityData, userData] = await Promise.allSettled([
        api.get('/github/repos'),
        api.get('/github/activity'),
        api.get('/github/user'),
      ])
      if (reposData.status === 'fulfilled') setRepos(reposData.value)
      if (activityData.status === 'fulfilled') setActivity(activityData.value)
      if (userData.status === 'fulfilled') setUser(userData.value)
      if (reposData.status === 'rejected') throw new Error(reposData.reason?.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadRepoDetail(repo) {
    setActiveRepo(repo)
    setRepoDetail(null)
    setRepoLoading(true)
    try {
      const detail = await api.get(`/github/repo/${repo.fullName.replace('/', '/')}`)
      setRepoDetail(detail)
    } catch (e) {
      setRepoDetail({ error: e.message })
    } finally {
      setRepoLoading(false)
    }
  }

  // Filter + sort repos
  const langs = ['All', ...new Set(repos.map(r => r.language).filter(Boolean))]
  const filteredRepos = repos.filter(r => {
    if (langFilter !== 'All' && r.language !== langFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    }
    return true
  })

  const publicRepos = repos.filter(r => !r.isPrivate).length
  const privateRepos = repos.filter(r => r.isPrivate).length
  const totalStars = repos.reduce((s, r) => s + (r.stars || 0), 0)
  const recentPush = repos.filter(r => r.pushedAt).sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-ink-muted">
        <span className="text-teal animate-pulse">↻</span>
        <span className="text-sm">Loading GitHub…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <div className="text-2xl">⚠</div>
        <div className="text-red text-sm max-w-md text-center">{error}</div>
        <p className="text-ink-muted text-xs text-center max-w-sm">
          Check that <code className="text-teal">GITHUB_TOKEN</code> is set in your .env and the server has restarted.
        </p>
        <button className="btn-primary" onClick={load}>↻ Retry</button>
      </div>
    )
  }

  // Account connected but no repos yet
  if (!loading && repos.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Profile header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
          {user?.avatar && <img src={user.avatar} alt={user.login} className="w-9 h-9 rounded-full" />}
          <div className="flex-1">
            <div className="font-semibold text-sm text-ink flex items-center gap-2">
              {user?.name || user?.login || 'DesignTCF'}
              <a href={`https://github.com/${user?.login || 'DesignTCF'}`} target="_blank" rel="noopener"
                className="text-[10px] text-teal hover:underline">↗ View on GitHub</a>
            </div>
            <div className="text-[10.5px] text-green mt-0.5">✓ Connected — token authenticated</div>
          </div>
          <button className="btn-icon" onClick={load}>↻</button>
        </div>

        {/* Empty account state */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-40">⌥</div>
            <h2 className="text-base font-semibold text-ink mb-1">No repositories yet</h2>
            <p className="text-ink-muted text-sm max-w-sm">
              Your GitHub account <span className="text-teal">@DesignTCF</span> is connected and authenticated, but has no repositories.
            </p>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
            {[
              {
                title: 'Create a new repo',
                desc: 'Start a new project — website, design system, or code.',
                url: 'https://github.com/new',
                icon: '✦',
                color: 'text-teal border-teal/30',
              },
              {
                title: 'Import existing project',
                desc: 'Push an existing local project folder to GitHub.',
                url: 'https://github.com/new',
                icon: '↑',
                color: 'text-gold border-gold/30',
              },
              {
                title: 'Explore GitHub',
                desc: 'View your profile, settings, and organizations.',
                url: `https://github.com/${user?.login || 'DesignTCF'}`,
                icon: '↗',
                color: 'text-blue border-blue/30',
              },
            ].map((card, i) => (
              <a key={i} href={card.url} target="_blank" rel="noopener"
                className="panel px-4 py-4 hover:border-border2 transition-colors block">
                <div className={`text-xl mb-2 ${card.color.split(' ')[0]}`}>{card.icon}</div>
                <div className="text-sm font-semibold text-ink mb-1">{card.title}</div>
                <div className="text-xs text-ink-muted leading-snug">{card.desc}</div>
              </a>
            ))}
          </div>

          {/* Quick start guide */}
          <div className="panel max-w-2xl w-full px-5 py-4">
            <div className="section-title mb-3">Quick start — push your first project</div>
            <div className="space-y-2">
              {[
                { cmd: 'git init', desc: 'Initialize git in your project folder' },
                { cmd: 'git add .', desc: 'Stage all files' },
                { cmd: 'git commit -m "Initial commit"', desc: 'Create first commit' },
                { cmd: 'gh repo create DesignTCF/my-project --private --push --source=.', desc: 'Create repo & push (requires GitHub CLI)' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-teal text-[10px] w-4 text-right shrink-0">{i + 1}</span>
                  <code className="text-[11px] font-mono text-gold bg-surface2 px-2 py-1 rounded flex-1">{step.cmd}</code>
                  <span className="text-[10.5px] text-ink-muted">{step.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: repo list */}
      <div className={`flex flex-col border-r border-border bg-surface shrink-0 transition-all ${activeRepo ? 'w-[320px]' : 'flex-1'}`}>
        {/* Profile header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          {user?.avatar && (
            <img src={user.avatar} alt={user.login} className="w-9 h-9 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-ink flex items-center gap-2">
              {user?.name || user?.login || 'DesignTCF'}
              <a href={user?.url || 'https://github.com/DesignTCF'} target="_blank" rel="noopener"
                className="text-[10px] text-teal hover:underline">↗ GitHub</a>
            </div>
            {user?.bio && <div className="text-[10.5px] text-ink-muted truncate">{user.bio}</div>}
          </div>
          <button className="btn-icon text-sm" onClick={load} title="Refresh">↻</button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 border-b border-border divide-x divide-border">
          {[
            { label: 'Public', value: publicRepos, color: 'text-teal' },
            { label: 'Private', value: privateRepos, color: 'text-ink-muted' },
            { label: 'Stars', value: totalStars, color: 'text-gold' },
            { label: 'Active', value: repos.filter(r => {
              if (!r.pushedAt) return false
              const days = (Date.now() - new Date(r.pushedAt)) / 86400000
              return days < 30
            }).length, color: 'text-green' },
          ].map(k => (
            <div key={k.label} className="px-3 py-2 text-center">
              <div className={`text-lg font-light tabular-nums ${k.color}`}>{k.value}</div>
              <div className="text-[9.5px] text-ink-muted uppercase tracking-wider">{k.label}</div>
            </div>
          ))}
        </div>

        {/* View switcher + search */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <div className="flex gap-1">
            {['repos', 'activity'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`text-[10.5px] px-3 py-1 rounded transition-colors ${view === v ? 'bg-teal/10 text-teal' : 'text-ink-muted hover:text-ink'}`}>
                {v === 'repos' ? `Repos (${repos.length})` : `Activity`}
              </button>
            ))}
          </div>
          {view === 'repos' && (
            <input type="text" placeholder="Filter…" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field text-xs flex-1 py-1" />
          )}
        </div>

        {/* Language filter (repos view) */}
        {view === 'repos' && langs.length > 2 && (
          <div className="px-3 py-2 border-b border-border flex gap-1.5 overflow-x-auto">
            {langs.map(lang => (
              <button key={lang} onClick={() => setLangFilter(lang)}
                className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${langFilter === lang ? 'border-teal/40 bg-teal/10 text-teal' : 'border-border text-ink-muted hover:border-border2 hover:text-ink'}`}>
                {lang !== 'All' && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor(lang) }} />
                )}
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {view === 'repos' ? (
            filteredRepos.length === 0 ? (
              <EmptyState message="No repositories found" />
            ) : filteredRepos.map(repo => (
              <RepoRow
                key={repo.id}
                repo={repo}
                active={activeRepo?.id === repo.id}
                onClick={() => loadRepoDetail(repo)}
              />
            ))
          ) : (
            activity.length === 0 ? (
              <EmptyState message="No recent activity" />
            ) : activity.map(event => (
              <ActivityRow key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Right: repo detail */}
      {activeRepo && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Repo header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button className="btn-icon text-lg shrink-0" onClick={() => { setActiveRepo(null); setRepoDetail(null) }}>←</button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{activeRepo.name}</h2>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${activeRepo.isPrivate ? 'text-ink-muted border-border2 bg-surface3' : 'text-teal border-teal/30 bg-teal/10'}`}>
                    {activeRepo.isPrivate ? 'Private' : 'Public'}
                  </span>
                  {activeRepo.language && (
                    <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor(activeRepo.language) }} />
                      {activeRepo.language}
                    </span>
                  )}
                </div>
                {activeRepo.description && (
                  <p className="text-xs text-ink-muted mt-0.5">{activeRepo.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={activeRepo.url} target="_blank" rel="noopener" className="btn-primary text-xs">
                Open on GitHub ↗
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-5 divide-x divide-border border-b border-border shrink-0">
            {[
              { label: 'Stars', value: activeRepo.stars || 0 },
              { label: 'Forks', value: activeRepo.forks || 0 },
              { label: 'Issues', value: activeRepo.openIssues || 0 },
              { label: 'Size', value: formatSize(activeRepo.size) },
              { label: 'Branch', value: activeRepo.defaultBranch || 'main' },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 text-center">
                <div className="text-sm font-semibold text-ink">{s.value}</div>
                <div className="text-[9.5px] text-ink-muted uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Detail content */}
          <div className="flex-1 overflow-y-auto">
            {repoLoading ? (
              <div className="flex items-center justify-center py-16 text-ink-muted text-sm gap-2">
                <span className="text-teal animate-pulse">↻</span> Loading…
              </div>
            ) : repoDetail?.error ? (
              <div className="p-6 text-red text-sm">{repoDetail.error}</div>
            ) : repoDetail ? (
              <div className="p-5 grid grid-cols-2 gap-5">
                {/* Recent commits */}
                <div>
                  <div className="section-title mb-3">Recent Commits</div>
                  {repoDetail.commits?.length === 0 ? (
                    <EmptyState message="No commits found" />
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {repoDetail.commits?.map((c, i) => (
                        <a key={i} href={c.url} target="_blank" rel="noopener"
                          className="flex items-start gap-2.5 px-3 py-2.5 bg-surface2 rounded-lg hover:bg-surface3 transition-colors group">
                          <code className="text-[10px] text-gold font-mono shrink-0 mt-0.5">{c.sha}</code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-ink group-hover:text-teal transition-colors leading-snug truncate">
                              {c.message}
                            </div>
                            <div className="text-[10px] text-ink-muted mt-0.5">
                              {c.author} · {timeAgo(c.date)}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Branches */}
                <div>
                  <div className="section-title mb-3">Branches ({repoDetail.branches?.length || 0})</div>
                  {repoDetail.branches?.length === 0 ? (
                    <EmptyState message="No branches" />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {repoDetail.branches?.map((b, i) => (
                        <a key={i}
                          href={`${activeRepo.url}/tree/${b}`}
                          target="_blank" rel="noopener"
                          className="flex items-center gap-2 px-3 py-2 bg-surface2 rounded hover:bg-surface3 transition-colors">
                          <span className="text-teal text-[11px]">⎇</span>
                          <span className={`text-xs ${b === activeRepo.defaultBranch ? 'text-ink font-medium' : 'text-ink-dim'}`}>{b}</span>
                          {b === activeRepo.defaultBranch && (
                            <span className="text-[9px] text-teal ml-auto">default</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Topics */}
                  {activeRepo.topics?.length > 0 && (
                    <div className="mt-5">
                      <div className="section-title mb-2">Topics</div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeRepo.topics.map((t, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clone */}
                  <div className="mt-5">
                    <div className="section-title mb-2">Clone</div>
                    <div className="flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2 border border-border">
                      <code className="text-[10.5px] text-ink-dim flex-1 truncate font-mono">{activeRepo.cloneUrl}</code>
                      <button
                        className="btn-ghost text-[10px] px-2 py-1 shrink-0"
                        onClick={() => navigator.clipboard.writeText(activeRepo.cloneUrl)}
                      >⧉</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function RepoRow({ repo, active, onClick }) {
  const daysAgo = repo.pushedAt
    ? Math.floor((Date.now() - new Date(repo.pushedAt)) / 86400000)
    : null

  return (
    <div
      className={`px-4 py-3 cursor-pointer transition-colors ${active ? 'bg-teal/10 border-l-2 border-l-teal' : 'hover:bg-surface2'}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-sm text-ink truncate">{repo.name}</span>
        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${repo.isPrivate ? 'text-ink-muted border-border bg-surface3' : 'text-teal/80 border-teal/20 bg-teal/5'}`}>
          {repo.isPrivate ? '🔒' : '◎'}
        </span>
      </div>
      {repo.description && (
        <p className="text-[11px] text-ink-muted leading-snug mb-1.5 line-clamp-1">{repo.description}</p>
      )}
      <div className="flex items-center gap-3">
        {repo.language && (
          <span className="flex items-center gap-1 text-[10px] text-ink-muted">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor(repo.language) }} />
            {repo.language}
          </span>
        )}
        {repo.stars > 0 && <span className="text-[10px] text-ink-muted">★ {repo.stars}</span>}
        {repo.openIssues > 0 && <span className="text-[10px] text-amber">◎ {repo.openIssues}</span>}
        {daysAgo !== null && (
          <span className="text-[10px] text-ink-muted ml-auto">
            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
          </span>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ event }) {
  const icon = EVENT_ICONS[event.type] || '◆'
  const repoName = event.repo?.split('/')[1] || event.repo

  return (
    <div className="px-4 py-2.5 hover:bg-surface2 transition-colors">
      <div className="flex items-start gap-2.5">
        <span className="text-teal text-sm shrink-0 mt-0.5 w-4 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink font-medium">{event.payload?.action || event.type?.replace('Event', '')}</span>
            <a href={event.repoUrl} target="_blank" rel="noopener"
              className="text-[10.5px] text-teal hover:underline truncate">
              {repoName}
            </a>
          </div>
          {event.payload?.detail && (
            <div className="text-[11px] text-ink-muted mt-0.5 truncate">{event.payload.detail}</div>
          )}
          {event.payload?.branch && (
            <span className="text-[9.5px] text-ink-muted">on {event.payload.branch}</span>
          )}
        </div>
        <span className="text-[10px] text-ink-muted shrink-0">{timeAgo(event.createdAt)}</span>
      </div>
    </div>
  )
}
