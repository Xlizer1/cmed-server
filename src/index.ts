// src/index.ts
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { fileRoutes } from './routes/fileRoutes';
import { folderRoutes } from './routes/folderRoutes';
import { testConnection, initDatabase } from './config/database';
import { testRedisConnection } from './config/redis';
import { initializeStorage } from './services/fileStorage';

// Server configuration
const PORT = process.env.PORT || 5000;

// Initialize server
const app = new Elysia()
  // Add swagger documentation
  .use(swagger({
    documentation: {
      info: {
        title: 'CMED Emporium API',
        version: '1.0.0',
        description: 'API for the CMED Emporium file management system'
      },
      tags: [
        { name: 'files', description: 'File operations' },
        { name: 'folders', description: 'Folder operations' }
      ]
    }
  }))
  // CORS middleware
  .onRequest(({ request, set }) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      set.status = 204;
      return '';
    }
    
    // Set CORS headers for all other requests
    set.headers['Access-Control-Allow-Origin'] = '*';
  })
  // Error handling middleware
  .onError(({ code, error, set }) => {
    console.error(`Error: ${code}`, error);
    
    set.status = code === 'NOT_FOUND' ? 404 : 500;
    
    return {
      success: false,
      error: error.message || 'Server error',
      code
    };
  })
  // Health check endpoint
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))
  // API routes
  .use(fileRoutes)
  .use(folderRoutes)
  // Default 404 route
  .all('*', ({ set }) => {
    set.status = 404;
    return { success: false, error: 'Endpoint not found' };
  });

// Startup function
const startup = async () => {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }
  
  // Initialize database tables
  try {
    await initDatabase();
  } catch (error) {
    console.error('Failed to initialize database schema. Exiting...');
    process.exit(1);
  }
  
  // Test Redis connection
  const redisConnected = await testRedisConnection();
  if (!redisConnected) {
    console.warn('Warning: Redis connection failed. Continuing without caching...');
  }
  
  // Initialize file storage
  const storageInitialized = await initializeStorage();
  if (!storageInitialized) {
    console.error('Failed to initialize file storage. Exiting...');
    process.exit(1);
  }
  
  // Start server
  app.listen(3002, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`📚 Swagger documentation: http://localhost:${PORT}/swagger`);
  });
};

// Start the server
startup().catch(error => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

// Export app for testing
export default app;