import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
import { PhotoMetadata } from '../types';
import PhotoItem from './PhotoItem';

interface PhotoGalleryProps {
  onError: (message: string) => void;
  onLoading: (loading: boolean) => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ onError, onLoading }) => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  const PHOTOS_PER_PAGE = 50; // Increased since virtualization handles performance
  const COLUMNS = 5;
  const ITEM_SIZE = 220; // Size of each grid item including padding

  const loadPhotos = useCallback(async (index: number = 0, size: number = PHOTOS_PER_PAGE) => {
    if (loading) return;
    
    console.log(`Frontend requesting thumbnails: index=${index}, size=${size}`);
    setLoading(true);
    onLoading(true);
    
    try {
      const response = await fetch(`/provider/get-thumbnails?index=${index}&size=${size}`);
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = 'Failed to fetch photos';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `Failed to fetch photos: ${errorData.error}`;
          }
        } catch {
          // If we can't parse the error response, use the default message
          errorMessage = `Failed to fetch photos (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      const newPhotos: PhotoMetadata[] = await response.json();
      
      // Convert date strings to Date objects
      const processedPhotos = newPhotos.map(photo => ({
        ...photo,
        date_taken: new Date(photo.date_taken)
      }));
      
      if (index === 0) {
        // Initial load or refresh
        setPhotos(processedPhotos);
      } else {
        // Append new photos for lazy loading
        setPhotos(prev => [...prev, ...processedPhotos]);
      }
      
      // If we received fewer photos than requested, we've reached the end
      setHasMore(processedPhotos.length === size);
      setCurrentIndex(index + processedPhotos.length);
      
    } catch (error) {
      console.error('Error loading photos:', error);
      onError(`Failed to load photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }, [loading, onError, onLoading]);

  // Calculate grid dimensions
  const rowCount = Math.ceil(photos.length / COLUMNS);
  
  // Resize observer to handle container size changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: Math.min(600, window.innerHeight - 200) // Max height with some padding
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initial load
  useEffect(() => {
    loadPhotos(0, PHOTOS_PER_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for initial load only - prevent infinite loop

  // Handle infinite scroll with react-window
  const handleItemsRendered = useCallback(
    ({ visibleRowStopIndex }: { visibleRowStopIndex: number }) => {
      const totalVisibleItems = (visibleRowStopIndex + 1) * COLUMNS;
      const loadThreshold = photos.length - COLUMNS * 2; // Load more when near the end
      
      if (totalVisibleItems >= loadThreshold && hasMore && !loading) {
        loadPhotos(currentIndex, PHOTOS_PER_PAGE);
      }
    },
    [photos.length, hasMore, loading, currentIndex, loadPhotos, COLUMNS, PHOTOS_PER_PAGE]
  );

  // Memoized PhotoItem with photos prop
  const itemRenderer = useCallback(
    (props: GridChildComponentProps) => (
      <PhotoItem {...props} photos={photos} columns={COLUMNS} />
    ),
    [photos, COLUMNS]
  );

  return (
    <section className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Photo Gallery</h2>
      
      {photos.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos found</h3>
          <p className="text-gray-500">Connect and authenticate a cloud provider to see your photos here.</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full">
            {containerSize.width > 0 && (
              <Grid
                ref={gridRef}
                columnCount={COLUMNS}
                columnWidth={containerSize.width / COLUMNS}
                height={containerSize.height}
                rowCount={rowCount}
                rowHeight={ITEM_SIZE}
                width={containerSize.width}
                onItemsRendered={handleItemsRendered}
              >
                {itemRenderer}
              </Grid>
            )}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center space-x-2 text-gray-500">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading more photos...</span>
              </div>
            </div>
          )}

          {/* Status messages */}
          {!hasMore && photos.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>You've reached the end of your photo collection!</p>
              <p className="text-sm mt-1">Total photos: {photos.length}</p>
            </div>
          )}

          {hasMore && !loading && photos.length > 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              Scroll down to load more photos
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PhotoGallery;
