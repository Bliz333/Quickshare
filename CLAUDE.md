# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## QuickShare - File Sharing System

QuickShare is a Spring Boot-based file sharing and storage system that allows users to upload, organize, and share files with secure links. It supports both authenticated users and guests, with features like extraction codes, expiration times, and download limits.

## Common Development Commands

### Building and Running
```bash
# Build the project
mvn clean compile

# Run tests
mvn test

# Run the application (development)
mvn spring-boot:run

# Package for deployment
mvn clean package

# Run the packaged jar
java -jar target/quickshare-1.0.0.jar
```

### Database Setup
```bash
# Connect to MySQL (ensure MySQL is running on localhost:3306)
mysql -u root -p

# Create database (if not exists)
CREATE DATABASE quickshare;

# The application will auto-create tables using MyBatis Plus
```

### Redis Setup
```bash
# Start Redis server (required for caching and session management)
redis-server

# Verify Redis is running
redis-cli ping
```

## Project Architecture

### Technology Stack
- **Backend**: Spring Boot 3.2.0, Java 17
- **Database**: MySQL with MyBatis Plus 3.5.9
- **Cache**: Redis for session management
- **Authentication**: JWT tokens (24-hour expiration)
- **Email**: Spring Mail with Gmail SMTP
- **File Storage**: Local filesystem (configurable path)
- **Frontend**: Vanilla JavaScript with responsive design

### Core Components

#### API Structure
- All APIs use `/api` prefix
- Authentication endpoints: `/api/auth/*`
- File management: `/api/files/*`
- Folder operations: `/api/folders/*`
- Share operations: `/api/share`

#### Key Services
- `FileService`: Handles file uploads, downloads, organization
- `UserService`: User management, authentication with email verification
- `EmailService`: Sends verification codes and notifications
- `VerificationCodeService`: Manages email-based verification codes

#### Security Implementation
- JWT-based stateless authentication
- Password encryption using Spring Security Crypto
- reCAPTCHA integration for bot protection
- File access control through share links

#### File Management Features
- Maximum file size: 10GB
- Automatic image compression and thumbnail generation
- Folder-based organization system
- Share links with optional extraction codes
- Configurable expiration times and download limits

### Configuration

#### Application Properties (application.yml)
- Database connection to MySQL
- Redis configuration for caching
- File upload directory (default: `/Users/szhao/quickshare/uploads`)
- Gmail SMTP settings for email verification
- reCAPTCHA keys for security
- JWT secret and expiration settings

#### Important Configuration Classes
- `FileConfig`: File upload settings and paths
- `WebConfig`: CORS and web MVC configuration
- `AppConfig`: Application-level beans and settings

### Database Schema

#### Core Entities
- `User`: User accounts with email verification
- `FileInfo`: File metadata and organization
- `ShareLink`: Share configuration and access control

### Frontend Architecture
- Single-page application with multiple HTML views
- Module-based JavaScript architecture
- Responsive CSS with dark/light theme support
- Multi-language support (English/Chinese)
- Drag-and-drop file upload interface

### Development Notes

#### Email Verification
- Registration requires email verification
- Verification codes are 6 digits, 10-minute expiry
- Uses Redis for storing temporary codes

#### File Upload Process
1. Client generates unique file ID
2. File uploaded to configured upload directory
3. Metadata stored in database
4. Optional thumbnail generation for images
5. Share link generation with access controls

#### Authentication Flow
1. User registers with email
2. Email verification code sent
3. Upon verification, account activated
4. Login returns JWT token for API access

#### Testing
- Basic Spring Boot test class exists
- Add integration tests for file operations
- Test email service with mock SMTP
- Verify JWT token generation and validation