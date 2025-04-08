// src/services/fileStorage.ts
import { mkdir, writeFile, unlink, readFile, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { rm } from 'fs/promises';

// Define storage structure
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

// Ensure upload directory exists
export const initializeStorage = async () => {
  try {
    // Create main upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
    console.log(`Storage initialized at ${UPLOAD_DIR}`);
    return true;
  } catch (error) {
    console.error('Error initializing storage:', error);
    return false;
  }
};

// Get user storage directory
export const getUserStorageDir = (userId: number): string => {
  return join(UPLOAD_DIR, `user_${userId}`);
};

// Save a file to storage
export const saveFile = async (
  userId: number,
  fileData: Buffer | Blob,
  originalFilename: string
): Promise<{ filePath: string; fileId: string }> => {
  // Create unique filename using UUID
  const fileExtension = extname(originalFilename);
  const fileId = randomUUID();
  const filename = `${fileId}${fileExtension}`;

  // Create path structure: /uploads/user_123/abc/def/file.ext
  // We use the first 3 chars of the UUID twice to create a directory structure
  // This helps prevent having too many files in a single directory
  const firstDir = fileId.substring(0, 3);
  const secondDir = fileId.substring(3, 6);
  
  const userDir = getUserStorageDir(userId);
  const fileDir = join(userDir, firstDir, secondDir);
  const filePath = join(fileDir, filename);
  
  // Create directory structure
  await mkdir(fileDir, { recursive: true });
  
  // Write file to disk
  if (fileData instanceof Blob) {
    const arrayBuffer = await fileData.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));
  } else {
    await writeFile(filePath, fileData);
  }
  
  // Return relative path from UPLOAD_DIR
  const relativePath = filePath.replace(UPLOAD_DIR, '');
  return { 
    filePath: relativePath, 
    fileId 
  };
};

// Get a file from storage
export const getFile = async (filePath: string): Promise<Buffer> => {
  const fullPath = join(UPLOAD_DIR, filePath);
  return await readFile(fullPath);
};

// Delete a file from storage
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    const fullPath = join(UPLOAD_DIR, filePath);
    await unlink(fullPath);
    
    // Clean up empty directories
    let dirPath = dirname(fullPath);
    
    // Try to remove parent directories if they're empty
    // This is a best-effort cleanup, failures are not critical
    try {
      while (dirPath !== UPLOAD_DIR) {
        // Use readdir from fs/promises instead of Bun.file().list()
        const dirContents = await readdir(dirPath);
        if (dirContents.length > 0) break;
        
        // Use rm from fs/promises instead of Bun.rm()
        await rm(dirPath, { recursive: true });
        dirPath = dirname(dirPath);
      }
    } catch (err) {
      // Ignore errors in directory cleanup
      console.warn('Directory cleanup error:', err);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Get file metadata
export const getFileMetadata = async (filePath: string): Promise<{ size: number, modified: Date } | null> => {
  try {
    const fullPath = join(UPLOAD_DIR, filePath);
    const fileStats = await stat(fullPath);
    
    return {
      size: fileStats.size,
      modified: fileStats.mtime
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
};

// Get user storage usage
export const getUserStorageUsage = async (userId: number): Promise<number> => {
  try {
    let totalSize = 0;
    const userDir = getUserStorageDir(userId);
    
    // Function to recursively calculate directory size
    const calculateDirSize = async (directory: string): Promise<number> => {
      let size = 0;
      
      if (!existsSync(directory)) {
        return 0;
      }
      
      // Use readdir from fs/promises instead of Bun.file().list()
      const files = await readdir(directory);
      
      for (const file of files) {
        const filePath = join(directory, file);
        const fileStats = await stat(filePath);
        
        if (fileStats.isDirectory()) {
          size += await calculateDirSize(filePath);
        } else {
          size += fileStats.size;
        }
      }
      
      return size;
    };
    
    // Calculate total storage usage
    if (existsSync(userDir)) {
      totalSize = await calculateDirSize(userDir);
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return 0;
  }
};