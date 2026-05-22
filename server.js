import express from 'express';
import session from 'express-session';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const imagesDir = './public/images';
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session must come before static so every request (including API calls
// that follow a static-served page) has req.session populated correctly.
app.use(session({
  secret: 'santuario-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static('.'));

// Admin credentials — variables de entorno (Render) o config.json (servidor propio)
let ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
try {
  const cfg = JSON.parse(readFileSync('./config.json', 'utf-8'));
  if (cfg.ADMIN_USER) ADMIN_USER = cfg.ADMIN_USER;
  if (cfg.ADMIN_PASS) ADMIN_PASS = cfg.ADMIN_PASS;
} catch (e) { /* config.json no encontrado, se usan variables de entorno o defaults */ }

// File paths
const contentFile = './content.json';

// Helper: Read content
function readContent() {
  try {
    return JSON.parse(readFileSync(contentFile, 'utf-8'));
  } catch (e) {
    return {};
  }
}

// Helper: Write content
function writeContent(data) {
  writeFileSync(contentFile, JSON.stringify(data, null, 2));
}

// Routes

// Check current session
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user, isAdmin: true });
  } else {
    res.status(401).json({ isAdmin: false });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = { username: ADMIN_USER };
    res.json({ success: true, user: ADMIN_USER });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
});

// Get all content
app.get('/api/content', (req, res) => {
  const content = readContent();
  res.json(content);
});

// Update content (admin only)
app.post('/api/content/update', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { key, field, value } = req.body;

  try {
    const content = readContent();

    // Create section if it doesn't exist
    if (!content[key]) {
      content[key] = {};
    }

    // Update field
    content[key][field] = value;

    // Sanitize HTML (basic: remove script tags)
    if (typeof content[key][field] === 'string') {
      content[key][field] = content[key][field]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }

    writeContent(content);
    res.json({ success: true, data: content[key] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save image slot data (admin only)
app.post('/api/image-slots/save', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { slots } = req.body;
    writeFileSync('.image-slots.state.json', JSON.stringify(slots, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get image slot data
app.get('/api/image-slots/load', (req, res) => {
  try {
    const data = readFileSync('.image-slots.state.json', 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json({});
  }
});

// Upload image
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate MIME type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only images allowed' });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = `img-${timestamp}.webp`;
    const filepath = join(imagesDir, filename);

    // Convert and compress with Sharp
    await sharp(req.file.buffer)
      .webp({ quality: 80 })
      .resize(1920, 1440, { fit: 'inside', withoutEnlargement: true })
      .toFile(filepath);

    res.json({ success: true, filename, url: `/public/images/${filename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Santuario de la Virgen de la Hoz · Puerto ${PORT} · Admin: ${ADMIN_USER}`);
});
