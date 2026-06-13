'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, X, Pencil, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/app/lib/imageCompression';
import PhotoEditorModal from './PhotoEditorModal';

interface ImageUploaderProps {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
}

interface UploadProgressItem {
  id: string;
  name: string;
  progress: number;
  status: 'compressing' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

export default function ImageUploader({ imageUrls, onChange, maxFiles = 10 }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgressList, setUploadProgressList] = useState<UploadProgressItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    setError(null);

    // Validate overall count
    const totalCount = imageUrls.length + files.length + uploadProgressList.filter(item => item.status !== 'error').length;
    if (totalCount > maxFiles) {
      setError(`Maximum limit: ${maxFiles} images per post.`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    files.forEach(async (file) => {
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. PNG, JPEG, GIF, or WEBP only.');
        return;
      }

      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        setError('File size too large. Limit is 5MB.');
        return;
      }

      const itemId = Math.random().toString(36).substring(2) + '-' + Date.now();
      const newProgressItem: UploadProgressItem = {
        id: itemId,
        name: file.name,
        progress: 0,
        status: file.type === 'image/gif' ? 'uploading' : 'compressing'
      };

      setUploadProgressList(prev => [...prev, newProgressItem]);

      try {
        let uploadBlob: Blob = file;
        let uploadName = file.name;

        // Compress if not a GIF
        if (file.type !== 'image/gif') {
          try {
            uploadBlob = await compressImage(file, 0.75, 1200, 1200);
            uploadName = file.name.replace(/\.[^/.]+$/, '.jpg');
          } catch (compErr) {
            console.warn('Compression failed, using original:', compErr);
          }
        }

        setUploadProgressList(prev => prev.map(item => 
          item.id === itemId ? { ...item, status: 'uploading', progress: 10 } : item
        ));

        const fileExt = uploadName.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `post-images/${fileName}`;

        // Supabase upload with manual fake progress increments
        // since storage API onUploadProgress is sometimes buggy or unsupported in various client versions.
        const progressInterval = setInterval(() => {
          setUploadProgressList(prev => prev.map(item => {
            if (item.id === itemId && item.status === 'uploading' && item.progress < 90) {
              return { ...item, progress: item.progress + 15 };
            }
            return item;
          }));
        }, 150);

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, uploadBlob, {
            contentType: file.type === 'image/gif' ? 'image/gif' : 'image/jpeg'
          });

        clearInterval(progressInterval);

        if (uploadError) throw new Error(uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        // Success
        setUploadProgressList(prev => prev.filter(item => item.id !== itemId));
        onChange([...imageUrls, publicUrl]);
      } catch (err: any) {
        setUploadProgressList(prev => prev.map(item => 
          item.id === itemId ? { ...item, status: 'error', errorMsg: err.message || 'Upload failed' } : item
        ));
      }
    });
  };

  const removeImage = (indexToRemove: number) => {
    const nextUrls = imageUrls.filter((_, idx) => idx !== indexToRemove);
    onChange(nextUrls);
  };

  const handleEditedPhotoSave = async (editedBlob: Blob, editedDataUrl: string) => {
    if (editingIndex === null) return;
    
    // Create new uploading item
    const itemId = 'edit-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const newProgressItem: UploadProgressItem = {
      id: itemId,
      name: `edited-image-${editingIndex + 1}.jpg`,
      progress: 20,
      status: 'uploading'
    };

    setUploadProgressList(prev => [...prev, newProgressItem]);
    setEditingIndex(null);

    try {
      const fileName = `edited-${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
      const filePath = `post-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, editedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      // Replace URL at editingIndex
      const nextUrls = [...imageUrls];
      nextUrls[editingIndex] = publicUrl;
      
      setUploadProgressList(prev => prev.filter(item => item.id !== itemId));
      onChange(nextUrls);
    } catch (err: any) {
      setUploadProgressList(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'error', errorMsg: err.message || 'Edit upload failed' } : item
      ));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* Dropzone Box */}
      {imageUrls.length < maxFiles && (
        <div
          className={`uploader-box ${dragActive ? 'active' : ''}`}
          onClick={triggerFileInput}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <UploadCloud size={32} className="uploader-icon" />
          <div className="uploader-text">
            Drag & Drop or click to upload
          </div>
          <div className="uploader-subtext">
            PNG, JPEG, WEBP or GIF (max 5MB) • Up to {maxFiles} images
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/png, image/jpeg, image/gif, image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Uploading Status / Progress bars */}
      {uploadProgressList.length > 0 && (
        <div className="upload-list">
          {uploadProgressList.map((item) => (
            <div className="upload-item" key={item.id}>
              <div className="upload-info">
                <span className="upload-name">{item.name}</span>
                <span className="upload-progress-text">
                  {item.status === 'compressing' ? 'Compressing image...' : 
                   item.status === 'error' ? `Error: ${item.errorMsg}` : 
                   `Uploading: ${item.progress}%`}
                </span>
                {item.status !== 'error' && (
                  <div className="upload-progress-container">
                    <div 
                      className="upload-progress-fill" 
                      style={{ width: `${item.status === 'compressing' ? 5 : item.progress}%` }} 
                    />
                  </div>
                )}
              </div>
              
              <div className="upload-actions">
                <button
                  type="button"
                  className="upload-action-btn delete"
                  onClick={() => setUploadProgressList(prev => prev.filter(p => p.id !== item.id))}
                  title="Cancel / Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Successfully Uploaded Previews */}
      {imageUrls.length > 0 && (
        <div className="upload-list" style={{ marginTop: '0.5rem' }}>
          {imageUrls.map((url, index) => (
            <div className="upload-item" key={url + '-' + index}>
              <div className="upload-thumbnail-wrap">
                <img src={url} alt={`Upload preview ${index + 1}`} className="upload-thumbnail" />
              </div>
              <div className="upload-info">
                <span className="upload-name" style={{ fontSize: '0.8rem' }}>Image #{index + 1}</span>
                <span className="upload-progress-text">Successfully attached</span>
              </div>
              <div className="upload-actions">
                <button
                  type="button"
                  className="upload-action-btn"
                  onClick={() => setEditingIndex(index)}
                  title="Crop / Edit Image"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="upload-action-btn delete"
                  onClick={() => removeImage(index)}
                  title="Delete Attachment"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Editor trigger */}
      {editingIndex !== null && (
        <PhotoEditorModal
          isOpen={editingIndex !== null}
          onClose={() => setEditingIndex(null)}
          imageUrl={imageUrls[editingIndex]}
          onSave={handleEditedPhotoSave}
        />
      )}
      
    </div>
  );
}
