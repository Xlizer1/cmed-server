// src/utils/fileValidator.ts
import { UploadedFile, ALLOWED_FILE_EXTENSIONS, DISALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../types/fileTypes';

/**
 * Validate a file upload request
 * @param file The file to validate
 * @returns Validation result with isValid flag and error message
 */
export const validateFileUpload = (file: UploadedFile): { isValid: boolean; error?: string } => {
  // Check if file exists
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }
  
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

/**
 * Validate batch of files
 * @param files Array of files to validate
 * @returns Object with valid files array and invalid files with errors
 */
export const validateFiles = (files: UploadedFile[]): {
  validFiles: UploadedFile[];
  invalidFiles: { file: UploadedFile; error: string }[];
} => {
  const validFiles: UploadedFile[] = [];
  const invalidFiles: { file: UploadedFile; error: string }[] = [];
  
  for (const file of files) {
    const result = validateFileUpload(file);
    
    if (result.isValid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, error: result.error || 'Invalid file' });
    }
  }
  
  return { validFiles, invalidFiles };
};

/**
 * Check if a string is a valid folder name
 * @param name Folder name to validate
 * @returns Validation result with isValid flag and error message
 */
export const validateFolderName = (name: string): { isValid: boolean; error?: string } => {
  // Check if name exists
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Folder name cannot be empty' };
  }
  
  // Check length
  if (name.length > 255) {
    return { isValid: false, error: 'Folder name cannot exceed 255 characters' };
  }
  
  // Check for invalid characters
  const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
  for (const char of invalidChars) {
    if (name.includes(char)) {
      return { 
        isValid: false, 
        error: `Folder name contains invalid character: ${char}` 
      };
    }
  }
  
  return { isValid: true };
};