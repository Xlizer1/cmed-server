// src/routes/folderRoutes.ts
import { Elysia, t } from 'elysia';
import { folderController } from '../controllers/folderController';

// Mock user ID for demonstration (replace with actual auth in production)
const MOCK_USER_ID = 1;

export const folderRoutes = new Elysia({ prefix: '/api/folders' })
  // Create a folder
  .post('/', async ({ body, set }) => {
    const { name, parentFolderId } = body as { name: string; parentFolderId?: number };
    
    if (!name) {
      set.status = 400;
      return { success: false, error: 'Folder name is required' };
    }
    
    const result = await folderController.createFolder(
      MOCK_USER_ID,
      name,
      parentFolderId || null
    );
    
    if (!result.success) {
      set.status = 400;
      return result;
    }
    
    return result;
  }, {
    body: t.Object({
      name: t.String(),
      parentFolderId: t.Optional(t.Number())
    })
  })

  // Get folder details
  .get('/:folderId', async ({ params, set }) => {
    const folderId = params.folderId === 'root' ? null : parseInt(params.folderId);
    
    if (params.folderId !== 'root' && isNaN(folderId)) {
      set.status = 400;
      return { success: false, error: 'Invalid folder ID' };
    }
    
    if (folderId === null) {
      // Get the root folder
      const [rootFolder] = await folderController.getSubfolders(MOCK_USER_ID, null);
      
      if (!rootFolder.success || !rootFolder.subfolders || rootFolder.subfolders.length === 0) {
        set.status = 404;
        return { success: false, error: 'Root folder not found' };
      }
      
      return {
        success: true,
        folder: {
          id: rootFolder.subfolders[0].id,
          name: 'Root',
          parent_folder_id: null,
          created_at: rootFolder.subfolders[0].created_at,
          updated_at: rootFolder.subfolders[0].updated_at
        }
      };
    }
    
    const result = await folderController.getFolderDetails(MOCK_USER_ID, folderId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      folderId: t.String()
    })
  })

  // Get folder contents (files and subfolders)
  .get('/:folderId/contents', async ({ params, set }) => {
    const folderId = params.folderId === 'root' ? null : parseInt(params.folderId);
    
    if (params.folderId !== 'root' && isNaN(folderId)) {
      set.status = 400;
      return { success: false, error: 'Invalid folder ID' };
    }
    
    const result = await folderController.getFolderContents(MOCK_USER_ID, folderId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      folderId: t.String()
    })
  })

  // Delete a folder
  .delete('/:folderId', async ({ params, set }) => {
    const folderId = parseInt(params.folderId);
    
    if (isNaN(folderId)) {
      set.status = 400;
      return { success: false, error: 'Invalid folder ID' };
    }
    
    const result = await folderController.deleteFolder(MOCK_USER_ID, folderId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      folderId: t.String()
    })
  })

  // Rename a folder
  .patch('/:folderId/rename', async ({ params, body, set }) => {
    const folderId = parseInt(params.folderId);
    const { name } = body as { name: string };
    
    if (isNaN(folderId)) {
      set.status = 400;
      return { success: false, error: 'Invalid folder ID' };
    }
    
    if (!name) {
      set.status = 400;
      return { success: false, error: 'Folder name is required' };
    }
    
    const result = await folderController.renameFolder(MOCK_USER_ID, folderId, name);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      folderId: t.String()
    }),
    body: t.Object({
      name: t.String()
    })
  })

  // Move a folder
  .patch('/:folderId/move', async ({ params, body, set }) => {
    const folderId = parseInt(params.folderId);
    const { parentFolderId } = body as { parentFolderId: number | null };
    
    if (isNaN(folderId)) {
      set.status = 400;
      return { success: false, error: 'Invalid folder ID' };
    }
    
    const result = await folderController.moveFolder(MOCK_USER_ID, folderId, parentFolderId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      folderId: t.String()
    }),
    body: t.Object({
      parentFolderId: t.Union([t.Number(), t.Null()])
    })
  })

  // Get folder tree for sidebar
  .get('/tree', async () => {
    const result = await folderController.getFolderTree(MOCK_USER_ID);
    return result;
  })

  // Search folders
  .get('/search/:term', async ({ params }) => {
    const { term } = params;
    
    const result = await folderController.searchFolders(MOCK_USER_ID, term);
    
    return result;
  }, {
    params: t.Object({
      term: t.String()
    })
  });