/**
 * This script downloads the appropriate WOFF2 compression tool binaries
 * based on the operating system. It creates the necessary directories
 * and places the binaries in the right location.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

const BINARIES_DIR = path.join(__dirname, '..', 'bin');

// Create bin directory if it doesn't exist
if (!fs.existsSync(BINARIES_DIR)) {
  fs.mkdirSync(BINARIES_DIR, { recursive: true });
}

async function downloadFile(url, outputPath) {
  console.log(`Downloading from ${url}...`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download from ${url}:`, error.message);
    throw error;
  }
}

async function downloadPrebuiltWoff2() {
  const platform = process.platform;
  let binaryUrl;
  let outputFileName;
  
  // Determine which binary to download based on platform
  if (platform === 'win32') {
    binaryUrl = 'https://github.com/google/woff2/releases/download/1.0.2/woff2_compress.exe';
    outputFileName = 'woff2_compress.exe';
  } else if (platform === 'darwin') {
    binaryUrl = 'https://github.com/bramstein/homebrew-webfonttools/raw/master/formula/woff2/bin/mac/woff2_compress';
    outputFileName = 'woff2_compress';
  } else if (platform === 'linux') {
    binaryUrl = 'https://github.com/bramstein/homebrew-webfonttools/raw/master/formula/woff2/bin/linux/woff2_compress';
    outputFileName = 'woff2_compress';
  } else {
    console.warn(`Prebuilt binary not available for platform: ${platform}. Will use fallback Node.js implementation.`);
    return;
  }
  
  const outputPath = path.join(BINARIES_DIR, outputFileName);
  
  try {
    await downloadFile(binaryUrl, outputPath);
    console.log(`Successfully downloaded ${outputFileName} to ${outputPath}`);
    
    // Make the binary executable on non-Windows platforms
    if (platform !== 'win32') {
      fs.chmodSync(outputPath, '755');
      console.log(`Made ${outputFileName} executable`);
    }
  } catch (error) {
    console.warn(`Could not download prebuilt binary. Will use Node.js fallback implementation.`);
    console.warn(`Detailed error: ${error.message}`);
  }
}

async function buildWoff2FromSource() {
  console.log('Attempting to build WOFF2 from source...');
  
  try {
    // Clone the WOFF2 repository
    execSync('git clone --depth 1 https://github.com/google/woff2.git woff2-temp');
    
    // Navigate to the repository directory
    process.chdir('woff2-temp');
    
    // Build the project
    execSync('make clean all');
    
    // Copy the binary
    fs.copyFileSync('woff2_compress', path.join(BINARIES_DIR, 'woff2_compress'));
    
    // Clean up
    process.chdir('..');
    execSync('rm -rf woff2-temp');
    
    console.log('Successfully built WOFF2 from source');
  } catch (error) {
    console.warn('Failed to build WOFF2 from source:', error.message);
    console.warn('Will use Node.js fallback implementation');
  }
}

async function main() {
  console.log('Setting up WOFF2 conversion tools...');
  
  try {
    // First try to download prebuilt binaries
    await downloadPrebuiltWoff2();
    
    // Check if binary was successfully downloaded
    const binaryName = process.platform === 'win32' ? 'woff2_compress.exe' : 'woff2_compress';
    const binaryPath = path.join(BINARIES_DIR, binaryName);
    
    if (!fs.existsSync(binaryPath)) {
      console.log('Prebuilt binary not available or download failed.');
      
      // On Linux or macOS, we can try to build from source
      if (process.platform !== 'win32') {
        await buildWoff2FromSource();
      }
    }
    
    console.log('WOFF2 setup complete. Using Node.js fallback if native binary is not available.');
  } catch (error) {
    console.error('Setup failed:', error.message);
    console.log('Will use Node.js implementation as fallback.');
  }
}

main().catch(error => {
  console.error('Fatal error during setup:', error);
  process.exit(1);
}); 