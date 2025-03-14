const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cors = require('cors');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Ensure unique filename by adding timestamp
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

// File filter to only accept TTF files
const fileFilter = (req, file, cb) => {
  if (file.originalname.toLowerCase().endsWith('.ttf')) {
    cb(null, true);
  } else {
    cb(new Error('Only TTF files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Create the uploads and converted directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const convertedDir = path.join(__dirname, 'converted');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(convertedDir)) {
  fs.mkdirSync(convertedDir, { recursive: true });
}

// Route for TTF to WOFF2 conversion
app.post('/convert', upload.single('ttfFile'), async (req, res) => {
  try {
    const ttfFilePath = req.file.path;
    const originalFilename = req.file.originalname;
    const woff2Filename = originalFilename.replace('.ttf', '.woff2');
    const woff2FilePath = path.join(convertedDir, woff2Filename);
    
    console.log(`Converting ${ttfFilePath} to ${woff2FilePath}`);
    
    try {
      // Check if woff2_compress binary is available (from Google's WOFF2 library)
      const woff2CompressPath = path.join(__dirname, 'bin', process.platform === 'win32' ? 'woff2_compress.exe' : 'woff2_compress');
      
      if (fs.existsSync(woff2CompressPath)) {
        // Using the native Google WOFF2 binary for best performance
        execSync(`${woff2CompressPath} "${ttfFilePath}" -o "${woff2FilePath}"`);
      } else {
        // Fallback to ttf2woff2 NPM package
        const ttf2woff2 = require('ttf2woff2');
        const ttfBuffer = fs.readFileSync(ttfFilePath);
        const woff2Buffer = ttf2woff2(ttfBuffer);
        fs.writeFileSync(woff2FilePath, woff2Buffer);
      }
      
      // Stream the converted file to the client
      res.download(woff2FilePath, woff2Filename, (err) => {
        if (err) {
          console.error('Error streaming file:', err);
        }
        
        // Clean up files after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(ttfFilePath);
            fs.unlinkSync(woff2FilePath);
          } catch (error) {
            console.error('Error cleaning up files:', error);
          }
        }, 5000); // Wait 5 seconds before cleanup
      });
    } catch (error) {
      console.error('Conversion error:', error);
      res.status(500).json({ 
        error: 'Conversion failed', 
        details: error.message,
        command: `woff2_compress ${ttfFilePath}`
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error processing the request', 
      details: error.message 
    });
  }
});

// Status route to check if server is running
app.get('/status', (req, res) => {
  res.json({ status: 'Online', message: 'TTF to WOFF2 Conversion Server is running' });
});

// Start the server
app.listen(port, () => {
  console.log(`TTF to WOFF2 conversion server running on port ${port}`);
}); 