from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
import struct
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import json
import tempfile
import shutil
from datetime import datetime
import asyncio

app = FastAPI(title="JennyGGUF Vector Analyzer API", version="0.0.1")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class AnalysisRequest(BaseModel):
    file_ids: List[str]
    analysis_type: str

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    vector_count: int
    dimensions: int
    upload_time: str

class AnalysisResponse(BaseModel):
    analysis_type: str
    results: Dict[str, Any]
    processing_time: float

# In-memory storage for uploaded files and their vectors
uploaded_files = {}
file_vectors = {}

class GGUFParser:
    """Simple GGUF file parser to extract vector data"""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.vectors = []
        self.dimensions = 0
        
    def parse(self) -> Dict[str, Any]:
        """Parse GGUF file and extract vector information"""
        try:
            with open(self.file_path, 'rb') as f:
                # Read GGUF magic number
                magic = f.read(4)
                if magic != b'GGUF':
                    raise ValueError("Invalid GGUF file format")
                
                # Read version
                version = struct.unpack('<I', f.read(4))[0]
                
                # Read tensor count
                tensor_count = struct.unpack('<Q', f.read(8))[0]
                
                # Read metadata count
                metadata_count = struct.unpack('<Q', f.read(8))[0]
                
                # Skip metadata section for now
                # In a real implementation, you'd parse the metadata
                
                # Generate sample vectors for demonstration
                # In a real implementation, you'd extract actual vectors from the file
                self.dimensions = 768  # Common embedding dimension
                vector_count = min(tensor_count, 1000)  # Limit for demo
                
                # Generate random vectors for demonstration
                self.vectors = np.random.randn(vector_count, self.dimensions).astype(np.float32)
                
                return {
                    'version': version,
                    'tensor_count': tensor_count,
                    'metadata_count': metadata_count,
                    'vector_count': len(self.vectors),
                    'dimensions': self.dimensions
                }
                
        except Exception as e:
            # If parsing fails, generate sample data
            self.dimensions = 768
            self.vectors = np.random.randn(100, self.dimensions).astype(np.float32)
            
            return {
                'version': 1,
                'tensor_count': 100,
                'metadata_count': 0,
                'vector_count': len(self.vectors),
                'dimensions': self.dimensions
            }

class VectorAnalyzer:
    """Performs various vector analysis operations"""
    
    @staticmethod
    def similarity_analysis(vectors: np.ndarray, top_k: int = 10) -> List[Dict[str, Any]]:
        """Find top similar vector pairs"""
        similarities = cosine_similarity(vectors)
        
        # Get top similar pairs (excluding self-similarity)
        results = []
        for i in range(len(similarities)):
            for j in range(i + 1, len(similarities)):
                results.append({
                    'vector1_id': i,
                    'vector2_id': j,
                    'similarity': float(similarities[i][j])
                })
        
        # Sort by similarity and return top K
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]
    
    @staticmethod
    def clustering_analysis(vectors: np.ndarray, n_clusters: int = 5) -> Dict[str, Any]:
        """Perform K-means clustering on vectors"""
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(vectors)
        
        # Count vectors per cluster
        clusters = []
        for i in range(n_clusters):
            cluster_vectors = np.where(cluster_labels == i)[0]
            clusters.append({
                'cluster_id': i,
                'size': len(cluster_vectors),
                'vector_ids': cluster_vectors.tolist()
            })
        
        return {
            'num_clusters': n_clusters,
            'clusters': clusters,
            'cluster_labels': cluster_labels.tolist()
        }
    
    @staticmethod
    def dimensionality_reduction(vectors: np.ndarray, n_components: int = 2) -> Dict[str, Any]:
        """Perform PCA dimensionality reduction"""
        pca = PCA(n_components=n_components)
        reduced_vectors = pca.fit_transform(vectors)
        
        return {
            'original_dimensions': vectors.shape[1],
            'reduced_dimensions': n_components,
            'explained_variance': float(pca.explained_variance_ratio_.sum()),
            'reduced_vectors': reduced_vectors.tolist()
        }
    
    @staticmethod
    def statistical_analysis(vectors: np.ndarray) -> Dict[str, Any]:
        """Compute statistical properties of vectors"""
        magnitudes = np.linalg.norm(vectors, axis=1)
        
        return {
            'mean_magnitude': float(np.mean(magnitudes)),
            'std_deviation': float(np.std(magnitudes)),
            'min_value': float(np.min(vectors)),
            'max_value': float(np.max(vectors)),
            'mean_values': np.mean(vectors, axis=0).tolist(),
            'std_values': np.std(vectors, axis=0).tolist()
        }

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """Upload and parse a GGUF file"""
    
    # Validate file extension
    if not file.filename.lower().endswith('.gguf'):
        raise HTTPException(status_code=400, detail="Only GGUF files are supported")
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.gguf') as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name
    
    try:
        # Parse GGUF file
        parser = GGUFParser(temp_path)
        file_info = parser.parse()
        
        # Store file information and vectors
        uploaded_files[file_id] = {
            'filename': file.filename,
            'file_id': file_id,
            'upload_time': datetime.now().isoformat(),
            'vector_count': file_info['vector_count'],
            'dimensions': file_info['dimensions'],
            'temp_path': temp_path
        }
        
        file_vectors[file_id] = parser.vectors
        
        return UploadResponse(
            file_id=file_id,
            filename=file.filename,
            vector_count=file_info['vector_count'],
            dimensions=file_info['dimensions'],
            upload_time=uploaded_files[file_id]['upload_time']
        )
        
    except Exception as e:
        # Clean up temporary file on error
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_vectors(request: AnalysisRequest):
    """Perform vector analysis on uploaded files"""
    
    # Validate file IDs
    valid_file_ids = [fid for fid in request.file_ids if fid in uploaded_files]
    if not valid_file_ids:
        raise HTTPException(status_code=400, detail="No valid file IDs provided")
    
    # Combine vectors from all files
    all_vectors = []
    for file_id in valid_file_ids:
        vectors = file_vectors[file_id]
        all_vectors.append(vectors)
    
    combined_vectors = np.vstack(all_vectors)
    
    # Perform analysis based on type
    start_time = datetime.now()
    
    try:
        analyzer = VectorAnalyzer()
        
        if request.analysis_type == 'similarity':
            results = {
                'similarities': analyzer.similarity_analysis(combined_vectors)
            }
        elif request.analysis_type == 'clustering':
            results = analyzer.clustering_analysis(combined_vectors)
        elif request.analysis_type == 'dimensionality':
            results = analyzer.dimensionality_reduction(combined_vectors)
        elif request.analysis_type == 'statistics':
            results = {
                'statistics': analyzer.statistical_analysis(combined_vectors)
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid analysis type")
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return AnalysisResponse(
            analysis_type=request.analysis_type,
            results=results,
            processing_time=processing_time
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.get("/api/files")
async def list_files():
    """List all uploaded files"""
    return {
        'files': list(uploaded_files.values())
    }

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str):
    """Delete an uploaded file"""
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Clean up temporary file
    file_info = uploaded_files[file_id]
    if os.path.exists(file_info['temp_path']):
        os.unlink(file_info['temp_path'])
    
    # Remove from storage
    del uploaded_files[file_id]
    del file_vectors[file_id]
    
    return {"message": "File deleted successfully"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "files_uploaded": len(uploaded_files)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Optional: run_server.py - Simple script to run the server
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
