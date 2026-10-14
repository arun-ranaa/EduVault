# 🎓 EduVault

## Academic Resource Sharing & Personal Storage Platform

EduVault is a full-stack web application that combines **public academic resource sharing** with a **private personal cloud vault** for students. Built as an MCA Major Project, it provides a production-quality platform for uploading, discovering, and downloading academic resources, along with secure personal file storage.

---

## ✨ Features

### 📚 Academic Resource Sharing
- Upload academic resources (notes, books, question papers, assignments, etc.)
- Resources are **immediately published** — no admin approval required
- Search and filter by title, tags, category, resource type, subject
- Bookmark resources for quick access
- Secure downloads via pre-signed S3 URLs
- Tag-based resource discovery (minimum 1 tag required per upload)

### 🔒 Private Personal Vault
- Every user gets a private cloud storage space ("My Vault")
- Upload, view, download, and delete personal files
- Folder-based organization
- Storage quota management (configurable per user)
- Complete ownership isolation — users cannot access other users' files

### 👤 Authentication & Authorization
- JWT-based authentication
- bcrypt password hashing (salt rounds: 12)
- Role-Based Access Control (RBAC): `USER` and `ADMIN`
- Protected routes (frontend + backend)

### 🛡️ Admin Dashboard
- Platform statistics (users, resources, storage)
- User management (search, toggle status, adjust quotas)
- Resource management (search, filter, delete)
- Category management (CRUD)
- Activity log monitoring
- Storage overview with per-user breakdown

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   React + Vite      │
│   (Frontend)        │
└─────────┬───────────┘
          │ HTTPS / REST API
          │
┌─────────▼───────────┐
│ Node.js + Express   │
│ (Backend on EC2)    │
└────┬────────────┬───┘
     │            │
┌────▼────┐ ┌────▼────┐
│ Amazon  │ │ Amazon  │
│ RDS     │ │ S3      │
│ (MySQL) │ │ (Files) │
└─────────┘ └─────────┘
```

### Upload Flow (Pre-signed URLs)
```
User selects file → Frontend sends metadata to Backend
→ Backend validates (type, size, quota, auth)
→ Backend generates pre-signed S3 upload URL
→ Frontend uploads directly to S3 (browser → S3)
→ Frontend notifies Backend of completion
→ Backend saves metadata in RDS
```

### Download Flow
```
User clicks download → Frontend requests access from Backend
→ Backend authenticates user and checks authorization
→ Backend generates short-lived pre-signed download URL
→ Frontend uses URL to download from S3
```

> **Why pre-signed URLs?** Large files go directly between the browser and S3, keeping EC2 lightweight and reducing bandwidth/latency costs.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, JavaScript ES6+ |
| Styling | Tailwind CSS 3, Custom CSS components |
| Routing | React Router DOM 6 |
| HTTP Client | Axios |
| Icons | React Icons (Heroicons) |
| Notifications | React Hot Toast |
| Backend | Node.js, Express.js |
| ORM | Prisma |
| Database | Amazon RDS MySQL |
| File Storage | Amazon S3 (single private bucket) |
| Authentication | JWT + bcryptjs |
| AWS SDK | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner |
| Hosting | Amazon EC2 (backend), EBS (application files) |
| Permissions | AWS IAM |

---

## 📁 Project Structure

```
EDUVAULT/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/        # Reusable UI components
│   │   │   ├── layout/        # Navbar, Sidebar
│   │   │   └── resources/     # ResourceCard
│   │   ├── context/           # AuthContext
│   │   ├── layouts/           # MainLayout, AuthLayout
│   │   ├── pages/
│   │   │   ├── admin/         # Admin dashboard, users, resources, etc.
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── bookmarks/     # Bookmarks page
│   │   │   ├── dashboard/     # User dashboard
│   │   │   ├── profile/       # User profile
│   │   │   ├── resources/     # Resources, Detail, Upload
│   │   │   ├── settings/      # User settings
│   │   │   └── vault/         # My Vault, File detail
│   │   ├── routes/            # ProtectedRoute, AdminRoute, GuestRoute
│   │   ├── services/          # API service (Axios)
│   │   └── utils/             # Helper functions
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                    # Express Backend
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Seed data
│   ├── src/
│   │   ├── config/            # App config, S3 client, Prisma client
│   │   ├── controllers/       # Auth, User, Resource, Bookmark, Vault, Admin, Download
│   │   ├── middleware/        # Auth, Error handler, Validation
│   │   ├── routes/            # All API route definitions
│   │   ├── services/          # S3 service
│   │   ├── utils/             # Helper functions
│   │   ├── app.js             # Express app setup
│   │   └── server.js          # Entry point
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── package.json               # Root workspace
└── README.md
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js** v18+ (x64 or ARM64)
- **npm** v9+
- **MySQL** 8.0+ (local or RDS)
- **AWS Account** with S3 bucket and IAM credentials

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd EDUVAULT
```

### Step 2: Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Step 3: Configure Environment Variables

#### Server (.env)
Create `server/.env` from the example:
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database - Amazon RDS MySQL
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="mysql://admin:yourpassword@your-rds-endpoint.rds.amazonaws.com:3306/eduvault"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars-long
JWT_EXPIRES_IN=7d

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=your-eduvault-bucket

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# File Upload Limits
MAX_FILE_SIZE=52428800         # 50MB in bytes
MAX_VAULT_STORAGE=5368709120   # 5GB in bytes

# Pre-signed URL Expiry (seconds)
PRESIGNED_URL_EXPIRY=3600      # 1 hour
```

> ⚠️ **NEVER commit real credentials.** The `.env` file is in `.gitignore`.

### Step 4: Set Up the Database
```bash
cd server

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed the database with demo data
npx prisma db seed
```

### Step 5: Start the Application
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@eduvault.com | Admin@123 |
| User | user1@eduvault.com | User@123 |
| User | user2@eduvault.com | User@123 |

> ⚠️ These are **development-only** credentials. Change them in production.

---

## ☁️ AWS Configuration

### S3 Bucket Setup

1. **Create a private S3 bucket** (e.g., `eduvault-files-prod`)
2. **Block all public access** — the bucket must remain private
3. **Enable versioning** (optional, recommended)
4. **CORS Configuration** for the bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:5173", "https://your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### S3 Object Key Structure
```
your-bucket/
├── resources/              # Public academic resources
│   ├── NOTES/
│   ├── BOOK/
│   ├── QUESTION_PAPER/
│   ├── ASSIGNMENT/
│   └── ...
└── private/                # Private user vault files
    └── users/
        ├── 1/              # User ID 1's files
        ├── 2/              # User ID 2's files
        └── ...
```

### IAM Configuration

Create an IAM role (for EC2) or IAM user with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:DeleteObjects"
      ],
      "Resource": "arn:aws:s3:::your-eduvault-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-eduvault-bucket"
    }
  ]
}
```

> **Best Practice**: On EC2, use an **IAM Role** attached to the instance instead of hardcoding `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. When an IAM role is attached, the AWS SDK automatically picks up credentials — no `.env` keys needed.

### RDS MySQL Setup

1. Create an RDS MySQL 8.0 instance
2. Configure Security Group to allow inbound MySQL (port 3306) from your EC2 instance
3. Create a database named `eduvault`
4. Set the `DATABASE_URL` in your `.env`

### EC2 Setup

The EC2 instance hosts the Node.js/Express backend. Its attached **EBS volume** stores:
- Operating system files
- Node.js runtime
- Express application code
- `node_modules` dependencies
- Prisma client files
- Application configuration
- Server logs

> ⚠️ **EBS is NOT for user files.** All user-uploaded files (academic resources + vault files) are stored in **Amazon S3** exclusively.

---

## 🔒 Where to Put AWS Credentials

### Option A: IAM Role on EC2 (Recommended for Production)
1. Create an IAM Role with the S3 policy above
2. Attach the role to your EC2 instance
3. **Remove** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.env`
4. The AWS SDK will automatically use the instance role credentials

### Option B: Environment Variables (Development / Testing)
1. Create an IAM User with the S3 policy
2. Generate Access Key + Secret Key from AWS Console → IAM → Users → Security Credentials
3. Add to `server/.env`:
```env
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket-name
```

### What's Required:
| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_REGION` | AWS region (e.g., `ap-south-1`) | ✅ Yes |
| `AWS_ACCESS_KEY_ID` | IAM access key | Only if not using IAM role |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | Only if not using IAM role |
| `S3_BUCKET_NAME` | Name of your S3 bucket | ✅ Yes |
| `DATABASE_URL` | RDS MySQL connection string | ✅ Yes |
| `JWT_SECRET` | Secret for signing JWTs | ✅ Yes |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get profile |
| PUT | `/api/users/me` | Update profile |
| PUT | `/api/users/me/password` | Change password |
| GET | `/api/users/me/storage` | Get storage info |

### Resources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | List resources (with search/filter/pagination) |
| GET | `/api/resources/my` | List user's uploaded resources |
| GET | `/api/resources/:id` | Get resource details |
| GET | `/api/resources/:id/download` | Get download URL |
| POST | `/api/resources/presign` | Get pre-signed upload URL |
| POST | `/api/resources/complete` | Complete upload (save metadata) |
| DELETE | `/api/resources/:id` | Delete resource |

### Bookmarks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookmarks` | List user's bookmarks |
| POST | `/api/bookmarks/:resourceId` | Add bookmark |
| DELETE | `/api/bookmarks/:resourceId` | Remove bookmark |
| GET | `/api/bookmarks/:resourceId/check` | Check if bookmarked |

### Vault (Private Storage)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault` | List vault files |
| GET | `/api/vault/folders` | List folders |
| GET | `/api/vault/:id` | Get file details |
| GET | `/api/vault/:id/download` | Get download URL |
| POST | `/api/vault/presign` | Get pre-signed upload URL |
| POST | `/api/vault/complete` | Complete upload |
| DELETE | `/api/vault/:id` | Delete file |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/users` | List users |
| GET | `/api/admin/users/:id` | Get user details |
| PATCH | `/api/admin/users/:id/toggle-status` | Activate/deactivate user |
| PATCH | `/api/admin/users/:id/quota` | Update storage quota |
| GET | `/api/admin/resources` | List all resources |
| DELETE | `/api/admin/resources/:id` | Delete resource |
| GET | `/api/admin/categories` | List categories |
| POST | `/api/admin/categories` | Create category |
| PUT | `/api/admin/categories/:id` | Update category |
| DELETE | `/api/admin/categories/:id` | Delete category |
| GET | `/api/admin/activities` | Activity log |
| GET | `/api/admin/storage` | Storage statistics |

---

## 🗄️ Database Schema

```
User ──────┬── Resources (uploaded)
           ├── Bookmarks
           ├── VaultFiles
           └── Activities

Resource ──┬── Category
           ├── ResourceTags ── Tag
           ├── Bookmarks
           └── UploadedBy (User)
```

### Models
- **User**: id, name, email, passwordHash, role, storageQuota, storageUsed, isActive
- **Category**: id, name, description
- **Resource**: id, title, description, subject, resourceType, semester, fileName, fileType, fileSize, s3Key, downloadCount
- **Tag**: id, name (unique)
- **ResourceTag**: resourceId, tagId (unique pair)
- **Bookmark**: userId, resourceId (unique pair)
- **VaultFile**: id, ownerId, name, fileName, fileType, fileSize, s3Key, folder
- **Activity**: id, userId, action, details, metadata

---

## 🔐 Security Measures

1. **Passwords**: Hashed with bcrypt (12 salt rounds) — never stored as plain text
2. **JWT**: Token-based authentication for all API access
3. **RBAC**: Role-based access control (USER / ADMIN)
4. **Private S3 Bucket**: No public access; all access via pre-signed URLs
5. **Ownership Verification**: Backend verifies `ownerId === authenticatedUser.id` for vault files
6. **Input Validation**: express-validator on backend (never trust frontend alone)
7. **File Type Restriction**: Only academic document formats allowed (.pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .txt, .png, .jpg, .jpeg, .gif)
8. **File Size Limits**: Configurable via environment variable (default 50MB)
9. **Storage Quota**: Backend-enforced per-user quota (default 5GB)
10. **CORS**: Restricted to configured frontend origin
11. **Helmet**: HTTP security headers
12. **No AWS Secrets in Frontend**: All S3 operations go through backend

---

## 🎮 Demo Flow (For Viva/Presentation)

1. **Register** a new user account
2. **Login** and explore the **Dashboard**
3. **Browse Resources** — search, filter by category/type/tag
4. **Open a resource** to see full details
5. **Bookmark** a resource and check **My Bookmarks**
6. **Upload** an academic resource (it publishes immediately)
7. **Login as Admin** (admin@eduvault.com)
8. **Admin Dashboard** — view platform statistics
9. **Manage Users** — toggle status, adjust quotas
10. **Manage Categories** — create/edit/delete
11. **Return to user** account
12. **Download/preview** an uploaded resource
13. **Open My Vault** — upload a private file
14. **Show storage usage** updating
15. **Download** the private file
16. **Demonstrate isolation**: Try accessing another user's vault file (backend rejects)
17. **Delete** the private file

---

## 🏢 Deployment Overview

### Production Architecture
```
Internet
   │
   ▼
EC2 Instance (Node.js + Express)
   ├── EBS Volume (Application code, node_modules, logs)
   ├── → Amazon RDS MySQL (Metadata)
   └── → Amazon S3 (All uploaded files)
```

### Deployment Steps
1. Launch EC2 instance (Amazon Linux 2 / Ubuntu)
2. Install Node.js 18+
3. Clone repository to EC2
4. Install dependencies: `cd server && npm install && cd ../client && npm install`
5. Build frontend: `cd client && npm run build`
6. Configure `.env` on EC2
7. Run Prisma migrations: `cd server && npx prisma migrate deploy`
8. Start server: `cd server && npm start`
9. (Optional) Use PM2 for process management: `pm2 start server/src/server.js`
10. Configure reverse proxy (Nginx) if serving frontend from same instance

### Platform Support
- **x86_64 (amd64)**: Fully supported
- **ARM64 (aarch64)**: Fully supported (Node.js and all dependencies are compatible)

---

## 📝 License

This project is developed as an MCA Major Project for academic purposes.

---

## 🤝 Contributing

This is a university project. For suggestions or issues, please open an issue in the repository.
