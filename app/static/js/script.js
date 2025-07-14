const canvas = document.getElementById('neuralCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
const particleColor = 'rgba(172, 139, 255, 0.7)'; // Light purple with transparency
const lineColor = 'rgba(172, 139, 255, 0.3)'; // Light purple with more transparency

// Particle Class
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1.5;
        this.speedY = Math.random() * 2 - 1.5;
    }
    draw() {
        ctx.fillStyle = particleColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width || this.x < 0) {
            this.speedX = -this.speedX;
        }
        if (this.y > canvas.height || this.y < 0) {
            this.speedY = -this.speedY;
        }

        this.draw();
    }
}

// Create particle array
function init() {
    particlesArray = [];
    const currentNumberOfParticles = (canvas.width * canvas.height) / 4000;
    for (let i = 0; i < currentNumberOfParticles; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particlesArray.push(new Particle(x, y));
    }
}

// Connect particles
function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
            const maxDistanceSquared = 20000; 

            if (distance < maxDistanceSquared) {
                opacityValue = 1 - (distance / maxDistanceSquared); 
                ctx.strokeStyle = `rgba(172, 139, 255, ${opacityValue})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

// Resize listener
window.addEventListener('resize', function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init(); // Re-initialize particles on resize
});

// Set initial display state for elements
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('headerContainer').style.display = 'flex';
    document.getElementById('mainContentContainer').style.display = 'block';

    // Initialize GGUF Vector Analyzer
    initializeGGUFAnalyzer();

    // Avatar Dropdown Logic
    const avatarButton = document.getElementById('avatarButton');
    const avatarDropdown = document.getElementById('avatarDropdown');

    if (avatarButton && avatarDropdown) {
        avatarButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            avatarDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (avatarDropdown.classList.contains('active') && !avatarDropdown.contains(event.target) && event.target !== avatarButton) {
                avatarDropdown.classList.remove('active');
            }
        });
    }

    // Navigation Menu Dropdown Logic
    const navMenuButton = document.getElementById('navMenuButton');
    const navMenuDropdown = document.getElementById('navMenuDropdown');

    if (navMenuButton && navMenuDropdown) {
        navMenuButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            navMenuDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (navMenuDropdown.classList.contains('active') && !navMenuDropdown.contains(event.target) && event.target !== navMenuButton) {
                navMenuDropdown.classList.remove('active');
            }
        });
    }
});

// GGUF Vector Analyzer functionality
function initializeGGUFAnalyzer() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    let uploadedFiles = [];

    // Upload area click
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // Analyze button
    analyzeBtn.addEventListener('click', () => {
        performAnalysis();
    });

    async function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => 
            file.name.toLowerCase().endsWith('.gguf')
        );

        if (validFiles.length === 0) {
            alert('Please select valid GGUF files');
            return;
        }

        showLoading();

        for (const file of validFiles) {
            await uploadFile(file);
        }

        hideLoading();
        showAnalysisSection();
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            uploadedFiles.push({
                id: result.file_id,
                name: file.name,
                size: formatFileSize(file.size),
                status: 'success',
                vectors: result.vector_count,
                dimensions: result.dimensions
            });

            updateFileList();
            updateStats();

        } catch (error) {
            console.error('Upload error:', error);
            uploadedFiles.push({
                name: file.name,
                size: formatFileSize(file.size),
                status: 'error',
                error: error.message
            });
            updateFileList();
        }
    }

    async function performAnalysis() {
        if (uploadedFiles.length === 0) {
            alert('Please upload GGUF files first');
            return;
        }

        const analysisType = document.getElementById('analysis-type').value;
        const resultsContainer = document.getElementById('results-container');

        analyzeBtn.disabled = true;
        resultsContainer.innerHTML = '<div class="loading-spinner"></div><p>Analyzing vectors...</p>';

        try {
            const fileIds = uploadedFiles
                .filter(file => file.status === 'success')
                .map(file => file.id);

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_ids: fileIds,
                    analysis_type: analysisType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            displayResults(results, analysisType);

        } catch (error) {
            console.error('Analysis error:', error);
            resultsContainer.innerHTML = `
                <div class="result-item">
                    <div class="result-title">Error</div>
                    <div class="result-value">${error.message}</div>
                </div>
            `;
        } finally {
            analyzeBtn.disabled = false;
        }
    }

    function displayResults(results, analysisType) {
        const resultsContainer = document.getElementById('results-container');
        let html = '';

        switch (analysisType) {
            case 'similarity':
                html = renderSimilarityResults(results);
                break;
            case 'clustering':
                html = renderClusteringResults(results);
                break;
            case 'dimensionality':
                html = renderDimensionalityResults(results);
                break;
            case 'statistics':
                html = renderStatisticsResults(results);
                break;
        }

        resultsContainer.innerHTML = html;
    }

    function renderSimilarityResults(results) {
        if (!results.similarities || results.similarities.length === 0) {
            return '<p>No similarity results found.</p>';
        }

        let html = '<h4>Top Similar Vector Pairs</h4>';
        results.similarities.forEach(sim => {
            html += `
                <div class="result-item">
                    <div class="result-title">Vectors ${sim.vector1_id} ↔ ${sim.vector2_id}</div>
                    <div class="result-value">Similarity: ${sim.similarity.toFixed(4)}</div>
                </div>
            `;
        });

        return html;
    }

    function renderClusteringResults(results) {
        if (!results.clusters) {
            return '<p>No clustering results found.</p>';
        }

        let html = '<h4>Cluster Analysis</h4>';
        html += `
            <div class="result-item">
                <div class="result-title">Number of Clusters</div>
                <div class="result-value">${results.num_clusters}</div>
            </div>
        `;

        results.clusters.forEach((cluster, index) => {
            html += `
                <div class="result-item">
                    <div class="result-title">Cluster ${index + 1}</div>
                    <div class="result-value">${cluster.size} vectors</div>
                </div>
            `;
        });

        return html;
    }

    function renderDimensionalityResults(results) {
        if (!results.reduced_dimensions) {
            return '<p>No dimensionality reduction results found.</p>';
        }

        let html = '<h4>Dimensionality Reduction</h4>';
        html += `
            <div class="result-item">
                <div class="result-title">Original Dimensions</div>
                <div class="result-value">${results.original_dimensions}</div>
            </div>
            <div class="result-item">
                <div class="result-title">Reduced Dimensions</div>
                <div class="result-value">${results.reduced_dimensions}</div>
            </div>
            <div class="result-item">
                <div class="result-title">Explained Variance</div>
                <div class="result-value">${(results.explained_variance * 100).toFixed(2)}%</div>
            </div>
        `;

        return html;
    }

    function renderStatisticsResults(results) {
        if (!results.statistics) {
            return '<p>No statistics results found.</p>';
        }

        const stats = results.statistics;
        let html = '<h4>Vector Statistics</h4>';
        
        html += `
            <div class="result-item">
                <div class="result-title">Mean Magnitude</div>
                <div class="result-value">${stats.mean_magnitude.toFixed(4)}</div>
            </div>
            <div class="result-item">
                <div class="result-title">Standard Deviation</div>
                <div class="result-value">${stats.std_deviation.toFixed(4)}</div>
            </div>
            <div class="result-item">
                <div class="result-title">Min Value</div>
                <div class="result-value">${stats.min_value.toFixed(4)}</div>
            </div>
            <div class="result-item">
                <div class="result-title">Max Value</div>
                <div class="result-value">${stats.max_value.toFixed(4)}</div>
            </div>
        `;

        return html;
    }

    function updateFileList() {
        const fileList = document.getElementById('file-list');
        let html = '<h3>Uploaded Files</h3>';

        if (uploadedFiles.length === 0) {
            html += '<p>No files uploaded yet</p>';
        } else {
            uploadedFiles.forEach(file => {
                const statusClass = `status-${file.status}`;
                html += `
                    <div class="file-item">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${file.size}</div>
                        <div class="file-status ${statusClass}">
                            ${file.status === 'success' ? 'Ready' : 
                              file.status === 'processing' ? 'Processing...' : 
                              'Error'}
                        </div>
                        ${file.vectors ? `<div style="font-size: 0.8rem; color: #a0a0c0; margin-top: 5px; font-family: 'Courier New', Courier, monospace;">
                            ${file.vectors.toLocaleString()} vectors, ${file.dimensions}D
                        </div>` : ''}
                    </div>
                `;
            });
        }

        fileList.innerHTML = html;
    }

    function updateStats() {
        const successfulFiles = uploadedFiles.filter(f => f.status === 'success');
        const totalVectors = successfulFiles.reduce((sum, file) => sum + (file.vectors || 0), 0);
        const dimensions = successfulFiles.length > 0 ? successfulFiles[0].dimensions : 0;

        document.getElementById('files-processed').textContent = successfulFiles.length;
        document.getElementById('total-vectors').textContent = totalVectors.toLocaleString();
        document.getElementById('dimensions').textContent = dimensions;
    }

    function showAnalysisSection() {
        document.getElementById('analysis-section').style.display = 'block';
    }

    function showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initial setup for particle animation
init();
animate();
