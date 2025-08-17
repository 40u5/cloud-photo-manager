import React from 'react';
import { GridChildComponentProps } from 'react-window';
import { PhotoMetadata } from '../types';

interface PhotoItemProps extends GridChildComponentProps {
  photos: PhotoMetadata[];
  columns?: number;
}

const PhotoItem: React.FC<PhotoItemProps> = ({ 
  columnIndex, 
  rowIndex, 
  style, 
  photos,
  columns = 5
}) => {
  const photoIndex = rowIndex * columns + columnIndex;
  const photo = photos[photoIndex];

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!photo) {
    return <div style={style}></div>;
  }

  return (
    <div style={{ ...style, padding: '8px' }}>
      <div className="group relative bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 h-full">
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          {photo.thumbnail && 'data' in photo.thumbnail ? (
            <img 
              src={`data:${photo.thumbnail.mimeType};base64,${photo.thumbnail.data}`}
              alt={photo.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : photo.thumbnail && 'error' in photo.thumbnail ? (
            <div className="text-center p-4">
              <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-500 font-medium">Error loading thumbnail</p>
            </div>
          ) : (
            <div className="text-center p-4">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-gray-500 font-medium truncate">{photo.name}</p>
            </div>
          )}
        </div>
        
        {/* Hover overlay with metadata */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-75 transition-all duration-200 flex items-end opacity-0 group-hover:opacity-100">
          <div className="text-white p-3 w-full">
            <p className="text-sm font-medium truncate mb-1">{photo.name}</p>
            <p className="text-xs opacity-90 mb-1">{formatDate(photo.date_taken)}</p>
            <p className="text-xs opacity-75">{formatFileSize(photo.size)}</p>
            <div className="flex items-center mt-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500 bg-opacity-75 text-white">
                {photo.providerType.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoItem;
