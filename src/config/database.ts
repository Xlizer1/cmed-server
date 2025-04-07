import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cmedDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
};

// Initialize database tables
export const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        storage_quota BIGINT DEFAULT 1073741824,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create folders table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS folders (
        folder_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        parent_folder_id INT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (parent_folder_id) REFERENCES folders(folder_id) ON DELETE CASCADE,
        UNIQUE KEY unique_folder (user_id, parent_folder_id, name)
      )
    `);
    
    // Create files table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS files (
        file_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        folder_id INT,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        mime_type VARCHAR(127),
        size BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(folder_id) ON DELETE CASCADE,
        UNIQUE KEY unique_file (folder_id, name, user_id)
      )
    `);
    
    // Create a default user if not exists
    await connection.query(`
      INSERT IGNORE INTO users (username, password_hash, email)
      VALUES ('admin', '$2a$10$1qAz2wSx3eDc4rFv5tGb5eT3TEwmq6BEyh6AyUmbvVqrhZJMYzH6.', 'admin@example.com')
    `);
    
    // Create a root folder for the default user
    await connection.query(`
      INSERT IGNORE INTO folders (user_id, parent_folder_id, name)
      SELECT user_id, NULL, 'Root'
      FROM users
      WHERE username = 'admin'
    `);
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default pool;