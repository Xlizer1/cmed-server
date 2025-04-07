// src/controllers/folderController.ts
import pool from '../config/database';
import { cacheMiddleware } from '../config/redis';
import { fileController } from './fileController';

export const folderController = {
  // Create a new folder
  createFolder: async (userId: number, name: string, parentFolderId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Verify parent folder exists if specified
      if (parentFolderId) {
        const [parentFolders] = await connection.query(
          `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
          [parentFolderId, userId]
        );
        
        if (parentFolders.length === 0) {
          await connection.rollback();
          return { success: false, error: 'Parent folder not found' };
        }
      }
      
      // Check if folder already exists at this level
      const [existingFolders] = await connection.query(
        `SELECT * FROM folders 
         WHERE user_id = ? AND name = ? AND 
         (parent_folder_id ${parentFolderId ? '= ?' : 'IS NULL'})`,
        parentFolderId ? [userId, name, parentFolderId] : [userId, name]
      );
      
      if (existingFolders.length > 0) {
        await connection.rollback();
        return { success: false, error: 'Folder already exists' };
      }
      
      // Create the folder
      const [result] = await connection.query(
        `INSERT INTO folders (user_id, parent_folder_id, name)
         VALUES (?, ?, ?)`,
        [userId, parentFolderId, name]
      );
      
      const folderId = result.insertId;
      
      // Clear relevant caches
      if (parentFolderId) {
        await cacheMiddleware.delete(`folder:${parentFolderId}:subfolders`);
        await cacheMiddleware.delete(`folder:${parentFolderId}:contents`);
      }
      await cacheMiddleware.delete(`user:${userId}:folders`);
      await cacheMiddleware.deleteByPattern(`user:${userId}:folder_tree*`);
      
      // Commit transaction
      await connection.commit();
      
      // Get created folder
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE folder_id = ?`,
        [folderId]
      );
      
      if (folders.length > 0) {
        const folder = folders[0];
        return {
          success: true,
          folder: {
            id: folder.folder_id,
            name: folder.name,
            parent_folder_id: folder.parent_folder_id,
            created_at: folder.created_at,
            updated_at: folder.updated_at
          }
        };
      }
      
      return { success: true, folder: { id: folderId } };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error creating folder:', error);
      return { success: false, error: 'Failed to create folder' };
    } finally {
      connection.release();
    }
  },
  
  // Delete a folder and its contents
  deleteFolder: async (userId: number, folderId: number) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Verify folder exists and belongs to user
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
        [folderId, userId]
      );
      
      if (folders.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Folder not found' };
      }
      
      const folder = folders[0];
      
      // Check if folder has files
      const [files] = await connection.query(
        `SELECT * FROM files WHERE folder_id = ?`,
        [folderId]
      );
      
      // Delete all files in the folder
      for (const file of files) {
        await fileController.deleteFile(userId, file.file_id);
      }
      
      // Get all subfolders
      const getSubfolders = async (parentId: number): Promise<number[]> => {
        const [subfolders] = await connection.query(
          `SELECT folder_id FROM folders WHERE parent_folder_id = ?`,
          [parentId]
        );
        
        let folderIds: number[] = [];
        
        for (const subfolder of subfolders) {
          folderIds.push(subfolder.folder_id);
          // Recursively get subfolders
          const childIds = await getSubfolders(subfolder.folder_id);
          folderIds = [...folderIds, ...childIds];
        }
        
        return folderIds;
      };
      
      // Get all subfolders to delete
      const subfolderIds = await getSubfolders(folderId);
      
      // Delete all subfolders (files in subfolders have already been deleted)
      if (subfolderIds.length > 0) {
        await connection.query(
          `DELETE FROM folders WHERE folder_id IN (?)`,
          [subfolderIds]
        );
      }
      
      // Delete the folder itself
      await connection.query(
        `DELETE FROM folders WHERE folder_id = ?`,
        [folderId]
      );
      
      // Clear caches
      await cacheMiddleware.delete(`folder:${folderId}`);
      await cacheMiddleware.delete(`folder:${folderId}:contents`);
      await cacheMiddleware.delete(`folder:${folderId}:subfolders`);
      
      if (folder.parent_folder_id) {
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:subfolders`);
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:contents`);
      }
      
      await cacheMiddleware.delete(`user:${userId}:folders`);
      await cacheMiddleware.deleteByPattern(`user:${userId}:folder_tree*`);
      
      // Commit transaction
      await connection.commit();
      
      return { success: true };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error deleting folder:', error);
      return { success: false, error: 'Failed to delete folder' };
    } finally {
      connection.release();
    }
  },
  
  // Rename a folder
  renameFolder: async (userId: number, folderId: number, newName: string) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Get folder details
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
        [folderId, userId]
      );
      
      if (folders.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Folder not found' };
      }
      
      const folder = folders[0];
      
      // Check if a folder with the new name already exists at this level
      const [existingFolders] = await connection.query(
        `SELECT * FROM folders 
         WHERE user_id = ? AND name = ? AND 
         folder_id != ? AND
         (parent_folder_id ${folder.parent_folder_id ? '= ?' : 'IS NULL'})`,
        folder.parent_folder_id 
          ? [userId, newName, folderId, folder.parent_folder_id] 
          : [userId, newName, folderId]
      );
      
      if (existingFolders.length > 0) {
        await connection.rollback();
        return { success: false, error: 'A folder with this name already exists' };
      }
      
      // Rename the folder
      await connection.query(
        `UPDATE folders SET name = ? WHERE folder_id = ?`,
        [newName, folderId]
      );
      
      // Clear caches
      await cacheMiddleware.delete(`folder:${folderId}`);
      if (folder.parent_folder_id) {
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:subfolders`);
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:contents`);
      }
      await cacheMiddleware.delete(`user:${userId}:folders`);
      await cacheMiddleware.deleteByPattern(`user:${userId}:folder_tree*`);
      
      // Commit transaction
      await connection.commit();
      
      return { 
        success: true,
        folder: {
          id: folderId,
          name: newName,
          parent_folder_id: folder.parent_folder_id,
          created_at: folder.created_at,
          updated_at: new Date()
        }
      };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error renaming folder:', error);
      return { success: false, error: 'Failed to rename folder' };
    } finally {
      connection.release();
    }
  },
  
  // Get folder details
  getFolderDetails: async (userId: number, folderId: number) => {
    const connection = await pool.getConnection();
    
    try {
      // Check cache first
      const cachedFolder = await cacheMiddleware.get(`folder:${folderId}`);
      if (cachedFolder) {
        return { success: true, folder: cachedFolder };
      }
      
      // Get folder
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
        [folderId, userId]
      );
      
      if (folders.length === 0) {
        return { success: false, error: 'Folder not found' };
      }
      
      const folder = folders[0];
      
      // Get parent folder name if exists
      let parentFolderName = null;
      if (folder.parent_folder_id) {
        const [parentFolders] = await connection.query(
          `SELECT name FROM folders WHERE folder_id = ?`,
          [folder.parent_folder_id]
        );
        
        if (parentFolders.length > 0) {
          parentFolderName = parentFolders[0].name;
        }
      }
      
      const folderDetails = {
        id: folder.folder_id,
        name: folder.name,
        parent_folder_id: folder.parent_folder_id,
        parent_folder_name: parentFolderName,
        created_at: folder.created_at,
        updated_at: folder.updated_at
      };
      
      // Cache folder details
      await cacheMiddleware.set(`folder:${folderId}`, folderDetails);
      
      return { success: true, folder: folderDetails };
    } catch (error) {
      console.error('Error getting folder details:', error);
      return { success: false, error: 'Failed to get folder details' };
    } finally {
      connection.release();
    }
  },
  
  // Get subfolders for a folder
  getSubfolders: async (userId: number, folderId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      const cacheKey = folderId 
        ? `folder:${folderId}:subfolders`
        : `user:${userId}:root:subfolders`;
      
      // Check cache first
      const cachedSubfolders = await cacheMiddleware.get(cacheKey);
      if (cachedSubfolders) {
        return { success: true, subfolders: cachedSubfolders };
      }
      
      // Get subfolders
      const [subfolders] = await connection.query(
        `SELECT * FROM folders 
         WHERE user_id = ? AND parent_folder_id ${folderId ? '= ?' : 'IS NULL'}
         ORDER BY name ASC`,
        folderId ? [userId, folderId] : [userId]
      );
      
      const subfolderList = subfolders.map(subfolder => ({
        id: subfolder.folder_id,
        name: subfolder.name,
        parent_folder_id: subfolder.parent_folder_id,
        created_at: subfolder.created_at,
        updated_at: subfolder.updated_at
      }));
      
      // Cache subfolders
      await cacheMiddleware.set(cacheKey, subfolderList);
      
      return { success: true, subfolders: subfolderList };
    } catch (error) {
      console.error('Error getting subfolders:', error);
      return { success: false, error: 'Failed to get subfolders' };
    } finally {
      connection.release();
    }
  },
  
  // Move a folder to another folder
  moveFolder: async (userId: number, folderId: number, newParentId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Get folder details
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
        [folderId, userId]
      );
      
      if (folders.length === 0) {
        await connection.rollback();
        return { success: false, error: 'Folder not found' };
      }
      
      const folder = folders[0];
      
      // Can't move a folder to itself
      if (folderId === newParentId) {
        await connection.rollback();
        return { success: false, error: 'Cannot move a folder to itself' };
      }
      
      // Validate new parent if specified
      if (newParentId) {
        // Check if new parent exists
        const [newParentFolders] = await connection.query(
          `SELECT * FROM folders WHERE folder_id = ? AND user_id = ?`,
          [newParentId, userId]
        );
        
        if (newParentFolders.length === 0) {
          await connection.rollback();
          return { success: false, error: 'New parent folder not found' };
        }
        
        // Make sure new parent is not a descendant of the folder being moved
        const isDescendant = async (checkId: number, targetId: number): Promise<boolean> => {
          if (checkId === targetId) return true;
          
          const [childFolders] = await connection.query(
            `SELECT folder_id FROM folders WHERE parent_folder_id = ?`,
            [checkId]
          );
          
          for (const child of childFolders) {
            if (await isDescendant(child.folder_id, targetId)) {
              return true;
            }
          }
          
          return false;
        };
        
        if (await isDescendant(folderId, newParentId)) {
          await connection.rollback();
          return { success: false, error: 'Cannot move a folder to its own subfolder' };
        }
        
        // Check if a folder with the same name already exists in the new parent
        const [existingFolders] = await connection.query(
          `SELECT * FROM folders 
           WHERE user_id = ? AND name = ? AND parent_folder_id = ?`,
          [userId, folder.name, newParentId]
        );
        
        if (existingFolders.length > 0) {
          await connection.rollback();
          return { success: false, error: 'A folder with this name already exists in the destination' };
        }
      } else {
        // Check if a folder with the same name already exists in the root
        const [existingFolders] = await connection.query(
          `SELECT * FROM folders 
           WHERE user_id = ? AND name = ? AND parent_folder_id IS NULL`,
          [userId, folder.name]
        );
        
        if (existingFolders.length > 0) {
          await connection.rollback();
          return { success: false, error: 'A folder with this name already exists in the destination' };
        }
      }
      
      // Move the folder
      await connection.query(
        `UPDATE folders SET parent_folder_id = ? WHERE folder_id = ?`,
        [newParentId, folderId]
      );
      
      // Clear caches
      await cacheMiddleware.delete(`folder:${folderId}`);
      if (folder.parent_folder_id) {
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:subfolders`);
        await cacheMiddleware.delete(`folder:${folder.parent_folder_id}:contents`);
      }
      if (newParentId) {
        await cacheMiddleware.delete(`folder:${newParentId}:subfolders`);
        await cacheMiddleware.delete(`folder:${newParentId}:contents`);
      }
      await cacheMiddleware.delete(`user:${userId}:folders`);
      await cacheMiddleware.deleteByPattern(`user:${userId}:folder_tree*`);
      
      // Commit transaction
      await connection.commit();
      
      return { 
        success: true,
        folder: {
          id: folderId,
          name: folder.name,
          parent_folder_id: newParentId,
          created_at: folder.created_at,
          updated_at: new Date()
        }
      };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('Error moving folder:', error);
      return { success: false, error: 'Failed to move folder' };
    } finally {
      connection.release();
    }
  },
  
  // Get folder content (both subfolders and files)
  getFolderContents: async (userId: number, folderId: number | null) => {
    const connection = await pool.getConnection();
    
    try {
      const cacheKey = folderId 
        ? `folder:${folderId}:contents`
        : `user:${userId}:root:contents`;
        
      // Check cache first
      const cachedContents = await cacheMiddleware.get(cacheKey);
      if (cachedContents) {
        return { success: true, contents: cachedContents };
      }
      
      // Get subfolders
      const subfoldersResult = await folderController.getSubfolders(userId, folderId);
      const subfolders = subfoldersResult.success ? subfoldersResult.subfolders : [];
      
      // Get files
      const filesResult = await fileController.getFilesInFolder(userId, folderId);
      const files = filesResult.success ? filesResult.files : [];
      
      // Prepare subfolders in the format expected by frontend
      const formattedSubfolders = subfolders.map(folder => ({
        id: folder.id,
        name: folder.name,
        level: folder.parent_folder_id ? 1 : 0, // Simple level mapping
        nodeId: folder.id.toString(), // For TreeView
        sub_classifications: [] // Will be populated by frontend recursively
      }));
      
      // Prepare files in the format expected by frontend
      const formattedFiles = files.map(file => ({
        id: file.id,
        name: file.name,
        file_name: file.name, // For frontend compatibility
        level: folderId ? 1 : 0, // Simple level mapping
        nodeId: `file-${file.id}`, // For TreeView
        size: file.size,
        mime_type: file.mime_type
      }));
      
      // Combine subfolders and files
      const contents = [
        ...formattedSubfolders,
        ...formattedFiles
      ];
      
      // Cache contents
      await cacheMiddleware.set(cacheKey, contents);
      
      return { success: true, contents };
    } catch (error) {
      console.error('Error getting folder contents:', error);
      return { success: false, error: 'Failed to get folder contents' };
    } finally {
      connection.release();
    }
  },
  
  // Get folder tree for sidebar
  getFolderTree: async (userId: number) => {
    const connection = await pool.getConnection();
    
    try {
      const cacheKey = `user:${userId}:folder_tree`;
        
      // Check cache first
      const cachedTree = await cacheMiddleware.get(cacheKey);
      if (cachedTree) {
        return { success: true, tree: cachedTree };
      }
      
      // Get all folders for the user
      const [folders] = await connection.query(
        `SELECT * FROM folders WHERE user_id = ? ORDER BY name ASC`,
        [userId]
      );
      
      // Build the tree recursively
      const buildTree = (parentId: number | null) => {
        const nodes = folders
          .filter(folder => 
            (parentId === null && folder.parent_folder_id === null) || 
            folder.parent_folder_id === parentId
          )
          .map(folder => {
            const children = buildTree(folder.folder_id);
            return {
              id: folder.folder_id,
              name: folder.name,
              level: parentId === null ? 0 : 1, // Simple level mapping
              nodeId: folder.folder_id.toString(), // For TreeView
              sub_classifications: children
            };
          });
          
        return nodes;
      };
      
      // Build tree starting from root folders
      const tree = buildTree(null);
      
      // Cache the tree
      await cacheMiddleware.set(cacheKey, tree);
      
      return { success: true, tree };
    } catch (error) {
      console.error('Error getting folder tree:', error);
      return { success: false, error: 'Failed to get folder tree' };
    } finally {
      connection.release();
    }
  },
  
  // Search folders
  searchFolders: async (userId: number, searchTerm: string) => {
    const connection = await pool.getConnection();
    
    try {
      // Search folders by name
      const [folders] = await connection.query(
        `SELECT * FROM folders 
         WHERE user_id = ? AND name LIKE ?
         ORDER BY name ASC`,
        [userId, `%${searchTerm}%`]
      );
      
      const folderList = folders.map(folder => ({
        id: folder.folder_id,
        name: folder.name,
        parent_folder_id: folder.parent_folder_id,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
        type: 'folder' // For frontend search results
      }));
      
      return { success: true, folders: folderList };
    } catch (error) {
      console.error('Error searching folders:', error);
      return { success: false, error: 'Failed to search folders' };
    } finally {
      connection.release();
    }
  }
};

export default folderController;