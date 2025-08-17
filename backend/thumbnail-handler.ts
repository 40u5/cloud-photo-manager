import { PhotoMetadata } from "./types";

export interface FileMetadata {
    id: string;
    name: string;
    path: string;
    date_taken: Date;
    size: number;
    providerType: string;
    instanceIndex: number;
    hash?: string;
}

export class ThumbnailHandler {
    private static instance: ThumbnailHandler;
    static dateSortedThumbnails: FileMetadata[] = [];
    static renderPointer: number = 0; // (starts from end, goes backwards)

    public static getInstance(): ThumbnailHandler {
        if (!ThumbnailHandler.instance) {
            ThumbnailHandler.instance = new ThumbnailHandler();
        }
        return ThumbnailHandler.instance;
    }

    // add the batch of photos in sorted order (newest first)
    static async addThumbnails(files: FileMetadata[]) {
        // Filter to only image files
        const imageFiles = files.filter(file => ThumbnailHandler.isImage(file));
        
        // If no images to add, return early
        if (imageFiles.length === 0) {
            return;
        }
        
        // Sort new images by date (oldest first, newest last)
        imageFiles.sort((a, b) => a.date_taken.getTime() - b.date_taken.getTime());
        
        // If existing array is empty, just assign the sorted images
        if (ThumbnailHandler.dateSortedThumbnails.length === 0) {
            ThumbnailHandler.dateSortedThumbnails = imageFiles;
            return;
        }
        
        // Merge the sorted arrays efficiently
        const merged: FileMetadata[] = [];
        let i = 0; // pointer for existing photos
        let j = 0; // pointer for new photos
        
        while (i < ThumbnailHandler.dateSortedThumbnails.length && j < imageFiles.length) {
            if (ThumbnailHandler.dateSortedThumbnails[i].date_taken <= imageFiles[j].date_taken) {
                merged.push(ThumbnailHandler.dateSortedThumbnails[i]);
                i++;
            } else {
                merged.push(imageFiles[j]);
                j++;
            }
        }
        
        // Add remaining photos from either array
        while (i < ThumbnailHandler.dateSortedThumbnails.length) {
            merged.push(ThumbnailHandler.dateSortedThumbnails[i]);
            i++;
        }
        
        while (j < imageFiles.length) {
            merged.push(imageFiles[j]);
            j++;
        }
        
        ThumbnailHandler.dateSortedThumbnails = merged;
        ThumbnailHandler.renderPointer = merged.length; // Reset pointer to end after merge
    };

    static async isImage(file: FileMetadata): Promise<boolean> {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw', '.dng'];
        
        const lastDotIndex = file.name.lastIndexOf('.');
        
        // If no extension found, or if the dot is at the beginning (hidden file), return false
        if (lastDotIndex === -1 || lastDotIndex === 0) {
            return false;
        }
        
        const extension = file.name.toLowerCase().substring(lastDotIndex);
        return imageExtensions.includes(extension);
    };

    static async removeProvider(providerType: string, instanceIndex: number) {
        ThumbnailHandler.dateSortedThumbnails = ThumbnailHandler.dateSortedThumbnails.filter(thumbnail => 
            thumbnail.providerType !== providerType ||
             thumbnail.instanceIndex !== instanceIndex);
        ThumbnailHandler.renderPointer = ThumbnailHandler.dateSortedThumbnails.length; // Reset pointer after removal
    }
    
    static async convertToPhotoMetadata(id: string, name: string, path: string, date_taken: Date, size: number, providerType: string, instanceIndex: number, hash?: string): Promise<PhotoMetadata> {
        return {
            id: id,
            name: name,
            path: path,
            date_taken: date_taken,
            size: size,
            providerType: providerType,
            instanceIndex: instanceIndex,
            hash: hash
        }
    }

    static async getThumbnailObjects(index: number, size: number): Promise<PhotoMetadata[]> {
        const totalLength = ThumbnailHandler.dateSortedThumbnails.length;
        
        if (totalLength === 0 || index < 0 || size <= 0 || index >= totalLength) {
            return [];
        }
        
        // index 0 = newest photo
        const startIndex = totalLength - 1 - index;
        const endIndex = Math.max(0, startIndex - size + 1);
        
        return ThumbnailHandler.dateSortedThumbnails.slice(endIndex, startIndex + 1).reverse();
    }
}