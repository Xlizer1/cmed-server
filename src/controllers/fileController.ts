import pool from '../config/database';
import { cacheMiddleware } from '../config/redis';
import { 
  saveFile, 
  getFile, 
  deleteFile, 
  getFileMetadata
} from '../services/fileStorage';
import { UploadedFile, FileMetadata } from '../types/fileTypes';
import { OkPacket, RowDataPacket } from 'mysql2';

// Define types for MySQL results
type QueryResult = [RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[], any];

export const fileController = {
  // Upload a file
  uploadFile: async (userId: number, file: UploadedFile, folderId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Convert file data to buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      // Save file to storage
      const { filePath, fileId } = await saveFile(
        userId,
        fileBuffer,
        file.name
      );
      
      // Insert file record to database
      const [result] = await connection.query(
        `INSERT INTO files (user_id, folder_id, name, file_path, mime_type, size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, folderId, file.name, filePath, file.type, file.size]
      ) as QueryResult;
      
      // Get file ID
      const fileDbId = (result as OkPacket).insertId;
      
      // Clear folder cache
      if (folderId) {
        await cacheMiddleware.delete(`folder:${folderId}:contents`);
      }
      await cacheMiddleware.delete(`user:${userId}:folders`);
      
      // Commit transaction
      await connection.commit();
      
      // Get file details
      const [files] = await connection.query(
        `SELECT * FROM files WHERE file_id = ?`,
        [fileDbId]
      ) as [RowDataPacket[], any];
      
      if (files.length > 0) {
        return {
          success: true,
          file: {
            id: files[0].file_id,
            name: files[0].name,
            size: files[0].size,
            mime_type: files[0].mime_type,
            created_at: files[0].created_at,
            updated_at: files[0].updated_at
          }
        };
      }
      
      return { success: true, file: { id: fileDbId } };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error uploading file:', error);
      return { success: false, error: 'Failed to upload file' };
    } finally {
      connection.release();
    }
  },
  
  // Upload multiple files
  uploadMultipleFiles: async (userId: number, files: UploadedFile[], folderId: number | null) => {
    const uploadedFiles = [];
    const failedFiles = [];
    
    for (const file of files) {
      const result = await fileController.uploadFile(userId, file, folderId);
      
      if (result.success) {
        uploadedFiles.push(result.file);
      } else {
        failedFiles.push({
          name: file.name,
          error: result.error
        });
      }
    }
    
    return {
      success: true,
      uploadedFiles,
      failedFiles
    };
  },
  
  // Download a file
  downloadFile: async (userId: number, fileId: number) => {
    const connection = await pool.getConnection();
    
    try {
      // Get file record
      const [files] = await connection.query(
        `SELECT * FROM files WHERE file_id = ? AND user_id = ?`,
        [fileId, userId]
      ) as [RowDataPacket[], any];
      
      if (files.length === 0) {
        return { success: false, error: 'File not found' };
      }
      
      const file = files[0];
      
      // Get file from storage
      const fileData = await getFile(file.file_path);
      
      return {
        success: true,
        file: {
          data: fileData,
          name: file.name,
          mime_type: file.mime_type,
          size: file.size
        }
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      return { success: false, error: 'Failed to download file' };
    } finally {
      connection.release();
    }
  },
  
  // Delete a file
  deleteFile: async (userId: number, fileId: number) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Get file record
      const [files] = await connection.query(
        `SELECT * FROM files WHERE file_id = ? AND user_id = ?`,
        [fileId, userId]
      ) as [RowDataPacket[], any];
      
      if (files.length === 0) {
        await connection.rollback();
        return { success: false, error: 'File not found' };
      }
      
      const file = files[0];
      
      // Delete file from storage
      await deleteFile(file.file_path);
      
      // Delete file record from database
      await connection.query(
        `DELETE FROM files WHERE file_id = ?`,
        [fileId]
      );
      
      // Clear caches
      await cacheMiddleware.delete(`file:${fileId}`);
      if (file.folder_id) {
        await cacheMiddleware.delete(`folder:${file.folder_id}:contents`);
      }
      await cacheMiddleware.delete(`user:${userId}:folders`);
      
      // Commit transaction
      await connection.commit();
      
      return { success: true };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error deleting file:', error);
      return { success: false, error: 'Failed to delete file' };
    } finally {
      connection.release();
    }
  },
  
  // Get file details
  getFileDetails: async (userId: number, fileId: number) => {
    const connection = await pool.getConnection();
    
    try {
      // Check cache first
      const cachedFile = await cacheMiddleware.get(`file:${fileId}`);
      if (cachedFile) {
        return { success: true, file: cachedFile };
      }
      
      // Get file record
      const [files] = await connection.query(
        `SELECT * FROM files WHERE file_id = ? AND user_id = ?`,
        [fileId, userId]
      ) as [RowDataPacket[], any];
      
      if (files.length === 0) {
        return { success: false, error: 'File not found' };
      }
      
      const file = files[0];
      
      // Get additional metadata from storage
      const metadata = await getFileMetadata(file.file_path);
      
      const fileDetails = {
        id: file.file_id,
        name: file.name,
        size: file.size,
        mime_type: file.mime_type,
        folder_id: file.folder_id,
        created_at: file.created_at,
        updated_at: file.updated_at,
        last_modified: metadata?.modified || file.updated_at
      };
      
      // Cache file details
      await cacheMiddleware.set(`file:${fileId}`, fileDetails);
      
      return { success: true, file: fileDetails };
    } catch (error) {
      console.error('Error getting file details:', error);
      return { success: false, error: 'Failed to get file details' };
    } finally {
      connection.release();
    }
  },
  
  // Get files in a folder
  getFilesInFolder: async (userId: number, folderId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      const cacheKey = folderId 
        ? `folder:${folderId}:files`
        : `user:${userId}:root:files`;
        
      // Check cache first
      const cachedFiles = await cacheMiddleware.get(cacheKey);
      if (cachedFiles) {
        return { success: true, files: cachedFiles };
      }
      
      // Get files
      const [files] = await connection.query(
        `SELECT * FROM files WHERE user_id = ? AND folder_id ${folderId ? '= ?' : 'IS NULL'}
         ORDER BY name ASC`,
        folderId ? [userId, folderId] : [userId]
      ) as [RowDataPacket[], any];
      
      const fileList = files.map((file: RowDataPacket) => ({
        id: file.file_id,
        name: file.name,
        size: file.size,
        mime_type: file.mime_type,
        folder_id: file.folder_id,
        created_at: file.created_at,
        updated_at: file.updated_at,
        file_name: file.name // Added for frontend compatibility
      }));
      
      // Cache file list
      await cacheMiddleware.set(cacheKey, fileList);
      
      return { success: true, files: fileList };
    } catch (error) {
      console.error('Error getting files in folder:', error);
      return { success: false, error: 'Failed to get files in folder' };
    } finally {
      connection.release();
    }
  },
  
  // Search files
  searchFiles: async (userId: number, searchTerm: string) => {
    const connection = await pool.getConnection();
    
    try {
      // Search files by name
      const [files] = await connection.query(
        `SELECT * FROM files 
         WHERE user_id = ? AND name LIKE ?
         ORDER BY name ASC`,
        [userId, `%${searchTerm}%`]
      ) as [RowDataPacket[], any];
      
      const fileList = files.map((file: RowDataPacket) => ({
        id: file.file_id,
        name: file.name,
        size: file.size,
        mime_type: file.mime_type,
        folder_id: file.folder_id,
        created_at: file.created_at,
        updated_at: file.updated_at,
        file_name: file.name, // Added for frontend compatibility
        type: 'file' // For frontend search results
      }));
      
      return { success: true, files: fileList };
    } catch (error) {
      console.error('Error searching files:', error);
      return { success: false, error: 'Failed to search files' };
    } finally {
      connection.release();
    }
  }
};