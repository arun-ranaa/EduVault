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
```



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
## 📝 License

This project is developed as an MCA Major Project for academic purposes.

---

## 🤝 Contributing

This is a university project. For suggestions or issues, please open an issue in the repository.
