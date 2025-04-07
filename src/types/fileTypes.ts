// src/types/fileTypes.ts

// Interface for uploaded files
export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }
  
  // Interface for file metadata
  export interface FileMetadata {
    id: number;
    name: string;
    size: number;
    mime_type: string;
    folder_id: number | null;
    created_at: Date;
    updated_at: Date;
    file_name?: string; // For frontend compatibility
  }
  
  // Interface for folder structure
  export interface Folder {
    id: number;
    name: string;
    parent_folder_id: number | null;
    created_at: Date;
    updated_at: Date;
    level?: number; // For frontend TreeView
    nodeId?: string; // For frontend TreeView
    sub_classifications?: any[]; // For frontend compatibility
    type?: string; // For search results
  }
  
  // Allowed file types
  export const ALLOWED_FILE_EXTENSIONS = [
    // Document formats
    'txt', 'pdf', 'doc', 'docx', 'rtf',
    
    // Spreadsheet formats
    'xls', 'xlsx', 'csv',
    
    // Presentation formats
    'ppt', 'pptx',
    
    // Image formats
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'webp',
    
    // Archive formats
    'zip', 'rar', '7z',
    
    // Other text formats
    'md', 'json', 'xml', 'html', 'css', 'js', 'ts',
  ];
  
  // Disallowed MIME types
  export const DISALLOWED_MIME_TYPES = [
    'video/',
    'audio/'
  ];
  
  // Maximum file size (100MB)
  export const MAX_FILE_SIZE = 100 * 1024 * 1024;
  
  // File validation utility
  export const validateFile = (file: UploadedFile): { isValid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      };
    }
    
    // Check file type by extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      return {
        isValid: false,
        error: `File type not allowed. Allowed extensions: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`
      };
    }
    
    // Check MIME type
    for (const disallowedType of DISALLOWED_MIME_TYPES) {
      if (file.type.startsWith(disallowedType)) {
        return {
          isValid: false,
          error: `File content type not allowed.`
        };
      }
    }
    
    return { isValid: true };
  };