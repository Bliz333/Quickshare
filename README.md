# QuickShare

<div align="center">

![QuickShare Logo](https://img.shields.io/badge/QuickShare-File%20Sharing-blue?style=for-the-badge&logo=share)

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://www.oracle.com/java/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()

*A modern file sharing and storage system built with Spring Boot*

</div>

> 项目当前状态、已知问题与近期路线请参阅 `docs/STATUS.md`（2026-03-18 更新）。

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Detailed Installation](#detailed-installation)
  - [Database Setup](#database-setup)
  - [Redis Setup](#redis-setup)
  - [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Usage Examples](#usage-examples)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [Configuration Details](#configuration-details)
- [Security Features](#security-features)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- 🚀 **High Performance**: Support for files up to 10GB with efficient chunked uploads
- 📁 **Smart Organization**: Folder-based file management with parent-child relationships
- 🔐 **Secure Sharing**: Share links with optional extraction codes and expiration times
- 👥 **User Management**: JWT authentication with email verification
- 🌐 **Guest Access**: Allow file uploads without registration
- 🎨 **Modern UI**: Dark/light themes with smooth transitions
- 🌍 **Multi-language**: English and Chinese language support
- 📱 **Responsive Design**: Mobile-friendly interface
- 🖼️ **Image Processing**: Automatic compression and thumbnail generation
- 🔒 **Security**: reCAPTCHA protection and file access control
- 📊 **Analytics**: Download tracking and usage statistics
- 🔄 **Real-time Updates**: Live progress tracking for uploads/downloads

## Technology Stack

### Backend
- **Spring Boot 3.2.0** (Java 17) - Main framework
- **MyBatis Plus 3.5.9** - Database ORM
- **MySQL 8.0** - Primary database
- **Redis 6.0+** - Caching and session management
- **JWT** - Stateless authentication
- **Spring Mail** - Email service (Gmail SMTP)
- **Spring Security Crypto** - Password encryption
- **Thumbnailator 0.4.20** - Image processing

### Frontend
- **Vanilla JavaScript (ES6+)** - No framework dependencies
- **HTML5/CSS3** - Modern web standards
- **CSS Custom Properties** - Dynamic theming
- **Font Awesome 6** - Icon library
- **QRCode.js** - QR code generation
- **Google Fonts (Outfit)** - Typography

### Development Tools
- **Maven 3.6+** - Build and dependency management
- **Hutool 5.8.33** - Java utility library
- **Google reCAPTCHA** - Bot protection

## Prerequisites

Ensure you have the following installed:

- **Java 17+** ([Download](https://adoptium.net/))
- **Maven 3.6+** ([Download](https://maven.apache.org/download.cgi))
- **MySQL 8.0+** ([Download](https://dev.mysql.com/downloads/mysql/))
- **Redis 6.0+** ([Download](https://redis.io/download))
- **LibreOffice / soffice** (optional, but required for stable Office preview)
- **Git** ([Download](https://git-scm.com/))

## Quick Start

Get QuickShare running in minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/quickshare.git
cd quickshare

# 2. Configure database
mysql -u root -p
CREATE DATABASE quickshare;
EXIT;

# 3. Configure credentials via environment variables (preferred) or copy
#    src/main/resources/application-local.example.yml to application-local.yml
#    and fill in DB/Redis/JWT/Mail settings
#
#    If you want Word/Excel/PPT preview, also ensure LibreOffice is installed
#    and OFFICE_PREVIEW_COMMAND points to a working soffice binary

# 4. Run the application
mvn spring-boot:run

# 5. Access the application
# Open your browser and go to: http://localhost:8080
```

## Docker Deployment

For server-side testing with Docker Compose:

```bash
# 1. Prepare environment variables
cp .env.example .env

# 2. Adjust at least DB/JWT/CORS settings in .env

# 3. Build and start the stack
docker compose up --build -d

# 4. Check application logs
docker compose logs -f app

# 5. Stop the stack
docker compose down
```

Notes:

- `compose.yaml` starts three services: `app`, `mysql`, and `redis`.
- The MySQL schema is initialized from `docker/mysql/init/001-schema.sql` on first startup.
- Uploaded files are persisted in the `quickshare-uploads` volume.
- `RECAPTCHA_ENABLED=false` by default in `.env.example` so the stack can be tested without Google reCAPTCHA keys.
- If `MAIL_*` is left empty, the application still starts, but email verification flows will fail when invoked.
- Office preview requires a working `soffice` binary. Set `OFFICE_PREVIEW_COMMAND` if LibreOffice is not on `PATH`.
- The default `.env.example` also bootstraps an `ADMIN` account on first startup: `admin / ChangeMeAdmin123!`.
- For public deployment, replace `CORS_ALLOWED_ORIGINS=*` and `JWT_SECRET` with real values.
- Before exposing the service publicly, change `BOOTSTRAP_ADMIN_PASSWORD`, or disable bootstrap after the first admin account is created.

## Detailed Installation

### Database Setup

#### MySQL Configuration

```bash
# Connect to MySQL as root
mysql -u root -p

# Create database and user
CREATE DATABASE quickshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'quickshare'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON quickshare.* TO 'quickshare'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Database Schema

The application does not auto-create MySQL tables. Import the schema manually or use the bundled initialization script at `docker/mysql/init/001-schema.sql`. Key entities:

- `user` - User accounts and authentication
- `file_info` - File metadata and organization
- `share_link` - Share configuration and access control

### Redis Setup

#### macOS (using Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

#### Ubuntu/Debian

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
```

### Configuration

Create `application.yml` in `src/main/resources/`:

```yaml
server:
  port: 8080
  servlet:
    context-path: /
    multipart:
      max-file-size: 10GB
      max-request-size: 10GB

spring:
  application:
    name: quickshare

  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/quickshare?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: quickshare
    password: your_password

  redis:
    host: localhost
    port: 6379
    database: 0
    timeout: 2000ms

  mail:
    host: smtp.gmail.com
    port: 587
    username: your-gmail@gmail.com
    password: your-app-password
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true

# JWT Configuration
jwt:
  secret: your-secret-key-here
  expiration: 86400000 # 24 hours in milliseconds

# File Upload Configuration
file:
  upload:
    path: /Users/your-username/quickshare/uploads
    max-size: 10737418240 # 10GB in bytes

# reCAPTCHA Configuration
recaptcha:
  secret: your-recaptcha-secret
  site-key: your-recaptcha-site-key
```

### Email Service Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. Use the app password in the `application.yml`

### reCAPTCHA Setup

1. Register your site at [Google reCAPTCHA](https://www.google.com/recaptcha/admin/create)
2. Choose "reCAPTCHA v2" and "I'm not a robot" Checkbox
3. Add your domain (localhost for development)
4. Use the provided site key and secret in your configuration

## API Documentation

### Authentication Endpoints

#### Send Verification Code

```http
POST /api/auth/send-code
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "code": 200,
  "message": "Verification code sent successfully"
}
```

#### User Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securePassword123",
  "email": "user@example.com",
  "nickname": "John Doe",
  "code": "123456"
}

Response:
{
  "code": 200,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "user@example.com",
      "nickname": "John Doe"
    }
  }
}
```

#### User Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securePassword123"
}

Response:
{
  "code": 200,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "username": "john_doe",
      "nickname": "John Doe"
    }
  }
}
```

### File Operations

#### Upload File (with authentication)

```http
POST /api/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

FormData:
- file: [file content]
- folderId: 0 (optional, for folder organization)

Response:
{
  "code": 200,
  "message": "File uploaded successfully",
  "data": {
    "id": 123,
    "fileName": "unique-generated-filename.ext",
    "originalName": "My Document.pdf",
    "fileSize": 2048576,
    "uploadTime": "2024-01-15T10:30:00Z"
  }
}
```

#### Upload File (guest access)

```http
POST /api/upload-guest
Content-Type: multipart/form-data

FormData:
- file: [file content]

Response:
{
  "code": 200,
  "message": "File uploaded successfully",
  "data": {
    "shareCode": "abc123def456",
    "extractCode": "789012"
  }
}
```

#### Get User Files

```http
GET /api/files
Authorization: Bearer {token}
Query Parameters:
- folderId: 0 (default root folder)
- page: 1 (default)
- size: 20 (default)

Response:
{
  "code": 200,
  "message": "Success",
  "data": {
    "total": 45,
    "files": [
      {
        "id": 123,
        "fileName": "document.pdf",
        "originalName": "My Document.pdf",
        "fileSize": 2048576,
        "fileType": "pdf",
        "uploadTime": "2024-01-15T10:30:00Z",
        "isFolder": 0
      }
    ]
  }
}
```

#### Create Folder

```http
POST /api/folder
Authorization: Bearer {token}
Content-Type: application/json

{
  "folderName": "My Documents",
  "parentId": 0
}

Response:
{
  "code": 200,
  "message": "Folder created successfully",
  "data": {
    "id": 456,
    "folderName": "My Documents",
    "parentId": 0,
    "createTime": "2024-01-15T11:00:00Z"
  }
}
```

### Share Operations

#### Create Share Link

```http
POST /api/share
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileId": 123,
  "extractCode": "secret123",
  "expireTime": "2024-02-15T00:00:00Z",
  "maxDownload": 10
}

Response:
{
  "code": 200,
  "message": "Share link created",
  "data": {
    "shareCode": "abc123def456",
    "shareUrl": "http://localhost:8080/share/abc123def456"
  }
}
```

#### Access Shared File

```http
GET /api/share/{shareCode}
Query Parameters:
- extractCode: secret123 (if required)

Response:
{
  "code": 200,
  "message": "Success",
  "data": {
    "fileName": "document.pdf",
    "originalName": "My Document.pdf",
    "fileSize": 2048576,
    "downloadUrl": "/api/download/abc123def456"
  }
}
```

## Usage Examples

### File Upload via JavaScript

```javascript
// Using FormData for file upload
const uploadFile = async (file, token) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();
  if (result.code === 200) {
    console.log('File uploaded:', result.data);
  }
};

// Usage
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const token = 'your-jwt-token';
uploadFile(file, token);
```

### Creating Share Link

```javascript
const createShareLink = async (fileId, options, token) => {
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fileId: fileId,
      extractCode: options.extractCode,
      expireTime: options.expireTime,
      maxDownload: options.maxDownload
    })
  });

  const result = await response.json();
  return result.data;
};

// Example usage
createShareLink(123, {
  extractCode: 'secret123',
  expireTime: '2024-12-31T23:59:59Z',
  maxDownload: 5
}, token).then(share => {
  console.log('Share URL:', share.shareUrl);
});
```

### User Authentication Flow

```javascript
// Login
const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const result = await response.json();
  if (result.code === 200) {
    // Store token for future requests
    localStorage.setItem('jwtToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    return result.data;
  }
  throw new Error(result.message);
};

// Use token in subsequent requests
const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('jwtToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};
```

## Project Structure

```
quickshare/
├── src/main/java/com/finalpre/quickshare/
│   ├── QuickshareApplication.java     # Main application class
│   ├── config/                         # Configuration classes
│   │   ├── FileConfig.java            # File upload settings
│   │   ├── WebConfig.java             # Web MVC configuration
│   │   └── AppConfig.java            # Application beans
│   ├── controller/                     # REST API controllers
│   │   ├── AuthController.java       # Authentication endpoints
│   │   └── FileController.java        # File operations
│   ├── dto/                           # Data Transfer Objects
│   │   ├── UserDto.java               # User data transfer
│   │   ├── FileDto.java               # File data transfer
│   │   └── ShareDto.java              # Share data transfer
│   ├── entity/                        # Database entities
│   │   ├── User.java                  # User entity
│   │   ├── FileInfo.java              # File information entity
│   │   └── ShareLink.java             # Share link entity
│   ├── mapper/                        # MyBatis mappers
│   │   ├── UserMapper.java            # User database operations
│   │   ├── FileInfoMapper.java        # File database operations
│   │   └── ShareLinkMapper.java       # Share database operations
│   ├── service/                       # Business logic services
│   │   ├── UserService.java          # User service interface
│   │   ├── FileService.java           # File service interface
│   │   ├── EmailService.java          # Email service interface
│   │   └── VerificationCodeService.java # Verification service
│   ├── service/impl/                  # Service implementations
│   │   ├── UserServiceImpl.java      # User service implementation
│   │   ├── FileServiceImpl.java      # File service implementation
│   │   ├── EmailServiceImpl.java      # Email service implementation
│   │   └── VerificationCodeServiceImpl.java # Verification implementation
│   ├── utils/                         # Utility classes
│   │   ├── JwtUtil.java               # JWT token utilities
│   │   ├── FileUtil.java              # File operation utilities
│   │   ├── MD5Util.java               # MD5 hash utilities
│   │   └── DateUtil.java              # Date utilities
│   ├── vo/                           # Value Objects
│   │   ├── Result.java                # API response wrapper
│   │   ├── UserVo.java                # User view object
│   │   └── FileVo.java                # File view object
│   └── common/                        # Common classes
│       ├── Constants.java             # Application constants
│       └── Exception.java             # Custom exceptions
├── src/main/resources/
│   ├── static/                       # Frontend assets
│   │   ├── css/                      # Stylesheets (embedded in HTML)
│   │   ├── js/                       # JavaScript modules
│   │   ├── images/                   # Static images
│   │   ├── fonts/                    # Font files
│   │   ├── index.html                # Main upload page
│   │   ├── login.html                # User login page
│   │   ├── register.html             # User registration page
│   │   ├── netdisk.html              # File management page
│   │   ├── drive.html                # File drive page
│   │   └── test.html                 # Development test page
│   ├── templates/                    # Template files
│   ├── application.yml               # Main configuration
│   └── application-dev.yml           # Development configuration
├── src/test/                         # Test classes
│   └── java/com/finalpre/quickshare/
│       └── QuickshareApplicationTests.java
├── uploads/                          # File upload directory
├── pom.xml                           # Maven configuration
└── README.md                         # This file
```

### Database Schema

```
User Table (user)
├── id (BIGINT, Primary Key)
├── username (VARCHAR, Unique)
├── password (VARCHAR, Encrypted)
├── email (VARCHAR, Unique)
├── nickname (VARCHAR)
├── create_time (TIMESTAMP)
└── deleted (TINYINT, Logical delete flag)

FileInfo Table (file_info)
├── id (BIGINT, Primary Key)
├── user_id (BIGINT, Foreign Key)
├── file_name (VARCHAR, Unique system name)
├── original_name (VARCHAR)
├── file_path (VARCHAR)
├── file_size (BIGINT)
├── file_type (VARCHAR)
├── md5 (VARCHAR, For deduplication)
├── upload_time (TIMESTAMP)
├── is_folder (TINYINT)
├── parent_id (BIGINT, For folder hierarchy)
└── deleted (TINYINT)

ShareLink Table (share_link)
├── id (BIGINT, Primary Key)
├── file_id (BIGINT, Foreign Key)
├── share_code (VARCHAR, Unique)
├── extract_code (VARCHAR, Optional)
├── expire_time (TIMESTAMP, Optional)
├── download_count (INT)
├── max_download (INT, Optional)
├── status (TINYINT)
└── create_time (TIMESTAMP)
```

## Development Guide

### Build and Test Commands

```bash
# Clean and compile the project
mvn clean compile

# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=QuickshareApplicationTests

# Generate test coverage report
mvn jacoco:report

# Check for dependency updates
mvn versions:display-dependency-updates

# Build the project
mvn clean build

# Package for deployment
mvn clean package

# Skip tests during packaging
mvn clean package -DskipTests

# Run the application in development mode
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Run with specific profile
mvn spring-boot:run -Dspring-boot.run.profiles=production

# Debug the application
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"

# Generate project documentation
mvn javadoc:javadoc
```

### Development Setup

1. **IDE Configuration**
   - Import as Maven project
   - Set Java 17 as project SDK
   - Enable annotation processing
   - Configure code style (Google Java Style)

2. **Database Development**
   ```bash
   # Reset database for development
   mysql -u quickshare -p quickshare < scripts/reset_db.sql
   ```

3. **Hot Reload Configuration**
   Add to `application-dev.yml`:
   ```yaml
   spring:
     devtools:
       restart:
         enabled: true
         additional-paths: src/main/resources/static
       livereload:
         enabled: true
   ```

### Debug Configuration

Create `.vscode/launch.json` for VS Code debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "Debug QuickShare",
      "request": "launch",
      "mainClass": "com.finalpre.quickshare.QuickshareApplication",
      "projectName": "quickshare",
      "args": "",
      "vmArgs": "-Dspring.profiles.active=dev"
    }
  ]
}
```

## Configuration Details

### File Upload Settings

```yaml
file:
  upload:
    # Upload directory (absolute path)
    path: /var/data/quickshare/uploads

    # Maximum file size in bytes (10GB)
    max-size: 10737418240

    # Allowed file types (empty = all allowed)
    allowed-types:
      - jpg
      - jpeg
      - png
      - gif
      - pdf
      - doc
      - docx
      - xls
      - xlsx
      - zip
      - rar

    # Generate thumbnails for images
    generate-thumbnails: true

    # Thumbnail size in pixels
    thumbnail-size: 200
```

### JWT Configuration

```yaml
jwt:
  # Secret key for JWT signing (minimum 256 bits)
  secret: your-256-bit-secret-key-here

  # Token expiration in milliseconds (24 hours)
  expiration: 86400000

  # Refresh token expiration (7 days)
  refresh-expiration: 604800000

  # Token issuer
  issuer: QuickShare

  # Algorithm for signing
  algorithm: HS256
```

### Email Service Configuration

```yaml
spring:
  mail:
    # SMTP server configuration
    host: smtp.gmail.com
    port: 587
    protocol: smtp

    # Authentication
    username: your-email@gmail.com
    password: your-app-password

    # Additional properties
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
          timeout: 25000
          connectiontimeout: 25000
          writetimeout: 25000

    # Verification email settings
    verification:
      subject: "QuickShare - Email Verification"
      template: "Your verification code is: {code}"
      expiry-minutes: 10
```

### Database Connection Pool

```yaml
spring:
  datasource:
    # HikariCP settings
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000
      max-lifetime: 1200000
      connection-timeout: 20000
      leak-detection-threshold: 60000

    # JPA settings (if using JPA)
    jpa:
      hibernate:
        ddl-auto: validate
      show-sql: false
      properties:
        hibernate:
          format_sql: true
          use_sql_comments: true
          jdbc:
            batch_size: 20
            order_inserts: true
            order_updates: true
```

### Redis Cache Configuration

```yaml
spring:
  redis:
    # Connection settings
    host: localhost
    port: 6379
    password:
    database: 0
    timeout: 2000ms
    ssl: false

    # Lettuce connection pool
    lettuce:
      pool:
        max-active: 20
        max-idle: 8
        min-idle: 0
        max-wait: -1ms

    # Cache settings
    cache:
      type: redis
      redis:
        time-to-live: 3600000  # 1 hour
        cache-null-values: false
```

## Security Features

### Authentication Flow

1. **User Registration**
   - User submits registration form with email
   - System sends 6-digit verification code
   - User enters verification code
   - Account created upon successful verification
   - Password encrypted using BCrypt

2. **User Login**
   - User provides credentials
   - System validates against database
   - JWT token generated and returned
   - Token stored client-side for subsequent requests

3. **JWT Token Structure**
   ```json
   {
     "header": {
       "alg": "HS256",
       "typ": "JWT"
     },
     "payload": {
       "sub": "1234567890",
       "username": "john_doe",
       "roles": ["USER"],
       "iat": 1516239022,
       "exp": 1516325422
     }
   }
   ```

### File Access Control

- **Ownership**: Users can only access their own files
- **Share Links**: Files accessible through unique share codes
- **Extraction Codes**: Optional password protection for shared files
- **Expiration**: Share links can have expiration dates
- **Download Limits**: Control maximum downloads per share link

### Input Validation

- **File Type Validation**: Whitelist of allowed file extensions
- **File Size Limits**: 10GB maximum per file
- **Path Traversal Prevention**: Validation of file paths
- **XSS Protection**: Input sanitization for all user inputs
- **SQL Injection Prevention**: Use of parameterized queries

### CSRF Protection

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .ignoringRequestMatchers("/api/upload-guest")
            )
            // ... other security configurations
    }
}
```

### Password Security

- **Encryption**: BCrypt with strength 10
- **Password Policy**: Minimum 8 characters, requires letters and numbers
- **Salt**: Unique salt per password
- **Hash Iterations**: Configurable iteration count

## Contributing

We welcome contributions to QuickShare! Please follow these guidelines:

### Code Style Guidelines

- Follow [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- Use meaningful variable and method names
- Add Javadoc comments for public methods
- Keep methods small and focused
- Use proper exception handling

### Pull Request Process

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/quickshare.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Add tests for new features
   - Ensure all tests pass
   - Update documentation

4. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```

5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Create a Pull Request**
   - Provide a clear description
   - Link to related issues
   - Include screenshots if applicable

### Issue Reporting

When reporting bugs, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce the bug
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Java version, browser version
- **Logs**: Relevant error logs

### Development Setup for Contributors

1. **Set up development environment**
   ```bash
   # Clone your fork
   git clone https://github.com/yourusername/quickshare.git
   cd quickshare

   # Add upstream remote
   git remote add upstream https://github.com/original/quickshare.git

   # Install dependencies
   mvn clean install
   ```

2. **Run tests**
   ```bash
   # Run all tests
   mvn test

   # Run with coverage
   mvn jacoco:report

   # View coverage report
   open target/site/jacoco/index.html
   ```

3. **Code formatting**
   ```bash
   # Format code with Google style
   mvn com.coveo:fmt-maven-plugin:format
   ```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 QuickShare

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Acknowledgments

We would like to thank the following projects and communities:

- **Spring Team** - For the excellent Spring Boot framework
- **MyBatis Team** - For the powerful MyBatis Plus ORM
- **Hutool** - For the comprehensive Java utility library
- **Font Awesome** - For the beautiful icon set
- **Google reCAPTCHA** - For bot protection
- **MySQL** - For the reliable database system
- **Redis** - For the high-performance caching solution
- **Thumbnailator** - For the image processing library

### Special Thanks

- All contributors who have helped improve QuickShare
- The open-source community for inspiration and support
- Users who provide valuable feedback and bug reports

---

<div align="center">

**Made with ❤️ by the QuickShare Team**

[Website](https://yourwebsite.com) • [Documentation](https://docs.yourwebsite.com) • [API Reference](https://api.yourwebsite.com) • [Support](mailto:support@yourwebsite.com)

</div>
