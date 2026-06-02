const express = require('express')
const router = express.Router()

const GITHUB_USER = process.env.GITHUB_USER || 'DesignTCF'
const BASE = 'https://api.github.com'

function headers() {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'TCF-Command-Center',
  }
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

async function ghFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

// GET /api/github/repos — all repos for the user
router.get('/repos', async (req, res) => {
  try {
    const repos = await ghFetch(`/users/${GITHUB_USER}/repos?sort=updated&per_page=50&type=owner`)
    const simplified = repos.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      url: r.html_url,
      cloneUrl: r.clone_url,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      visibility: r.visibility,
      isPrivate: r.private,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
      topics: r.topics || [],
      size: r.size,
    }))
    res.json(simplified)
  } catch (err) {
    console.error('GitHub repos error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/github/activity — recent public events
router.get('/activity', async (req, res) => {
  try {
    const events = await ghFetch(`/users/${GITHUB_USER}/events?per_page=30`)
    const simplified = events.map(e => ({
      id: e.id,
      type: e.type,
      repo: e.repo?.name,
      repoUrl: `https://github.com/${e.repo?.name}`,
      createdAt: e.created_at,
      payload: summarizePayload(e),
    }))
    res.json(simplified)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/github/repo/:owner/:repo — single repo details
router.get('/repo/:owner/:repo', async (req, res) => {
  try {
    const [repo, branches, commits] = await Promise.allSettled([
      ghFetch(`/repos/${req.params.owner}/${req.params.repo}`),
      ghFetch(`/repos/${req.params.owner}/${req.params.repo}/branches?per_page=10`),
      ghFetch(`/repos/${req.params.owner}/${req.params.repo}/commits?per_page=10`),
    ])
    res.json({
      repo: repo.status === 'fulfilled' ? repo.value : null,
      branches: branches.status === 'fulfilled' ? branches.value.map(b => b.name) : [],
      commits: commits.status === 'fulfilled' ? commits.value.map(c => ({
        sha: c.sha?.slice(0, 7),
        message: c.commit?.message?.split('\n')[0],
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
        url: c.html_url,
      })) : [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/github/issues — open issues across all repos
router.get('/issues', async (req, res) => {
  try {
    const issues = await ghFetch(`/issues?filter=created&state=open&per_page=30`)
    res.json(issues.map(i => ({
      id: i.id,
      number: i.number,
      title: i.title,
      repo: i.repository?.full_name || i.url?.split('/repos/')[1]?.split('/issues')[0],
      url: i.html_url,
      state: i.state,
      labels: i.labels?.map(l => l.name) || [],
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/github/user — profile info
router.get('/user', async (req, res) => {
  try {
    const user = await ghFetch(`/users/${GITHUB_USER}`)
    res.json({
      login: user.login,
      name: user.name,
      avatar: user.avatar_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      url: user.html_url,
      company: user.company,
      location: user.location,
      createdAt: user.created_at,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function summarizePayload(event) {
  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload?.commits || []
      return {
        action: 'pushed',
        detail: commits.length > 0 ? commits[0].message?.split('\n')[0] : `${commits.length} commit(s)`,
        count: commits.length,
        branch: event.payload?.ref?.replace('refs/heads/', ''),
      }
    }
    case 'CreateEvent':
      return { action: 'created', detail: `${event.payload?.ref_type} ${event.payload?.ref || ''}`.trim() }
    case 'DeleteEvent':
      return { action: 'deleted', detail: `${event.payload?.ref_type} ${event.payload?.ref || ''}`.trim() }
    case 'IssuesEvent':
      return { action: event.payload?.action, detail: event.payload?.issue?.title }
    case 'PullRequestEvent':
      return { action: event.payload?.action, detail: event.payload?.pull_request?.title }
    case 'IssueCommentEvent':
      return { action: 'commented', detail: event.payload?.issue?.title }
    case 'WatchEvent':
      return { action: 'starred', detail: '' }
    case 'ForkEvent':
      return { action: 'forked', detail: event.payload?.forkee?.full_name }
    case 'ReleaseEvent':
      return { action: 'released', detail: event.payload?.release?.tag_name }
    default:
      return { action: event.type?.replace('Event', '').toLowerCase(), detail: '' }
  }
}

module.exports = router
