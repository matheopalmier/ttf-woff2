// Importation de wawoff2 pour la conversion
import * as wawoff2 from 'wawoff2';

class FontConverter {
    constructor() {
        this.dropArea = document.getElementById('dropArea');
        this.fileInput = document.getElementById('fileInput');
        this.statusList = document.getElementById('statusList');
        this.conversionStatus = document.getElementById('conversionStatus');
        
        // Configuration - INCREASED TIMEOUTS
        this.maxFileSize = 50 * 1024 * 1024; // 50 MB maximum size
        this.conversionTimeout = 300000; // 5 minutes (300s) - significantly increased
        this.conversionTimeoutExtended = 600000; // 10 minutes (600s) for alternative attempt
        
        // Flag pour savoir si le navigateur supporte l'API FontFace
        this.supportsFontFaceAPI = typeof FontFace !== 'undefined';
        
        // Initialiser directement les écouteurs d'événements
        this.initEventListeners();
        
        // Ajouter des styles globaux pour améliorer l'espacement
        this.addGlobalStyles();
    }
    
    addGlobalStyles() {
        // Créer une feuille de style pour les espacements
        if (!document.querySelector('#converter-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'converter-spacing-styles';
            style.textContent = `
                .status-item {
                    margin-bottom: 20px !important;
                    padding: 15px !important;
                    border-radius: 8px !important;
                    background-color: rgba(250, 250, 250, 0.5) !important;
                    border: 1px solid var(--border-color) !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                .status-item-left {
                    margin-bottom: 15px !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .status-icon {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .processing-container {
                    margin-top: 15px !important;
                    width: 100% !important;
                    padding-left: 28px !important; /* Aligner avec le texte du nom de fichier */
                }
                .processing-label {
                    margin-bottom: 10px !important;
                    display: block !important;
                }
                .button-container {
                    margin-top: 15px !important;
                    padding-left: 28px !important;
                }
                .download-btn {
                    padding: 8px 16px !important;
                }
                .conversion-note {
                    margin-top: 15px !important;
                    padding: 12px !important;
                    margin-left: 28px !important;
                }
                .error-message {
                    margin-top: 10px !important;
                    display: block !important;
                    padding-left: 28px !important;
                }
                .alternatives {
                    padding-left: 28px !important;
                }
                #statusList {
                    margin-top: 25px !important;
                }
                .filename {
                    font-weight: 500 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    initEventListeners() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, this.highlight.bind(this), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, this.unhighlight.bind(this), false);
        });
        
        // Handle dropped files
        this.dropArea.addEventListener('drop', this.handleDrop.bind(this), false);
        
        // Handle manual file selection
        this.fileInput.addEventListener('change', this.handleFiles.bind(this), false);
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    highlight() {
        this.dropArea.classList.add('active');
    }
    
    unhighlight() {
        this.dropArea.classList.remove('active');
    }
    
    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files);
    }
    
    handleFiles(e) {
        let files;
        if (e instanceof FileList) {
            files = e;
        } else {
            files = e.target.files;
        }
        
        this.conversionStatus.classList.add('active');
        
        Array.from(files).forEach(file => {
            // Vérification de la taille du fichier
            if (file.size > this.maxFileSize) {
                this.addStatusItem(file.name, 'error', `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is ${this.maxFileSize / (1024 * 1024)} MB.`);
                return;
            }
            
            // Check if the file is a TTF
            if (file.name.toLowerCase().endsWith('.ttf')) {
                this.convertFont(file);
            } else {
                this.addStatusItem(file.name, 'error', 'Not a TTF file');
            }
        });
        
        // Réinitialiser l'input file pour éviter les problèmes de rechargement du même fichier
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }
    
    async convertFont(file) {
        // Vérifier si un élément de statut existe déjà pour ce fichier
        const existingItem = Array.from(this.statusList.children).find(
            item => item.querySelector('.filename')?.textContent === file.name
        );
        
        // Si un élément existe déjà, on le supprime pour éviter les doublons
        if (existingItem) {
            this.statusList.removeChild(existingItem);
        }
        
        const statusItem = this.addStatusItem(file.name, 'processing');
        
        // Créer une animation de chargement plus élaborée
        const processingContainer = document.createElement('div');
        processingContainer.className = 'processing-container';
        processingContainer.style.display = 'flex';
        processingContainer.style.flexDirection = 'column';
        processingContainer.style.alignItems = 'flex-start';
        processingContainer.style.width = '100%';
        
        // Label de traitement
        const processingLabel = document.createElement('span');
        processingLabel.className = 'processing-label';
        processingLabel.textContent = 'Processing... (this may take some time for large files)';
        processingLabel.style.color = 'var(--primary-color)';
        processingLabel.style.fontSize = '0.9rem';
        processingLabel.style.marginBottom = '0.5rem';
        
        // Barre de progression
        const progressContainer = document.createElement('div');
        progressContainer.style.width = '100%';
        progressContainer.style.height = '6px';
        progressContainer.style.backgroundColor = 'var(--border-color)';
        progressContainer.style.borderRadius = '3px';
        progressContainer.style.overflow = 'hidden';
        
        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = 'var(--primary-color)';
        progressBar.style.transition = 'width 0.3s linear';
        progressBar.style.position = 'relative';
        
        // Animation de progression
        this.animateProgressBar(progressBar);
        
        progressContainer.appendChild(progressBar);
        processingContainer.appendChild(processingLabel);
        processingContainer.appendChild(progressContainer);
        statusItem.appendChild(processingContainer);
        
        try {
            // Read the file as an ArrayBuffer
            const ttfBuffer = await this.readFileAsArrayBuffer(file);
            
            try {
                console.log('Starting conversion for:', file.name);
                console.log('TTF buffer length:', ttfBuffer.byteLength);
                
                // Mettre à jour le message de traitement avec plus d'informations
                const fileSizeMB = (ttfBuffer.byteLength / (1024 * 1024)).toFixed(2);
                processingLabel.textContent = `Converting TTF (${fileSizeMB} MB)... This may take several minutes for large files.`;
                
                // Forcer un repaint pour afficher le message
                setTimeout(() => {
                    this.tryConvertFont(file, ttfBuffer, statusItem, processingLabel, progressBar)
                        .catch(error => {
                            console.error('All conversion methods failed:', error);
                            let errorMessage = 'Failed to convert font after multiple attempts. ';
                            
                            // Ajout de conseils plus pratiques pour les gros fichiers
                            if (ttfBuffer.byteLength > 5 * 1024 * 1024) {
                                errorMessage += `Your font file is ${fileSizeMB} MB which is quite large. `;
                                errorMessage += 'For large files, try: ';
                                errorMessage += '1) Using a desktop app like FontForge, 2) Using a smaller subset of the font, ';
                                errorMessage += 'or 3) Try with a different web browser (Chrome tends to work best).';
                            } else {
                                errorMessage += 'This might be due to browser limitations or font complexity. Try using a desktop application for conversion.';
                            }
                            
                            this.updateStatusItem(statusItem, 'error', errorMessage);
                        });
                }, 50);
                
            } catch (conversionError) {
                console.error('Font conversion setup error:', conversionError);
                this.updateStatusItem(statusItem, 'error', 'Failed to set up conversion. The TTF might be corrupted or unsupported.');
            }
        } catch (error) {
            console.error('File reading error:', error);
            this.updateStatusItem(statusItem, 'error', error.message);
        }
    }
    
    animateProgressBar(progressBar) {
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 95) {
                // Ne pas atteindre 100% automatiquement, seulement lors de la réussite
                clearInterval(interval);
                return;
            }
            
            // Progression plus lente au fil du temps pour indiquer une attente plus longue
            const increment = Math.max(0.2, (95 - width) / 100);
            width += increment;
            progressBar.style.width = `${width}%`;
        }, 200);
        
        // Stocker l'intervalle dans l'élément pour pouvoir l'arrêter plus tard
        progressBar.dataset.interval = interval;
        
        // Animation d'un gradient qui se déplace
        progressBar.style.backgroundImage = 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)';
        progressBar.style.backgroundSize = '40px 40px';
        progressBar.style.animation = 'progress-bar-stripes 2s linear infinite';
        
        // Ajouter la définition de l'animation dans la feuille de style si elle n'existe pas
        if (!document.querySelector('#progress-bar-animation')) {
            const style = document.createElement('style');
            style.id = 'progress-bar-animation';
            style.textContent = `
                @keyframes progress-bar-stripes {
                    from { background-position: 40px 0; }
                    to { background-position: 0 0; }
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return interval;
    }
    
    completeProgressBar(progressBar, success = true) {
        // Arrêter l'animation
        if (progressBar.dataset.interval) {
            clearInterval(parseInt(progressBar.dataset.interval));
        }
        
        // Animer jusqu'à 100%
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = success ? 'var(--success-color)' : 'var(--error-color)';
        progressBar.style.animation = 'none';
        progressBar.style.backgroundImage = 'none';
    }
    
    async tryConvertFont(file, ttfBuffer, statusItem, processingLabel, progressBar) {
        // Optimisation: Vérifier si le fichier est très volumineux
        const fileSizeMB = ttfBuffer.byteLength / (1024 * 1024);
        const isLargeFile = fileSizeMB > 2; // Considère les fichiers > 2MB comme "grands"
        
        // Ajuster le message en fonction de la taille
        if (isLargeFile) {
            processingLabel.textContent = `Method 1/2: Using WOFF2 converter... (${fileSizeMB.toFixed(2)} MB) - Large file, this may take several minutes`;
        } else {
            processingLabel.textContent = `Method 1/2: Using WOFF2 converter... (${fileSizeMB.toFixed(2)} MB)`;
        }
        
        // Méthode 1: Utiliser wawoff2.compress avec un timeout adapté à la taille du fichier
        try {
            // Ajuster dynamiquement le timeout basé sur la taille du fichier
            const dynamicTimeout = Math.min(
                this.conversionTimeoutExtended,  // Plafond: 10 minutes max
                Math.max(
                    this.conversionTimeout,      // Plancher: au moins 5 minutes
                    fileSizeMB * 60000           // ~1 minute par MB
                )
            );
            
            console.log(`Using timeout of ${dynamicTimeout/1000} seconds for ${fileSizeMB.toFixed(2)} MB file`);
            
            // Tentative de conversion avec timeout adapté
            const woff2Buffer = await this.convertWithTimeout(ttfBuffer, dynamicTimeout);
            
            if (!woff2Buffer || woff2Buffer.buffer.byteLength < 100) { // Vérifier que le résultat semble valide
                throw new Error('Conversion returned empty or too small result');
            }
            
            console.log('Method 1 successful, WOFF2 buffer length:', woff2Buffer.buffer.byteLength);
            this.completeProgressBar(progressBar, true);
            
            // Create a download link - WOFF2
            const outputFileName = file.name.replace('.ttf', '.woff2');
            this.updateStatusItem(statusItem, 'success', outputFileName, woff2Buffer.buffer, 'woff2');
            return true;
        } catch (error) {
            console.warn('Method 1 failed:', error);
            
            // Si le fichier est vraiment gros, suggérer directement des alternatives
            if (fileSizeMB > 10) { // Plus de 10 MB
                processingLabel.textContent = 'Conversion failed. Font file is too large for browser-based conversion.';
                progressBar.style.width = '100%';
                progressBar.style.backgroundColor = 'var(--error-color)';
                
                const errorMessage = `This font (${fileSizeMB.toFixed(2)} MB) is too large for browser-based conversion. ` +
                    'Please use a desktop application like FontForge, ttf2woff2 command line tool, or an online service with server-side conversion.';
                
                this.updateStatusItem(statusItem, 'error', errorMessage);
                
                // Ajouter un lien vers les solutions alternatives
                const alternativesContainer = document.createElement('div');
                alternativesContainer.className = 'alternatives';
                alternativesContainer.innerHTML = `
                    <p>Recommended alternatives:</p>
                    <ul>
                        <li><a href="https://fontforge.org/en-US/" target="_blank">FontForge</a> - Open-source font editor</li>
                        <li><a href="https://github.com/google/woff2" target="_blank">woff2</a> - Google's command-line converter</li>
                        <li><a href="https://transfonter.org/" target="_blank">Transfonter</a> - Online service with more capacity</li>
                    </ul>
                `;
                statusItem.appendChild(alternativesContainer);
                
                throw new Error('File too large for browser-based conversion');
            }
            
            // Sinon, essayer la méthode 2
            processingLabel.textContent = 'Method 1 failed. Trying alternative method...';
            progressBar.style.width = '50%';
            
            // Méthode 2: Utiliser FontFace API pour les navigateurs qui le supportent
            if (this.supportsFontFaceAPI) {
                try {
                    processingLabel.textContent = 'Method 2/2: Using browser Font API... This may take a moment.';
                    
                    // Créer une URL pour le fichier TTF
                    const ttfBlob = new Blob([ttfBuffer], { type: 'font/ttf' });
                    const ttfUrl = URL.createObjectURL(ttfBlob);
                    
                    // Essayer de charger la police avec l'API FontFace
                    const fontFace = new FontFace('temp-font', `url(${ttfUrl})`);
                    await fontFace.load();
                    
                    // Si ça fonctionne, on peut proposer de télécharger le TTF original
                    console.log('Method 2: Font loaded via FontFace API');
                    this.completeProgressBar(progressBar, true);
                    
                    // Créer un message amélioré pour l'utilisateur
                    const outputFileName = file.name;
                    statusItem.classList.add('success-with-note');
                    
                    // On simule un succès mais avec un message spécial
                    this.updateStatusItem(statusItem, 'partial-success', outputFileName, ttfBuffer, 'ttf');
                    
                    // Nettoyer l'URL
                    URL.revokeObjectURL(ttfUrl);
                    return true;
                } catch (fontFaceError) {
                    console.warn('Method 2 failed:', fontFaceError);
                    throw new Error('All conversion methods failed');
                }
            } else {
                throw new Error('FontFace API not supported in this browser');
            }
        }
    }
    
    // Ajouter un timeout à la conversion pour éviter un blocage infini
    convertWithTimeout(ttfBuffer, timeoutMs = 300000) { // 5 minutes par défaut
        return new Promise((resolve, reject) => {
            console.log(`Starting conversion with timeout of ${timeoutMs/1000} seconds`);
            
            // Mise à jour de l'interface pendant la conversion
            const updateIntervalId = setInterval(() => {
                console.log('Conversion still in progress...');
            }, 10000); // Log toutes les 10 secondes
            
            // Set a timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                clearInterval(updateIntervalId);
                reject(new Error(`Conversion timed out after ${timeoutMs/1000} seconds. The font file may be too large or complex for browser conversion.`));
            }, timeoutMs);
            
            // Try to convert
            try {
                console.log('Starting wawoff2.compress...');
                const startTime = performance.now();
                
                wawoff2.compress(new Uint8Array(ttfBuffer))
                    .then(result => {
                        clearTimeout(timeoutId);
                        clearInterval(updateIntervalId);
                        const endTime = performance.now();
                        console.log(`Conversion completed in ${((endTime - startTime)/1000).toFixed(2)} seconds`);
                        resolve(result);
                    })
                    .catch(err => {
                        clearTimeout(timeoutId);
                        clearInterval(updateIntervalId);
                        console.error('wawoff2.compress error:', err);
                        reject(err);
                    });
            } catch (err) {
                clearTimeout(timeoutId);
                clearInterval(updateIntervalId);
                console.error('Error initiating wawoff2.compress:', err);
                reject(err);
            }
        });
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    addStatusItem(fileName, status, message = '') {
        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';
        statusItem.dataset.filename = fileName; // Ajouter un attribut pour faciliter l'identification
        
        const leftSide = document.createElement('div');
        leftSide.className = 'status-item-left';
        
        const statusIcon = document.createElement('div');
        statusIcon.className = `status-icon ${status}`;
        
        if (status === 'processing') {
            statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
            // Ajouter une animation de rotation
            statusIcon.style.animation = 'spin 1s linear infinite';
        } else if (status === 'success' || status === 'partial-success') {
            statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else if (status === 'error') {
            statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        }
        
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'filename';
        filenameSpan.textContent = fileName;
        
        leftSide.appendChild(statusIcon);
        leftSide.appendChild(filenameSpan);
        
        statusItem.appendChild(leftSide);
        
        if (status === 'error') {
            const errorMessage = document.createElement('span');
            errorMessage.className = 'error-message';
            errorMessage.textContent = message;
            statusItem.appendChild(errorMessage);
        }
        
        this.statusList.appendChild(statusItem);
        
        return statusItem;
    }
    
    updateStatusItem(statusItem, newStatus, outputFileName = '', fileBuffer = null, fileType = 'woff2') {
        // Vérification si statusItem existe toujours dans le DOM
        if (!statusItem || !this.statusList.contains(statusItem)) {
            console.warn('Status item no longer exists in the DOM');
            return;
        }
        
        const statusIcon = statusItem.querySelector('.status-icon');
        if (statusIcon) {
            statusIcon.className = `status-icon ${newStatus}`;
            // Arrêter l'animation de rotation si présente
            statusIcon.style.animation = 'none';
        }
        
        // Clear any existing elements except status-item-left
        // Utilisation d'une approche plus sûre : supprimer tous les enfants directs sauf le premier (leftSide)
        while (statusItem.childNodes.length > 1) {
            statusItem.removeChild(statusItem.lastChild);
        }
        
        // Update icon
        if (newStatus === 'success' || newStatus === 'partial-success') {
            if (statusIcon) {
                statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            }
            
            // Create download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download
            `;
            
            // Afficher la taille du fichier converti
            const sizeInfo = document.createElement('span');
            sizeInfo.className = 'file-size-info';
            sizeInfo.style.fontSize = '0.9rem';
            sizeInfo.style.color = 'var(--light-text)';
            sizeInfo.style.marginRight = '15px';
            
            const originalSize = outputFileName.length > 0 ? fileBuffer.byteLength : 0;
            const formattedSize = originalSize < 1024 * 1024 
                ? `${(originalSize / 1024).toFixed(1)} KB` 
                : `${(originalSize / (1024 * 1024)).toFixed(2)} MB`;
            
            const fileExtension = fileType.toUpperCase();
            sizeInfo.textContent = `${fileExtension}: ${formattedSize}`;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.alignItems = 'center';
            buttonContainer.appendChild(sizeInfo);
            buttonContainer.appendChild(downloadBtn);
            
            // Set up download functionality
            downloadBtn.addEventListener('click', () => {
                const blob = new Blob([fileBuffer], { 
                    type: fileType === 'woff2' ? 'font/woff2' : 'font/ttf'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outputFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
            
            statusItem.appendChild(buttonContainer);
            
            // Si c'est un succès partiel (TTF seulement), ajouter une note explicative
            if (newStatus === 'partial-success') {
                const noteElement = document.createElement('div');
                noteElement.className = 'conversion-note';
                noteElement.style.fontSize = '0.85rem';
                noteElement.style.color = 'var(--light-text)';
                noteElement.style.marginTop = '12px';
                noteElement.style.padding = '10px';
                noteElement.style.backgroundColor = 'rgba(255, 248, 230, 0.5)';
                noteElement.style.borderLeft = '3px solid #f5a623';
                noteElement.innerHTML = `
                    <b>Note:</b> WOFF2 conversion timed out. 
                    The original TTF file appears valid but may be too complex for browser-based conversion.
                    <br><br>
                    <b>What to do?</b>
                    <ul style="margin-top: 5px; padding-left: 20px;">
                        <li>Download the original TTF file above</li>
                        <li>Use a desktop application like <a href="https://fontforge.github.io/" target="_blank" style="color:var(--primary-color);">FontForge</a> or <a href="https://github.com/google/woff2" target="_blank" style="color:var(--primary-color);">Google's woff2 utility</a></li>
                        <li>Or try an online converter:
                            <a href="https://cloudconvert.com/ttf-to-woff2" target="_blank" style="color:var(--primary-color);">CloudConvert</a> or
                            <a href="https://www.fontsquirrel.com/tools/webfont-generator" target="_blank" style="color:var(--primary-color);">Font Squirrel</a>
                        </li>
                    </ul>
                `;
                
                buttonContainer.insertAdjacentElement('afterend', noteElement);
            }
        } else if (newStatus === 'error') {
            if (statusIcon) {
                statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            }
            
            const errorMessage = document.createElement('span');
            errorMessage.className = 'error-message';
            errorMessage.textContent = outputFileName; // In this case, outputFileName is the error message
            
            // Ajouter des liens vers des convertisseurs en ligne alternatives
            const alternativesElement = document.createElement('div');
            alternativesElement.className = 'alternatives';
            alternativesElement.style.marginTop = '15px';
            alternativesElement.style.fontSize = '0.9rem';
            alternativesElement.innerHTML = `
                <p style="margin-bottom: 8px; font-weight: bold;">Try these alternatives:</p>
                <ul style="margin-top: 5px; padding-left: 20px; line-height: 1.6;">
                    <li><a href="https://cloudconvert.com/ttf-to-woff2" target="_blank" style="color: var(--primary-color);">CloudConvert</a></li>
                    <li><a href="https://convertio.co/ttf-woff2/" target="_blank" style="color: var(--primary-color);">Convertio</a></li>
                    <li><a href="https://www.fontsquirrel.com/tools/webfont-generator" target="_blank" style="color: var(--primary-color);">Font Squirrel Webfont Generator</a></li>
                </ul>
            `;
            
            const errorContainer = document.createElement('div');
            errorContainer.appendChild(errorMessage);
            errorContainer.appendChild(alternativesElement);
            
            statusItem.appendChild(errorContainer);
        }
    }
}

// Initialise l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new FontConverter();
}); 