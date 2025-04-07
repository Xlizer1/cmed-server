// src/routes/fileRoutes.ts
import { Elysia, t } from 'elysia';
import { fileController } from '../controllers/fileController';
import { UploadedFile } from '../types/fileTypes';

// Mock user ID for demonstration (replace with actual auth in production)
const MOCK_USER_ID = 1;

export const fileRoutes = new Elysia({ prefix: '/api/files' })
  // Upload a file
  .post('/upload', async ({ body, set }) => {
    const { file, folderId } = body as { file: UploadedFile; folderId?: number };
    
    if (!file) {
      set.status = 400;
      return { success: false, error: 'No file provided' };
    }
    
    const result = await fileController.uploadFile(
      MOCK_USER_ID,
      file,
      folderId || null
    );
    
    if (!result.success) {
      set.status = 400;
      return result;
    }
    
    return result;
  }, {
    body: t.Object({
      file: t.Any(),
      folderId: t.Optional(t.Number())
    })
  })

  // Upload multiple files
  .post('/upload/multiple', async ({ body, set }) => {
    const { files, folderId } = body as { files: UploadedFile[]; folderId?: number };
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      set.status = 400;
      return { success: false, error: 'No files provided' };
    }
    
    const result = await fileController.uploadMultipleFiles(
      MOCK_USER_ID,
      files,
      folderId || null
    );
    
    return result;
  }, {
    body: t.Object({
      files: t.Array(t.Any()),
      folderId: t.Optional(t.Number())
    })
  })

  // Download a file
  .get('/:fileId/download', async ({ params, set }) => {
    const fileId = parseInt(params.fileId);
    
    if (isNaN(fileId)) {
      set.status = 400;
      return { success: false, error: 'Invalid file ID' };
    }
    
    const result = await fileController.downloadFile(MOCK_USER_ID, fileId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    // Set content type and disposition headers
    set.headers['Content-Type'] = result.file.mime_type || 'application/octet-stream';
    set.headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(result.file.name)}"`;
    
    return result.file.data;
  }, {
    params: t.Object({
      fileId: t.String()
    })
  })

  // Get file details
  .get('/:fileId', async ({ params, set }) => {
    const fileId = parseInt(params.fileId);
    
    if (isNaN(fileId)) {
      set.status = 400;
      return { success: false, error: 'Invalid file ID' };
    }
    
    const result = await fileController.getFileDetails(MOCK_USER_ID, fileId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      fileId: t.String()
    })
  })

  // Delete a file
  .delete('/:fileId', async ({ params, set }) => {
    const fileId = parseInt(params.fileId);
    
    if (isNaN(fileId)) {
      set.status = 400;
      return { success: false, error: 'Invalid file ID' };
    }
    
    const result = await fileController.deleteFile(MOCK_USER_ID, fileId);
    
    if (!result.success) {
      set.status = 404;
      return result;
    }
    
    return result;
  }, {
    params: t.Object({
      fileId: t.String()
    })
  })

  // Search files
  .get('/search/:term', async ({ params }) => {
    const { term } = params;
    
    const result = await fileController.searchFiles(MOCK_USER_ID, term);
    
    return result;
  }, {
    params: t.Object({
      term: t.String()
    })
  });