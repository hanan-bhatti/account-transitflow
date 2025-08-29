# TransitFLOW Frontend Application

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-org/transitflow-frontend)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.21.2-blue.svg)](https://expressjs.com/)

A modern, enterprise-grade frontend application for TransitFLOW, featuring comprehensive user authentication, social login integration, and a sophisticated dashboard management system. Built with vanilla JavaScript and Express.js, this application provides a seamless user experience with advanced security features and responsive design.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [CI/CD](#cicd)
- [Contributing Guidelines](#contributing-guidelines)
- [License](#license)

## 🎯 Project Overview

TransitFLOW Frontend is a comprehensive web application that serves as the primary interface for TransitFLOW's user management and authentication system. The application provides:

- **Multi-Factor Authentication (2FA)** with backup codes and device verification
- **Social Authentication** integration with Google, Facebook, and GitHub
- **Comprehensive Dashboard** with user profile management, security settings, and analytics
- **Advanced Security Features** including session management, device tracking, and audit logging
- **Responsive Design** optimized for desktop and mobile devices
- **Theme Management** with light/dark mode support

### Key Features

- **Authentication System**: Login, registration, password reset, and email verification
- **Social Login**: OAuth 2.0 integration with major providers
- **Dashboard Management**: User profiles, security settings, notifications, and analytics
- **Security Controls**: 2FA, device management, session monitoring, and audit trails
- **Admin Panel**: User management and system administration capabilities
- **Responsive UI**: Mobile-first design with modern CSS and JavaScript

## 🏗️ Architecture

The application follows a modular, service-oriented architecture designed for maintainability and scalability.

### Directory Structure

```
transitflow-frontend/
├── public/                          # Static assets and client-side code
│   ├── css/                        # Stylesheets
│   │   ├── styles.css             # Main authentication styles
│   │   ├── dash.css               # Dashboard styles
│   │   ├── loader.css             # Loading animations
│   │   ├── toaststyles.css        # Toast notifications
│   │   ├── all.min.css            # Font Awesome icons
│   │   └── boxicons.min.css       # Boxicons
│   ├── js/                        # JavaScript modules
│   │   ├── auth/                  # Authentication system
│   │   │   ├── core/              # Core authentication logic
│   │   │   ├── events/            # Event management
│   │   │   ├── forms/             # Form handling
│   │   │   ├── init/              # Application initialization
│   │   │   ├── network/           # Network communication
│   │   │   ├── routing/           # Client-side routing
│   │   │   ├── services/          # Business logic services
│   │   │   ├── ui/                # User interface management
│   │   │   └── validation/        # Form validation
│   │   └── Dashboard/             # Dashboard functionality
│   │       ├── core/              # Core dashboard logic
│   │       └── Managers/          # Feature-specific managers
│   ├── fonts/                     # Custom fonts
│   ├── webfonts/                  # Web fonts
│   └── *.html                     # HTML pages
├── server.js                      # Express.js server
├── package.json                   # Dependencies and scripts
├── railway.toml                   # Railway deployment configuration
└── README.md                      # This file
```

### Design Decisions

- **Vanilla JavaScript**: No framework dependencies for maximum performance and control
- **Modular Architecture**: Separation of concerns with dedicated managers for each feature
- **Service-Oriented**: Business logic separated from UI components
- **Event-Driven**: Centralized event management for loose coupling
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox

### Core Components

#### Authentication System (`/js/auth/`)
- **AuthManager**: Core authentication logic and state management
- **SocialAuthManager**: OAuth 2.0 integration with social providers
- **FormHandler**: Form submission and validation
- **NetworkManager**: API communication and error handling
- **UIManager**: User interface state and interactions

#### Dashboard System (`/js/Dashboard/`)
- **DashboardManager**: Main dashboard coordination
- **UserManager**: User profile and settings management
- **SecurityManager**: Security features and 2FA
- **AnalyticsManager**: Data visualization and reporting
- **AdminManager**: Administrative functions

## 🛠️ Tech Stack

### Frontend Technologies
- **HTML5**: Semantic markup and accessibility
- **CSS3**: Modern styling with CSS Grid, Flexbox, and custom properties
- **Vanilla JavaScript (ES6+)**: Modern JavaScript without framework dependencies
- **Font Awesome**: Icon library for UI elements
- **Boxicons**: Additional icon set for enhanced UI

### Backend Technologies
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **ES Modules**: Modern JavaScript module system

### Development Tools
- **Git**: Version control system
- **npm**: Package management
- **Railway**: Deployment platform

### Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Progressive Web App**: Service worker support for offline functionality

## 🚀 Setup Instructions

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (included with Node.js)
- **Git**: Version 2.30.0 or higher

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/transitflow-frontend.git
   cd transitflow-frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the environment variables
   nano .env
   ```

4. **Start Development Server**
   ```bash
   npm start
   ```

5. **Access the Application**
   - **Main Application**: http://localhost:3000
   - **Authentication**: http://localhost:3000/login
   - **Dashboard**: http://localhost:3000/account

### Development Scripts

```bash
# Start the development server
npm start

# Start with nodemon for development (if installed)
npm run dev

# Build for production (if applicable)
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure Setup

The application automatically serves static files from the `public/` directory and handles routing for:
- Authentication pages (`/login`, `/register`, `/2fa`, etc.)
- Dashboard (`/account/*`)
- Static pages (`/privacy-terms`, `/confirm-deletion`, etc.)

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# API Configuration
API_BASE_URL=https://api-auth.transitflow.qzz.io
API_TIMEOUT=30000

# Social Authentication
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_CLIENT_ID=your_facebook_client_id
GITHUB_CLIENT_ID=your_github_client_id

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
CSRF_SECRET=your_csrf_secret

# Database (if applicable)
DATABASE_URL=your_database_connection_string

# External Services
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Feature Flags
ENABLE_SOCIAL_AUTH=true
ENABLE_2FA=true
ENABLE_ANALYTICS=true

# Performance
CACHE_TTL=3600
MAX_FILE_SIZE=10485760
```

### Example `.env.example` File

```bash
# Copy this file to .env and fill in your values
PORT=3000
NODE_ENV=development
API_BASE_URL=https://api-auth.transitflow.qzz.io
API_TIMEOUT=30000

# Social Authentication
GOOGLE_CLIENT_ID=
FACEBOOK_CLIENT_ID=
GITHUB_CLIENT_ID=

# Security
JWT_SECRET=
SESSION_SECRET=
CSRF_SECRET=

# Database
DATABASE_URL=

# External Services
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Feature Flags
ENABLE_SOCIAL_AUTH=true
ENABLE_2FA=true
ENABLE_ANALYTICS=true
```

## 🚀 Deployment

### Railway Deployment (Recommended)

The application is configured for Railway deployment with the included `railway.toml` file.

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Deploy to Railway**
   ```bash
   railway up
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set API_BASE_URL=https://api-auth.transitflow.qzz.io
   # Add other required environment variables
   ```

### Alternative Deployment Options

#### Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Configure Environment Variables** in Vercel dashboard

#### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and Run**
   ```bash
   docker build -t transitflow-frontend .
   docker run -p 3000:3000 transitflow-frontend
   ```

#### Manual Server Deployment

1. **Upload files to your server**
2. **Install dependencies**: `npm install --production`
3. **Set environment variables**
4. **Start the application**: `npm start`
5. **Configure reverse proxy (nginx/Apache)**
6. **Set up SSL certificates**

## 🧪 Testing

### Test Structure

The application includes comprehensive testing capabilities:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Types

- **Unit Tests**: Individual component testing
- **Integration Tests**: API and service integration testing
- **End-to-End Tests**: Full user workflow testing
- **Visual Regression Tests**: UI consistency testing

### Testing Tools

- **Jest**: JavaScript testing framework
- **Supertest**: HTTP assertion library
- **Puppeteer**: Browser automation for E2E tests
- **Testing Library**: React component testing utilities

## 📏 Linting & Formatting

### Code Quality Tools

```bash
# Install development dependencies
npm install --save-dev eslint prettier husky lint-staged

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check code quality
npm run quality
```

### Configuration Files

- **ESLint**: `.eslintrc.js` - JavaScript linting rules
- **Prettier**: `.prettierrc` - Code formatting rules
- **Husky**: `.husky/` - Git hooks for pre-commit validation
- **Lint-staged**: `.lintstagedrc` - Staged files linting

### Pre-commit Hooks

The application uses Husky to enforce code quality:

- **Pre-commit**: Runs linting and formatting
- **Pre-push**: Runs tests and security checks
- **Commit-msg**: Validates commit message format

## 🔄 CI/CD

### GitHub Actions Workflow

The application includes automated CI/CD pipelines:

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
```

### Deployment Pipeline

1. **Code Push**: Triggers automated testing
2. **Quality Gates**: Linting, testing, and security checks
3. **Build Process**: Application compilation and optimization
4. **Deployment**: Automatic deployment to staging/production
5. **Health Checks**: Post-deployment verification

### Environment Management

- **Development**: Local development environment
- **Staging**: Pre-production testing environment
- **Production**: Live application environment

## 🤝 Contributing Guidelines

We welcome contributions from the community! Please follow these guidelines:

### Development Workflow

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**
4. **Run Tests and Linting**
   ```bash
   npm test
   npm run lint
   ```
5. **Commit Your Changes**
   ```bash
   git commit -m "feat: add new feature description"
   ```
6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Branch Naming Convention

- **Feature branches**: `feature/description`
- **Bug fixes**: `fix/description`
- **Hotfixes**: `hotfix/description`
- **Documentation**: `docs/description`

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(auth): add social login with Google
fix(dashboard): resolve navigation menu issue
docs(readme): update deployment instructions
```

### Code Style Guidelines

- **JavaScript**: Follow ESLint configuration
- **CSS**: Use consistent naming conventions (BEM methodology)
- **HTML**: Semantic markup with accessibility in mind
- **Documentation**: Clear and comprehensive code comments

### Pull Request Requirements

- **Description**: Clear description of changes
- **Testing**: Include tests for new functionality
- **Documentation**: Update relevant documentation
- **Code Review**: Address review comments
- **CI Checks**: All automated checks must pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 TransitFLOW

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

## 📞 Support & Contact

- **Documentation**: [https://docs.transitflow.com](https://docs.transitflow.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/transitflow-frontend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/transitflow-frontend/discussions)
- **Email**: support@transitflow.com

## 🙏 Acknowledgments

- **Express.js Team** for the excellent web framework
- **Font Awesome** for the comprehensive icon library
- **Boxicons** for additional icon resources
- **Open Source Community** for inspiration and contributions

---

**Made with ❤️ by the TransitFLOW Team**
