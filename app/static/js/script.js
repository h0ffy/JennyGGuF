class GGUFVectorAnalyzer {
    constructor() {
        this.apiBase = 'http://localhost:8000/api';
        this.uploadedFiles = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const analyzeBtn = document.getElementById('analyzeBtn');

        // Upload area click
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
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
            this.handleFiles(e.dataTransfer.files);
        });

        // Analyze button
        analyzeBtn.addEventListener('click', () => {
            this.performAnalysis();
        });
    }

    async handleFiles(files) {
        const validFiles = Array.from(files).filter(file => 
            file.name.toLowerCase().endsWith('.gguf')
        );

        if (validFiles.length === 0) {
            alert('Please select valid GGUF files');
            return;
        }

        this.showLoading();

        for (const file of validFiles) {
            await this.uploadFile(file);
        }

        this.hideLoading();
        this.showAnalysisSection();
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.apiBase}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.uploadedFiles.push({
                id: result.file_id,
                name: file.name,
                size: this.formatFileSize(file.size),
                status: 'success',
                vectors: result.vector_count,
                dimensions: result.dimensions
            });

            this.updateFileList();
            this.updateStats();

        } catch (error) {
            console.error('Upload error:', error);
            this.uploadedFiles.push({
                name: file.name,
                size: this.formatFileSize(file.size),
                status: 'error',
                error: error.message
            });
            this.updateFileList();
        }
    }

    async performAnalysis() {
        if (this.uploadedFiles.length === 0) {
            alert('Please upload GGUF files first');
            return;
        }

        const analysisType = document.getElementById('analysisType').value;
        const analyzeBtn = document.getElementById('analyzeBtn');
        const resultsContainer = document.getElementById('resultsContainer');

        analyzeBtn.disabled = true;
        resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const fileIds = this.uploadedFiles
                .filter(file => file.status === 'success')
                .map(file => file.id);

            const response = await fetch(`${this.apiBase}/analyze`, {
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
            this.displayResults(results, analysisType);

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

    displayResults(results, analysisType) {
        const resultsContainer = document.getElementById('resultsContainer');
        let html = '';

        switch (analysisType) {
            case 'similarity':
                html = this.renderSimilarityResults(results);
                break;
            case 'clustering':
                html = this.renderClusteringResults(results);
                break;
            case 'dimensionality':
                html = this.renderDimensionalityResults(results);
                break;
            case 'statistics':
                html = this.renderStatisticsResults(results);
                break;
        }

        resultsContainer.innerHTML = html;
    }

    renderSimilarityResults(results) {
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

    renderClusteringResults(results) {
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

    renderDimensionalityResults(results) {
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

    renderStatisticsResults(results) {
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

    updateFileList() {
        const fileList = document.getElementById('fileList');
        let html = '<h3>Uploaded Files</h3>';

        this.uploadedFiles.forEach(file => {
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
                    ${file.vectors ? `<div style="font-size: 0.8rem; color: #666; margin-top: 5px;">
                        ${file.vectors} vectors, ${file.dimensions}D
                    </div>` : ''}
                </div>
            `;
        });

        fileList.innerHTML = html;
    }

    updateStats() {
        const successfulFiles = this.uploadedFiles.filter(f => f.status === 'success');
        const totalVectors = successfulFiles.reduce((sum, file) => sum + (file.vectors || 0), 0);
        const dimensions = successfulFiles.length > 0 ? successfulFiles[0].dimensions : 0;

        document.getElementById('filesProcessed').textContent = successfulFiles.length;
        document.getElementById('totalVectors').textContent = totalVectors.toLocaleString();
        document.getElementById('dimensions').textContent = dimensions;
    }

    showAnalysisSection() {
        document.getElementById('analysisSection').style.display = 'block';
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new GGUFVectorAnalyzer();
});

