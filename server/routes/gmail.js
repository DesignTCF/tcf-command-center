const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return auth;
}

function decodeBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = decodeBody(part);
      if (text) return text;
    }
  }
  return '';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function isActionable(subject, snippet) {
  const keywords = ['follow up', 'deadline', 'urgent', 'asap', 'approval', 'approve', 'review', 'pending', 'action', 'please', 'can you', 'by when', 'due', 'confirm', 'invoice', 'payment', 'quote', 'proposal', 'decision'];
  const text = (subject + ' ' + snippet).toLowerCase();
  return keywords.some(k => text.includes(k));
}

// GET /api/gmail/threads
router.get('/threads', async (req, res) => {
  try {
    const auth = getAuth();
    const gmail = google.gmail({ version: 'v1', auth });
    const limit = parseInt(req.query.limit) || 30;

    const list = await gmail.users.threads.list({
      userId: 'me',
      maxResults: limit,
      q: 'in:inbox -category:promotions -category:social',
    });

    if (!list.data.threads?.length) return res.json([]);

    const threads = await Promise.all(
      (list.data.threads || []).slice(0, limit).map(async (t) => {
        try {
          const thread = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
          const msgs = thread.data.messages || [];
          const last = msgs[msgs.length - 1];
          const headers = last?.payload?.headers || [];
          const date = new Date(parseInt(last?.internalDate));
          const ageMs = Date.now() - date.getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          const isUnread = last?.labelIds?.includes('UNREAD');
          const subject = getHeader(headers, 'subject') || '(no subject)';
          const from = getHeader(headers, 'from');
          const snippet = thread.data.snippet || '';
          return {
            id: t.id,
            subject,
            from,
            date: date.toISOString(),
            ageDays: Math.floor(ageDays),
            isUnread,
            messageCount: msgs.length,
            snippet,
            actionable: isActionable(subject, snippet),
            stale: isUnread && ageDays > 3,
          };
        } catch {
          return null;
        }
      })
    );

    res.json(threads.filter(Boolean));
  } catch (err) {
    console.error('Gmail threads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/thread/:id — full thread
router.get('/thread/:id', async (req, res) => {
  try {
    const auth = getAuth();
    const gmail = google.gmail({ version: 'v1', auth });
    const thread = await gmail.users.threads.get({ userId: 'me', id: req.params.id });
    const messages = (thread.data.messages || []).map(msg => {
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id,
        from: getHeader(headers, 'from'),
        to: getHeader(headers, 'to'),
        subject: getHeader(headers, 'subject'),
        date: new Date(parseInt(msg.internalDate)).toISOString(),
        body: stripHtml(decodeBody(msg.payload)),
        isUnread: msg.labelIds?.includes('UNREAD'),
      };
    });
    res.json({ id: req.params.id, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/actionable
router.get('/actionable', async (req, res) => {
  try {
    const auth = getAuth();
    const gmail = google.gmail({ version: 'v1', auth });

    const list = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 50,
      q: 'in:inbox is:unread -category:promotions',
    });

    if (!list.data.threads?.length) return res.json([]);

    const threads = await Promise.all(
      (list.data.threads || []).map(async (t) => {
        try {
          const thread = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
          const msgs = thread.data.messages || [];
          const last = msgs[msgs.length - 1];
          const headers = last?.payload?.headers || [];
          const date = new Date(parseInt(last?.internalDate));
          const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
          const subject = getHeader(headers, 'subject') || '(no subject)';
          const from = getHeader(headers, 'from');
          const snippet = thread.data.snippet || '';
          if (!isActionable(subject, snippet) && ageDays < 3) return null;
          return { id: t.id, subject, from, date: date.toISOString(), ageDays: Math.floor(ageDays), snippet, stale: ageDays > 3 };
        } catch { return null; }
      })
    );

    res.json(threads.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
