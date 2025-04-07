# CMED Emporium Backend

This is the backend API for the CMED Emporium file management system. It's built with Bun, Elysia, and MySQL.

## Features

- File management API (upload, download, delete, search)
- Folder management API (create, delete, rename, move)
- File storage with organized directory structure
- Redis caching for improved performance
- Swagger API documentation
- MySQL database for metadata storage

## Prerequisites

- [Bun](https://bun.sh/) (latest version)
- MySQL or MariaDB server
- Redis server (optional, for caching)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/cmed-emporium-backend.git
   cd cmed-emporium-backend
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file (or copy `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in the `.env` file:
   ```
   # Server configuration
   PORT=3000

   # Database configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=cmed_emporium

   # Redis configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=

   # File storage configuration
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=104857600 # 100MB in bytes
   ```

5. Create the MySQL database:
   ```sql
   CREATE DATABASE cmed_emporium;
   ```

## Running the Server

Start the development server:

```bash
bun run dev
```

For production:

```bash
bun run start
```

The server will be running at `http://localhost:3000` by default. Swagger documentation is available at `http://localhost:3000/swagger`.

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── database.ts     # Database connection configuration
│   │   └── redis.ts        # Redis connection configuration
│   ├── controllers/
│   │   ├── fileController.ts    # File operations logic
│   │   └── folderController.ts  # Folder operations logic
│   ├── routes/
│   │   ├── fileRoutes.ts        # File API endpoints
│   │   └── folderRoutes.ts      # Folder API endpoints
│   ├── services/
│   │   └── fileStorage.ts       # File storage operations
│   ├── types/
│   │   └── fileTypes.ts         # Type definitions
│   ├── utils/
│   │   └── fileValidator.ts     # File validation utilities
│   └── index.ts                 # Main application entry point
├── uploads/                     # File storage directory
├── .env                         # Environment variables
├── .env.example                 # Example environment variables
├── package.json                 # Project dependencies
└── README.md                    # Project documentation
```

## API Endpoints

### File API

- `POST /api/files/upload` - Upload a single file
- `POST /api/files/upload/multiple` - Upload multiple files
- `GET /api/files/:fileId` - Get file details
- `GET /api/files/:fileId/download` - Download a file
- `DELETE /api/files/:fileId` - Delete a file
- `GET /api/files/search/:term` - Search files by name

### Folder API

- `POST /api/folders` - Create a new folder
- `GET /api/folders/:folderId` - Get folder details
- `GET /api/folders/:folderId/contents` - Get folder contents
- `DELETE /api/folders/:folderId` - Delete a folder
- `PATCH /api/folders/:folderId/rename` - Rename a folder
- `PATCH /api/folders/:folderId/move` - Move a folder
- `GET /api/folders/tree` - Get folder tree for sidebar
- `GET /api/folders/search/:term` - Search folders by name

## Authentication

**Note:** This implementation uses a mock user (ID 1) for demonstration purposes. In a production environment, you should implement proper authentication using JWT or another secure method.

## Supported File Types

The system supports the following file types:

- Document formats: txt, pdf, doc, docx, rtf
- Spreadsheet formats: xls, xlsx, csv
- Presentation formats: ppt, pptx
- Image formats: jpg, jpeg, png, gif, svg, bmp, webp
- Archive formats: zip, rar, 7z
- Other text formats: md, json, xml, html, css, js, ts

Video and audio files are not supported.

## License

[MIT](LICENSE)

## Credits

Built with:
- [Bun](https://bun.sh/)
- [Elysia](https://elysiajs.com/)
- [MySQL](https://www.mysql.com/)
- [Redis](https://redis.io/)# cmed-server
