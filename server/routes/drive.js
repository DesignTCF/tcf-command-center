const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
  return auth;
}

// GET /api/drive/recent
router.get('/recent', async (req, res) => {
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const limit = parseInt(req.query.limit) || 50;

    const response = await drive.files.list({
      pageSize: limit,
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents,owners)',
      q: "trashed = false",
    });

    const files = (response.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modified: f.modifiedTime,
      size: f.size ? parseInt(f.size) : null,
      url: f.webViewLink,
      icon: f.iconLink,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      type: getFileType(f.mimeType, f.name),
    }));

    res.json(files);
  } catch (err) {
    console.error('Drive recent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/drive/folders — list top-level folders for upload destination picker
router.get('/folders', async (req, res) => {
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const parent = req.query.parent || 'root';

    const response = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: 50,
    });

    res.json(response.data.files || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drive/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = req.body.folderId || null;

    const fileMetadata = {
      name: req.file.originalname,
      ...(folderId ? { parents: [folderId] } : {}),
    };

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: req.file.mimetype, body: bufferStream },
      fields: 'id,name,webViewLink,mimeType,modifiedTime',
    });

    res.json({
      id: response.data.id,
      name: response.data.name,
      url: response.data.webViewLink,
      mimeType: response.data.mimeType,
      modified: response.data.modifiedTime,
    });
  } catch (err) {
    console.error('Drive upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function getFileType(mimeType, name) {
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (mimeType?.includes('image')) return 'image';
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('spreadsheet') || name?.endsWith('.xlsx') || name?.endsWith('.csv')) return 'spreadsheet';
  if (mimeType?.includes('presentation') || name?.endsWith('.pptx')) return 'presentation';
  if (mimeType?.includes('document') || name?.endsWith('.docx')) return 'document';
  if (mimeType?.includes('video')) return 'video';
  if (mimeType?.includes('zip') || name?.endsWith('.zip')) return 'archive';
  return 'file';
}

module.exports = router;
