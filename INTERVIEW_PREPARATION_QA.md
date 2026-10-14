# 🎓 EduVault: Comprehensive Interview Questions & Answers Master Guide

This document contains an exhaustive, production-grade collection of technical and architectural interview questions and answers for **EduVault** (Academic Resource Sharing & Personal Storage Platform). It covers everything from high-level workflows and basic concepts to deep-dive implementations, database design, security mechanisms, cloud infrastructure, and tricky edge cases.

---

## 📑 Table of Contents

1. [Executive Project Summary & Core Concepts](#1-executive-project-summary--core-concepts)
2. [System Architecture & Cloud Infrastructure](#2-system-architecture--cloud-infrastructure)
3. [End-to-End System Workflows](#3-end-to-end-system-workflows)
   - [Workflow 1: User Registration & Authentication](#workflow-1-user-registration--authentication)
   - [Workflow 2: Academic Resource Upload (Pre-signed S3 URLs)](#workflow-2-academic-resource-upload-pre-signed-s3-urls)
   - [Workflow 3: Secure Resource Download](#workflow-3-secure-resource-download)
   - [Workflow 4: Private Cloud Vault File Upload & Dynamic Quota Tracking](#workflow-4-private-cloud-vault-file-upload--dynamic-quota-tracking)
   - [Workflow 5: Vault File Isolation & IDOR Protection](#workflow-5-vault-file-isolation--idor-protection)
   - [Workflow 6: Resource Discovery, Search, Filtering & Pagination](#workflow-6-resource-discovery-search-filtering--pagination)
   - [Workflow 7: Bookmarking Lifecycle & Data Integrity](#workflow-7-bookmarking-lifecycle--data-integrity)
   - [Workflow 8: Admin Operations & Activity Audit Logging](#workflow-8-admin-operations--activity-audit-logging)
4. [Backend Engineering (Node.js, Express, Prisma & MySQL)](#4-backend-engineering-nodejs-express-prisma--mysql)
5. [Database Architecture & Data Modeling](#5-database-architecture--data-modeling)
6. [Frontend Engineering (React 18, Vite & Tailwind CSS)](#6-frontend-engineering-react-18-vite--tailwind-css)
7. [Security, Authentication & Authorization](#7-security-authentication--authorization)
8. [Cloud Infrastructure & DevOps (AWS EC2, S3, RDS, EBS, IAM)](#8-cloud-infrastructure--devops-aws-ec2-s3-rds-ebs-iam)
9. [Edge Cases, Tough Scenarios & Scalability Extensions](#9-edge-cases-tough-scenarios--scalability-extensions)
10. [Rapid-Fire Viva & Quick-Review Cheat Sheet](#10-rapid-fire-viva--quick-review-cheat-sheet)

---

## 1. Executive Project Summary & Core Concepts

### Q1: What is EduVault? What problem does it solve?
**Answer:**
**EduVault** is a full-stack academic web platform designed to solve two core challenges faced by university students and educators:
1. **Fragmented Academic Resource Sharing:** Study materials (lecture notes, past question papers, syllabus guides, reference books, assignments) are usually scattered across unorganized chat groups, personal drives, or unsearchable messaging threads. EduVault provides a centralized, instantly published, searchable repository categorized by academic subjects, semesters, and tags.
2. **Secure Personal Cloud Storage for Students:** In addition to public sharing, students need a private, secure cloud drive ("My Vault") to store personal academic documents, resumes, and projects. EduVault provides isolated cloud storage with folder hierarchy and quota enforcement.

### Q2: What are the primary user roles in EduVault?
**Answer:**
EduVault implements Role-Based Access Control (RBAC) with two roles defined in the database enum:
1. `USER` (Student / Normal Member):
   - Browse, search, filter, preview, bookmark, and download public academic resources.
   - Upload new public resources (published immediately without admin gatekeeping).
   - Manage their private personal vault (upload, organize into virtual folders, download, delete).
   - Track their personal storage usage against an assigned quota (default 5 GB).
   - Update profile details and change passwords.
2. `ADMIN` (Platform Administrator):
   - Access the Admin Dashboard displaying global platform statistics (total users, resources, storage used, resource distribution by type, activity velocity).
   - User Management: search users, view per-user storage consumption, toggle account status (activate/deactivate), and dynamically increase or decrease storage quotas.
   - Resource Moderation: search, inspect, and delete inappropriate resources (deleting both database metadata and S3 objects).
   - Category Management: full CRUD over academic categories.
   - Activity Audit Log: view platform-wide audit logs with actor tracking and action metadata.

### Q3: What is the dual-storage architecture of EduVault?
**Answer:**
EduVault bifurcates file storage into two logical namespaces hosted within a single, private Amazon S3 bucket:
- **Public Domain (`resources/` prefix):** Files uploaded as academic resources. Any authenticated user can search, view metadata, and request a temporary download link. Keys follow the structure:
  `resources/{RESOURCE_TYPE}/{uuidv4}-{sanitizedFileName}`
- **Private Domain (`private/` prefix):** Files uploaded to "My Vault". These files are strictly bound to the owner's user ID. No other user can discover, download, or inspect these files. Keys follow the structure:
  `private/users/{userId}/{uuidv4}-{sanitizedFileName}`

---

## 2. System Architecture & Cloud Infrastructure

### Q4: What is the high-level architecture of EduVault?
**Answer:**
EduVault follows a decoupled, three-tier cloud architecture:

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT TIER                          │
│   React 18 + Vite SPA (Hosted via Nginx / S3+CloudFront)│
│   - Axios with JWT Interceptors                        │
│   - Direct Binary Upload to S3 (PUT via Pre-signed URL)│
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / REST API
┌──────────────────────────▼─────────────────────────────┐
│                 APPLICATION TIER                       │
│   Node.js + Express.js API Server (AWS EC2)            │
│   - Middleware: Helmet, CORS, Morgan, Express-Validator│
│   - JWT Auth & RBAC Authorization                      │
│   - AWS SDK v3 Pre-signer & S3 Client                  │
│   - Prisma ORM 5.x Data Access Layer                   │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
      Database │ Traffic         S3 Signed│ Auth / Direct
        (TCP 3306)                        │ Object Access
┌──────────────▼──────────┐     ┌─────────▼──────────────┐
│       DATA TIER         │     │      STORAGE TIER      │
│   Amazon RDS MySQL 8.0  │     │       Amazon S3        │
│   - Users, Categories   │     │   (Single Private      │
│   - Resources, Tags     │     │    Bucket, 0 Public    │
│   - VaultFiles, Bookmarks│    │    Access, CORS Enabled│
│   - Activity Logs       │     │    Resources + Vault)  │
└─────────────────────────┘     └────────────────────────┘
```

### Q5: Why are file uploads handled directly between the browser and Amazon S3 instead of going through the Node.js/Express server?
**Answer:**
This is one of the most critical architectural decisions in EduVault. In traditional file upload architectures:
1. Browser uploads binary data via `multipart/form-data` to the Node.js server.
2. Node.js buffers the file in memory or writes it to a local temporary disk (e.g., using `multer`).
3. Node.js then streams the binary data to Amazon S3.

**Problems with the traditional approach:**
- **Resource Saturation:** Node.js runs on a single-threaded event loop. Handling 50MB file uploads for hundreds of concurrent students consumes enormous memory, blocks worker threads, and exhausts server RAM and CPU.
- **Double Bandwidth & Latency Cost:** The file travels twice across the network (Browser $\to$ EC2, then EC2 $\to$ S3), doubling latency and incurring EC2 network egress costs.
- **Connection Timeouts:** Slow student mobile connections occupy HTTP sockets on EC2 for extended durations, leading to gateway timeouts (`504 Gateway Timeout`) and server starvation.

**EduVault's Pre-signed URL Solution:**
1. The client requests a cryptographically signed upload URL from the backend with file metadata (size, type).
2. The backend generates an AWS S3 Pre-signed `PutObject` URL valid for a short window (e.g., 60 minutes) signed with AWS credentials.
3. The browser streams the binary payload directly to S3 via HTTP `PUT`.
4. The client notifies the backend to commit metadata to MySQL.
- **Result:** The EC2 backend remains ultra-lightweight, stateless, and capable of handling thousands of concurrent requests while S3 handles massive binary I/O.

### Q6: What role does Amazon EBS play versus Amazon S3 in this project?
**Answer:**
- **Amazon EBS (Elastic Block Store):** Acts as the local SSD/HDD for the EC2 virtual machine. It stores the operating system (Ubuntu/Amazon Linux), Node.js runtime, Express application code, `node_modules` dependencies, Prisma engine binaries, `.env` configuration, and runtime log files.
- **Amazon S3 (Simple Storage Service):** Acts as the distributed, highly available object storage service. **Zero user files are stored on EBS**. All public academic resources and private vault files live exclusively in S3.
- **Interview Key Point:** Storing user files on EBS is an anti-pattern because EBS is tied to a single EC2 instance in a single Availability Zone, cannot scale horizontally, and risks data loss if the instance is terminated. S3 provides 99.999999999% (11 9's) data durability.

---

## 3. End-to-End System Workflows

---

### Workflow 1: User Registration & Authentication

```
User (Browser)               Express Backend                    RDS (MySQL)
     │                             │                                 │
     ├─── POST /api/auth/register ─►│                                 │
     │    { name, email, password }│                                 │
     │                             ├─── Validate inputs (express-val)│
     │                             ├─── Check existing email ────────►│
     │                             │◄── Email is unique ─────────────┤
     │                             ├─── bcrypt.hash(password, 12)    │
     │                             ├─── INSERT INTO users ───────────►│
     │                             ├─── INSERT INTO activities ──────►│
     │                             ├─── Generate JWT (id, role)      │
     │◄── 201 Created + Token ─────┤                                 │
     │    + User Profile Data      │                                 │
```

#### Q7: Describe step-by-step how user authentication works from registration to protected route access.
**Answer:**
1. **Registration:**
   - The user inputs `name`, `email`, and `password` on the React frontend (`RegisterPage.jsx`).
   - The frontend dispatches `POST /api/auth/register`.
   - `validate.js` runs `registerRules`: validates name length (2–100 characters), validates and normalizes email, and verifies password length $\ge 6$.
   - The backend checks if the email already exists using `prisma.user.findUnique({ where: { email } })`. If found, throws `AppError('Email is already in use', 409)`.
   - The backend generates a salt with 12 rounds and hashes the password: `await bcrypt.hash(password, 12)`.
   - A new `User` record is created in MySQL with default `storageQuota: 5368709120` (5 GB), `storageUsed: 0`, `role: USER`, and `isActive: true`.
   - An activity log entry `USER_REGISTERED` is created.
   - A JWT is generated containing `{ id: newUser.id, role: newUser.role }`, signed with `JWT_SECRET`, expiring in `7d`.
   - The backend responds with `token` and sanitized user object (excluding `passwordHash`).
2. **Client Token Storage:**
   - The React frontend receives the response, stores the token in `localStorage.setItem('eduvault_token', token)`, updates `AuthContext` state, and redirects to `/dashboard`.
3. **Protected Request Interception:**
   - Axios request interceptor reads `localStorage.getItem('eduvault_token')` and appends header: `Authorization: Bearer <token>`.
4. **Backend Middleware Verification (`authenticate` in `auth.js`):**
   - Extracts the token from `req.headers.authorization`.
   - Verifies the signature with `jwt.verify(token, config.jwt.secret)`.
   - Fetches the user from MySQL by `decoded.id`.
   - **Crucial Security Check:** Verifies `currentUser.isActive === true`. If the admin deactivated the user, the request is immediately rejected with HTTP 403, even if the JWT has not expired.
   - Strips `passwordHash` and attaches `req.user = userWithoutPassword`.
   - Calls `next()`.

---

### Workflow 2: Academic Resource Upload (Pre-signed S3 URLs)

```
Browser                       Express API                       Amazon S3
   │                               │                                │
   ├── 1. POST /resources/presign ─►│                                │
   │   { fileName, fileSize,       │                                │
   │     resourceType, tags... }   ├── Validate size & extension    │
   │                               ├── Generate S3 Key              │
   │                               ├── Call S3 PutObjectCommand ────►
   │                               │◄── Return Pre-signed URL ──────┤
   │◄─ 2. Return {uploadUrl,s3Key}─┤                                │
   │                                                                │
   ├── 3. HTTP PUT (Binary File Stream) ───────────────────────────►│
   │      [Axios with onUploadProgress: 0% → 100%]                  │
   │◄───── 200 OK (Upload Successful) ──────────────────────────────┤
   │                               │                                │
   ├── 4. POST /resources/complete ►│                                │
   │   { title, tags, s3Key, ... } ├── Prisma Transaction:          │
   │                               │   a) INSERT resource           │
   │                               │   b) Upsert tags & link        │
   │                               │   c) Log activity              │
   │◄─ 5. 201 Resource Created ────┤                                │
```

#### Q8: Walk through the complete lifecycle of uploading an academic resource. How is data integrity guaranteed?
**Answer:**
The upload workflow follows a **three-phase protocol**:
1. **Phase 1: Pre-signing & Validation (`POST /api/resources/presign`):**
   - The user selects a file and enters metadata (Title, Subject, Resource Type, Category, Semester, Tags).
   - The client verifies `file.size <= 50MB` and sends metadata to `/api/resources/presign`.
   - Backend performs strict validation:
     - Checks file size: `fileSize <= config.upload.maxFileSize` (50MB).
     - Checks file extension: `isAllowedFileType(fileName)` checks if extension exists in `['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.gif']`.
   - Generates a collision-resistant S3 key:
     `resources/${resourceType}/${uuidv4()}-${sanitizedFileName}`
   - Calls AWS SDK `PutObjectCommand` and signs it using `@aws-sdk/s3-request-presigner`'s `getSignedUrl(s3Client, command, { expiresIn: 3600 })`.
   - Returns `{ uploadUrl, s3Key }`.
2. **Phase 2: Direct Binary Upload to S3:**
   - The client invokes `uploadToS3(uploadUrl, file, onProgress)` which uses `axios.put(uploadUrl, file, { headers: { 'Content-Type': fileType } })`.
   - Axios calculates upload percentage via `(loaded * 100) / total` and updates the React progress bar in real time.
   - S3 validates the cryptographic signature, matches the key and content type, and writes the object.
3. **Phase 3: Completion & Relational Transaction (`POST /api/resources/complete`):**
   - Once S3 returns HTTP 200, the client invokes `/api/resources/complete` with `s3Key` and resource details.
   - The backend runs an **atomic database transaction** (`prisma.$transaction`):
     - Inserts the `Resource` row with foreign keys `categoryId` and `uploadedById: req.user.id`.
     - For each tag in the tags array: upserts the tag in `tags` (normalizes to lowercase), and creates a `resource_tags` junction record.
     - Creates an `Activity` record (`RESOURCE_UPLOADED`).
   - Returns the created resource. If any database operation fails, the transaction rolls back cleanly.

---

### Workflow 3: Secure Resource Download

```
Browser                       Express API                       Amazon S3
   │                               │                                │
   ├── 1. GET /resources/:id/download
   │   [Header: Bearer Token]      │                                │
   │                               ├── Verify JWT & User Active     │
   │                               ├── Increment downloadCount in DB│
   │                               ├── Generate GetObjectCommand    │
   │                               │   with Content-Disposition     │
   │                               ├── Sign URL (1h expiry) ────────►
   │                               │◄── Signed download URL ────────┤
   │◄─ 2. Return { downloadUrl } ──┤                                │
   │                                                                │
   ├── 3. window.open(downloadUrl) ────────────────────────────────►│
   │◄───── Direct Binary Stream (File downloaded to browser) ───────┤
```

#### Q9: How does EduVault provide secure downloads without making the S3 bucket public?
**Answer:**
1. The S3 bucket is **100% private** with all public access blocked via AWS S3 Block Public Access settings.
2. When a user clicks "Download", the frontend sends an authenticated request to `GET /api/resources/:id/download`.
3. The backend middleware authenticates the user.
4. The backend retrieves the resource's `s3Key` and `fileName` from MySQL, and atomically increments the download counter:
   ```javascript
   await prisma.resource.update({
       where: { id },
       data: { downloadCount: { increment: 1 } }
   });
   ```
5. The backend creates an AWS S3 `GetObjectCommand` configuring `ResponseContentDisposition: attachment; filename="${originalFileName}"` and signs it using `getSignedUrl(s3Client, command, { expiresIn: 3600 })`.
   - **Why `ResponseContentDisposition`?** This instructs the browser to trigger a "Save File" download dialog with the original human-readable filename instead of the UUID key.
6. The backend returns the signed URL. The browser opens the link, S3 validates AWS signature parameters in the query string (`X-Amz-Signature`), and streams the file directly to the client. After 1 hour, the URL expires and can no longer be used.

---

### Workflow 4: Private Cloud Vault File Upload & Dynamic Quota Tracking

```
User (Browser)               Express Backend                    RDS (MySQL)
     │                             │                                 │
     ├── 1. POST /vault/presign ──►│                                 │
     │   { fileName, fileSize }    ├── Check allowed extension       │
     │                             ├── Fetch user storageUsed/Quota ─►
     │                             │◄─ Return {used, quota} ─────────┤
     │                             ├── Enforce: used + size <= quota │
     │                             │   (If exceeded → throw 413)     │
     │                             ├── Generate private S3 key       │
     │                             ├── Generate presigned PUT URL    │
     │◄─ 2. { uploadUrl, s3Key } ──┤                                 │
     │                             │                                 │
     │=== [Direct Upload to S3 via PUT (Browser -> S3)] =============│
     │                             │                                 │
     ├── 3. POST /vault/complete ─►│                                 │
     │   { name, folder, s3Key }   ├── Prisma Transaction:           │
     │                             │   a) INSERT vault_files         │
     │                             │   b) UPDATE users SET           │
     │                             │      storageUsed += fileSize ──►│
     │                             │   c) INSERT activities ────────►│
     │◄─ 4. 201 Created ───────────┤                                 │
```

#### Q10: How does EduVault enforce and calculate user storage quotas in the personal vault?
**Answer:**
EduVault protects cloud infrastructure from storage abuse through strict backend quota enforcement:
1. **Quota Verification before Upload (`POST /api/vault/presign`):**
   - In `vaultController.js`, before issuing an S3 upload URL, the backend queries the user's quota metrics:
     ```javascript
     const user = await prisma.user.findUnique({
       where: { id: req.user.id },
       select: { storageUsed: true, storageQuota: true },
     });
     ```
   - Checks if `userStorageUsed + parsedSize > userStorageQuota`.
   - If exceeded, it aborts immediately with HTTP 413 (Payload Too Large):
     ```javascript
     const remaining = Math.max(0, userStorageQuota - userStorageUsed);
     const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
     throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
     ```
2. **Atomic Quota Increment on Completion (`POST /api/vault/complete`):**
   - Wrapped inside a database transaction (`prisma.$transaction`):
     ```javascript
     await tx.vaultFile.create({ ... });
     await tx.user.update({
       where: { id: req.user.id },
       data: { storageUsed: { increment: parseInt(fileSize) } }
     });
     ```
3. **Atomic Quota Recovery on File Deletion (`DELETE /api/vault/:id`):**
   - The S3 object is deleted: `await s3Service.deleteS3Object(file.s3Key)`.
   - Inside a database transaction, the file record is deleted, and the user's `storageUsed` is recalculated/decremented:
     ```javascript
     const newStorageUsed = Math.max(0, Number(user.storageUsed) - Number(file.fileSize));
     await tx.user.update({
       where: { id: req.user.id },
       data: { storageUsed: BigInt(newStorageUsed) }
     });
     ```

---

### Workflow 5: Vault File Isolation & IDOR Protection

#### Q11: How does EduVault prevent Insecure Direct Object References (IDOR) and ensure a user cannot access another user's vault files?
**Answer:**
In an insecure system, an endpoint like `GET /api/vault/:id` might query `prisma.vaultFile.findUnique({ where: { id } })`. If Alice knows Bob's file ID is 42, Alice could download Bob's file.

**EduVault eliminates IDOR through three layers:**
1. **Ownership Query Scoping:**
   In every vault controller method (`getVaultFileById`, `getVaultDownloadUrl`, `deleteVaultFile`), the database query hard-binds the authenticated user ID:
   ```javascript
   const file = await prisma.vaultFile.findFirst({
     where: {
       id: parseInt(req.params.id),
       ownerId: req.user.id, // Enforces multi-tenant ownership
     },
   });
   if (!file) {
     throw new AppError('Vault file not found or access denied', 404);
   }
   ```
   If another user attempts to access file ID 42, the query evaluates to null and returns 404 (revealing neither the file nor its existence).
2. **S3 Key Segregation:**
   Vault S3 keys incorporate the user ID as a virtual path:
   `private/users/${userId}/${uuidv4()}-${sanitizedFileName}`
   Even if someone guesses a random UUID, S3 will not serve it without a signed URL generated by the backend.
3. **Download URL Generation on Demand:**
   Pre-signed download URLs are generated strictly after verifying the database ownership condition above.

---

### Workflow 6: Resource Discovery, Search, Filtering & Pagination

#### Q12: How does the resource discovery engine handle search, multi-faceted filtering, sorting, and pagination simultaneously?
**Answer:**
In `resourceController.js` (`getResources`):
1. **Query Parameters Extracted:**
   `{ page = 1, limit = 12, search, category, resourceType, subject, tag, sortBy = 'createdAt', order = 'desc' }`.
2. **Dynamic Prisma `where` Clause Construction:**
   - **Search:** Performs multi-column search on title and description:
     ```javascript
     if (search) {
       where.OR = [
         { title: { contains: search } },
         { description: { contains: search } }
       ];
     }
     ```
   - **Category Filter:** `if (category) where.categoryId = parseInt(category)`.
   - **Resource Type Filter:** `if (resourceType) where.resourceType = resourceType`.
   - **Subject Filter:** `if (subject) where.subject = { contains: subject }`.
   - **Tag Filter (Relational Traversal):**
     ```javascript
     if (tag) {
       const foundTag = await prisma.tag.findFirst({ where: { name: tag.toLowerCase() } });
       if (foundTag) {
         where.tags = { some: { tagId: foundTag.id } };
       } else {
         return res.json({ success: true, data: [], pagination: ... });
       }
     }
     ```
3. **Pagination & Offset Calculation:**
   `const skip = (page - 1) * limit;`
4. **Concurrent Execution via `Promise.all`:**
   ```javascript
   const [resources, total] = await Promise.all([
     prisma.resource.findMany({
       where, skip, take: limit,
       orderBy: { [sortBy]: order === 'desc' ? 'desc' : 'asc' },
       include: {
         category: true,
         uploadedBy: { select: { id: true, name: true } },
         tags: { include: { tag: true } }
       }
     }),
     prisma.resource.count({ where })
   ]);
   ```
5. **BigInt Serialization & Metadata Response:**
   Formats response with current page, limit, total records, and total pages (`Math.ceil(total / limit)`).

---

### Workflow 7: Bookmarking Lifecycle & Data Integrity

#### Q13: How does the bookmarking system work? How does it prevent duplicate bookmarks?
**Answer:**
1. **Database Schema Enforcement:**
   In `schema.prisma`, the `Bookmark` model defines a compound unique constraint:
   ```prisma
   model Bookmark {
     id         Int      @id @default(autoincrement())
     userId     Int
     resourceId Int
     user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

     @@unique([userId, resourceId])
     @@index([userId])
     @@index([resourceId])
   }
   ```
   This guarantees at the database engine level that a user cannot bookmark the same resource multiple times.
2. **Controller Logic:**
   - **Add Bookmark (`POST /api/bookmarks/:resourceId`):** Checks if the resource exists; checks if already bookmarked; creates the bookmark and logs a `BOOKMARK_ADDED` activity inside a transaction. If a duplicate slips through concurrent clicks, Prisma catches error code `P2002` (unique violation) in `errorHandler.js`.
   - **Remove Bookmark (`DELETE /api/bookmarks/:resourceId`):** Deletes the bookmark record and logs `BOOKMARK_REMOVED`.
   - **Check Status (`GET /api/bookmarks/:resourceId/check`):** Returns `{ isBookmarked: boolean }` so the frontend can display either a filled or outlined bookmark icon.
3. **Cascade Integrity:**
   If either the User or the Resource is deleted, all associated bookmarks are automatically deleted by MySQL due to `onDelete: Cascade`.

---

### Workflow 8: Admin Operations & Activity Audit Logging

#### Q14: What admin capabilities exist in EduVault, and how is the activity audit log maintained?
**Answer:**
1. **Admin Authorization Guard:**
   Routes in `adminRoutes.js` are protected by `authenticate` followed by `authorize('ADMIN')`.
2. **Capabilities:**
   - **Dashboard Aggregations (`GET /api/admin/dashboard`):** Computes total users, total resources, total vault files, total storage consumed across all users, resource distribution grouped by `resourceType` using `prisma.resource.groupBy`, and activity count over the last 7 days.
   - **User Management (`PATCH /api/admin/users/:id/toggle-status` & `/quota`):** Allows activating/deactivating any user (with a safety check preventing admins from deactivating themselves) and updating storage quotas.
   - **Resource Moderation (`DELETE /api/admin/resources/:id`):** Deletes the physical file from S3 (`s3Service.deleteS3Object`), deletes bookmarks and tags in a transaction, and removes the resource.
   - **Category CRUD:** Create, update, and delete categories. Category deletion includes a safeguard preventing deletion if any resources are linked to it (`_count.resources > 0`).
3. **Activity Audit Trail:**
   Actions throughout the application trigger `prisma.activity.create`:
   Actions tracked: `USER_REGISTERED`, `USER_LOGIN`, `RESOURCE_UPLOADED`, `RESOURCE_DELETED`, `VAULT_FILE_UPLOADED`, `VAULT_FILE_DELETED`, `BOOKMARK_ADDED`, `BOOKMARK_REMOVED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`. Each record stores `userId`, `action`, `details`, and JSON `metadata`.

---

## 4. Backend Engineering (Node.js, Express, Prisma & MySQL)

### Q15: Walk through the Express middleware pipeline in `app.js`. In what sequence are middlewares executed?
**Answer:**
The request pipeline executes in this exact order:
1. `helmet()`: Sets secure HTTP response headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.).
2. `cors({ origin, credentials: true, methods: [...] })`: Enforces Cross-Origin Resource Sharing restrictions, allowing only the trusted frontend origin.
3. `express.json({ limit: '10mb' })`: Parses incoming JSON payloads up to 10MB.
4. `express.urlencoded({ extended: true })`: Parses URL-encoded data.
5. `morgan('dev')`: HTTP request logger (enabled in development mode).
6. `/api/health`: Unauthenticated health-check endpoint.
7. **Route Handlers:** `/api/auth`, `/api/users`, `/api/resources`, `/api/bookmarks`, `/api/vault`, `/api/admin`.
   - Inside route handlers: `validate(rules)` $\to$ `authenticate` $\to$ `authorize(roles)` $\to$ controller function.
8. **Catch-All 404 Handler:** Catches unmatched routes and returns `{ success: false, message: 'Route ... not found' }`.
9. **Centralized Error Handler (`errorHandler`):** Express 4-argument error-handling middleware `(err, req, res, next)` catching all errors forwarded via `next(error)`.

### Q16: How does centralized error handling work in EduVault? What is the distinction between operational and programming errors?
**Answer:**
EduVault implements a custom `AppError` class inheriting from `Error`:
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Flags trusted, anticipated errors
    Error.captureStackTrace(this, this.constructor);
  }
}
```
**Distinction:**
- **Operational Errors:** Known, anticipated errors that occur in normal operation (e.g., invalid user input, expired JWT, resource not found, storage quota exceeded). These have `isOperational = true`.
- **Programming / Unknown Errors:** Bugs, unhandled exceptions, syntax errors, or third-party service crashes (e.g., database connection drops).

**Centralized Handling in `errorHandler.js`:**
1. Intercepts specific Prisma error codes:
   - `P2002` (Unique constraint violation) $\to$ converts to HTTP 400: "Duplicate field value: [field]".
   - `P2025` (Record not found) $\to$ converts to HTTP 404: "Record not found".
2. Intercepts JWT errors (`JsonWebTokenError`, `TokenExpiredError`) $\to$ returns HTTP 401.
3. Intercepts Multer file limit errors $\to$ returns HTTP 400.
4. In **Production**:
   - Operational errors send a clean, user-friendly JSON message.
   - Non-operational errors do NOT leak stack traces or internal implementation details to the client; they log the error to the server console and return a generic `500 Internal Server Error: "Something went very wrong!"`.

### Q17: What was the BigInt serialization issue in JavaScript/Prisma, and how did you resolve it?
**Answer:**
**The Problem:**
MySQL `BigInt` columns are used for file sizes and storage quotas (e.g., `5368709120` bytes for 5GB) to prevent 32-bit integer overflow ($2^{31}-1 \approx 2.14\text{ GB}$). Prisma maps these columns to native JavaScript `BigInt` primitives (`5368709120n`).
However, native `BigInt` primitives **cannot be serialized by `JSON.stringify()`**:
```javascript
JSON.stringify({ size: 50000000n });
// Throws: TypeError: Do not know how to serialize a BigInt
```
When Express calls `res.json()`, the server crashed with an unhandled exception.

**The Solution:**
Created a recursive serializer helper in `helpers.js`:
```javascript
const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  return obj;
};
```
This utility recursively scans response objects and converts `BigInt` values to safe JavaScript `Number` types before JSON transmission.

---

## 5. Database Architecture & Data Modeling

### Q18: Explain the Entity-Relationship (ER) model of EduVault and why specific cascade strategies were chosen.
**Answer:**

```
┌───────────┐         1:N         ┌───────────────┐
│   User    ├────────────────────►│  VaultFile    │ (Cascade delete)
│           ├──────┐              └───────────────┘
└─────┬─────┘      │  1:N         ┌───────────────┐
      │            ├─────────────►│   Bookmark    │ (Cascade delete)
      │ 1:N        │              └───────┬───────┘
      │            │  1:N         ┌───────▼───────┐
      │            └─────────────►│   Activity    │ (SetNull on user delete)
      │                           └───────────────┘
      ▼ 1:N                               ▲
┌───────────┐         1:N                 │ N:1
│ Resource  ├─────────────────────────────┘
└─────┬─────┘
      │ N:1 (SetNull on delete)
      ▼
┌───────────┐         N:M         ┌───────────────┐
│ Category  │      (Via Junction) │      Tag      │
└───────────┘                     └───────────────┘
```

**Key Relationship Design Choices:**
1. **User $\to$ Resource (`uploadedById`):**
   `onDelete: Cascade`. If a user account is purged, their uploaded resources are removed.
2. **Category $\to$ Resource (`categoryId`):**
   `onDelete: SetNull`. If an academic category is deleted, resources within it are NOT deleted; their `categoryId` is set to `NULL` so student study materials remain safe.
3. **Resource $\leftrightarrow$ Tag (`ResourceTag`):**
   Implemented as an explicit junction table (`ResourceTag`) with compound uniqueness `@@unique([resourceId, tagId])` and `onDelete: Cascade` on both sides.
4. **User $\leftrightarrow$ Resource (`Bookmark`):**
   Compound uniqueness `@@unique([userId, resourceId])` and `onDelete: Cascade`.
5. **User $\to$ Activity (`userId`):**
   `onDelete: SetNull`. If a user is deleted, audit activity logs remain in the system for administrative accountability, with `userId` set to `NULL`.

### Q19: Why are database indexes used in `schema.prisma`? Which specific indexes were added and why?
**Answer:**
Without indexes, MySQL must perform a full-table scan ($O(N)$) for every query. EduVault places deliberate indexes:
- `User`:
  - `@@index([email])`: Accelerates login lookup (`WHERE email = ?`).
  - `@@index([role])`: Optimizes admin filtering.
- `Resource`:
  - `@@index([categoryId])`, `@@index([resourceType])`, `@@index([subject])`: Powers faceted filtering on the resources browse page.
  - `@@index([title])`: Speeds up title search.
  - `@@index([createdAt])`: Speeds up default sorting by newest resources (`ORDER BY createdAt DESC`).
  - `@@index([uploadedById])`: Fast lookup for "My Uploaded Resources".
- `VaultFile`:
  - `@@index([ownerId])`: Essential for fast multi-tenant file retrieval.
  - `@@index([folder])`: Speeds up folder filtering.
  - `@@index([ownerId, folder])`: **Composite Index** optimizing queries like `WHERE ownerId = ? AND folder = ?`.

---

## 6. Frontend Engineering (React 18, Vite & Tailwind CSS)

### Q20: How are Route Guards implemented in React Router v6?
**Answer:**
EduVault implements three distinct route guard wrapper components:
1. `ProtectedRoute.jsx`:
   - Checks `isAuthenticated` from `AuthContext`.
   - If not authenticated, redirects to `/login` preserving the attempted location: `<Navigate to="/login" state={{ from: location }} replace />`.
   - If authenticated, renders child routes via `<Outlet />` or `children`.
2. `AdminRoute.jsx`:
   - Checks `isAuthenticated` AND `user.role === 'ADMIN'`.
   - If user is not an admin, redirects to `/dashboard`.
3. `GuestRoute.jsx`:
   - Used for `/login` and `/register`.
   - If an already-authenticated user tries to visit the login page, it redirects them immediately to `/dashboard`.

### Q21: How does Axios handle automatic token injection and authentication expiration?
**Answer:**
Configured in `client/src/services/api.js`:
1. **Request Interceptor (Token Injection):**
   ```javascript
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('eduvault_token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```
2. **Response Interceptor (401 Handling):**
   ```javascript
   api.interceptors.response.use(
     (response) => response,
     (error) => {
       if (error.response?.status === 401) {
         localStorage.removeItem('eduvault_token');
         localStorage.removeItem('eduvault_user');
         if (window.location.pathname !== '/login') {
           window.location.href = '/login';
         }
       }
       return Promise.reject(error);
     }
   );
   ```
   If a JWT expires or is revoked while a student is using the app, any API call returning 401 automatically clears credentials and routes the user to the login page.

### Q22: How does the frontend handle direct S3 upload with progress bars?
**Answer:**
In `client/src/services/api.js`, the `uploadToS3` function uses a raw `axios.put`:
```javascript
export const uploadToS3 = async (presignedUrl, file, onProgress) => {
  return axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
};
```
In `UploadResourcePage.jsx` and `VaultPage.jsx`, this progress percentage updates the React component state `uploadProgress`, dynamically styling a Tailwind progress bar (`width: ${uploadProgress}%`).

---

## 7. Security, Authentication & Authorization

### Q23: How are passwords stored and verified? Why bcrypt with 12 salt rounds?
**Answer:**
- **Storage:** Passwords are never stored in plain text. On registration or password modification, EduVault uses `bcryptjs`:
  ```javascript
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);
  ```
- **Verification:** On login, `await bcrypt.compare(password, user.passwordHash)`.
- **Why Salt Rounds = 12?**
  - **Salting:** Prevents rainbow table attacks (precomputed hash tables) by adding a random 128-bit string to each password before hashing. Even if two students choose identical passwords, their hashes are completely different.
  - **Key Stretching (Work Factor 12):** Bcrypt is an adaptive hash function with $2^{12} = 4,096$ iterations. This intentional computational delay makes brute-force attacks computationally prohibitive while remaining virtually instantaneous ($\sim 250\text{ms}$) for legitimate users.

### Q24: What is in the JWT payload? Why is sensitive data excluded?
**Answer:**
- In `authController.js`, the token payload is strictly:
  ```javascript
  jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, { expiresIn: '7d' });
  ```
- **Why minimal payload?** JWTs are base64-encoded strings, not encrypted. Anyone with access to the token can decode the payload. Therefore, passwords, hashes, personal identifiable information (PII), or private file keys are never included in the JWT payload.

### Q25: How does CORS protect the backend, and what is EduVault's CORS policy?
**Answer:**
CORS (Cross-Origin Resource Sharing) prevents unauthorized websites from making cross-origin requests to the API on behalf of authenticated users.
- In `app.js`:
  ```javascript
  app.use(cors({
    origin: config.frontendUrl, // e.g., 'http://localhost:5173' or production domain
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  ```
- Browsers enforce this policy by issuing pre-flight `OPTIONS` requests. If an origin does not match `config.frontendUrl`, the browser blocks the response.

---

## 8. Cloud Infrastructure & DevOps (AWS EC2, S3, RDS, EBS, IAM)

### Q26: What is the recommended way to handle AWS IAM credentials in production vs development?
**Answer:**
- **Development / Local Testing:**
  IAM user access keys are stored in `server/.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). `.env` is strictly committed to `.gitignore`.
- **Production on AWS EC2 (Best Practice):**
  **Do NOT use `.env` access keys on EC2**. Instead:
  1. Create an AWS **IAM Role** with an attached policy granting minimal permissions (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`).
  2. Attach this IAM Role directly to the EC2 instance profile.
  3. The AWS SDK v3 automatically fetches temporary rotating credentials from the EC2 Instance Metadata Service (IMDSv2).
  - **Advantage:** No secrets exist on the server filesystem. Even if the server is compromised, there are no static long-lived credentials to steal.

### Q27: What S3 CORS policy is required for browser-to-S3 direct uploads to work?
**Answer:**
Because the React frontend runs on a different origin (e.g., `http://localhost:5173` or `https://eduvault.edu`) than the Amazon S3 bucket endpoint (`https://eduvault-bucket.s3.ap-south-1.amazonaws.com`), the browser checks S3's CORS policy before sending the binary PUT request.

**S3 Bucket CORS Configuration:**
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
Without this configuration, the browser blocks the direct PUT upload with a CORS error.

### Q28: How do AWS Security Groups secure communication between EC2 and RDS MySQL?
**Answer:**
In a production AWS deployment:
1. The **EC2 Security Group** (`sg-ec2`) allows inbound HTTP/HTTPS traffic (ports 80 and 443) from the public internet.
2. The **RDS Security Group** (`sg-rds`) allows inbound MySQL traffic (port 3306) **only from `sg-ec2`**.
3. Direct inbound access to port 3306 from `0.0.0.0/0` is strictly blocked.
- **Benefit:** The MySQL database is inaccessible from the public internet, completely shielded behind the EC2 security group.

---

## 9. Edge Cases, Tough Scenarios & Scalability Extensions

### Q29: What happens if a user gets a pre-signed URL but never uploads the file, or closes the browser mid-way?
**Answer:**
**The Scenario:** The client calls `/presign`, receives a URL, but loses internet connection or closes the browser before completing the upload.
- **In EduVault:**
  - The database remains completely clean because database records are created only in Phase 3 (`/complete`).
  - No orphaned database rows exist.
  - The pre-signed S3 URL expires in 3600 seconds and becomes invalid.
- **In Amazon S3:**
  - If the client never uploaded bytes, no object was created in S3.
  - If the client started a multipart upload and abandoned it, incomplete parts could take up space.
  - **Production Enhancement:** Configure an **S3 Lifecycle Rule** to automatically abort and clean up incomplete multipart uploads after 7 days.

### Q30: What happens if the file upload to S3 succeeds, but the `/complete` API call fails due to a network drop?
**Answer:**
**The Scenario:** S3 received the file and returned 200, but the student's phone disconnected before reaching `/complete`.
- **Current State:** An unreferenced object exists in S3, but MySQL has no record of it.
- **How to handle/recover:**
  1. **Client Retry:** The React client can store the pending upload payload and `s3Key` in `sessionStorage`. Upon reconnecting, it retries the `/complete` call.
  2. **Event-Driven Architecture (Production Scalability):** Instead of relying on the client to call `/complete`, configure an **Amazon S3 Event Notification** $\to$ **Amazon SQS / Lambda** $\to$ backend webhook. Whenever an object is successfully placed in S3, S3 automatically triggers the backend to commit metadata, making the flow 100% resilient to client network drops.

### Q31: How would you scale EduVault to handle 1,000,000 active students?
**Answer:**
To scale EduVault from a single EC2 instance to enterprise scale:
1. **Content Delivery Network (CDN):** Place **Amazon CloudFront** in front of S3 for academic resources. Popular past papers and textbook PDFs are cached at edge locations worldwide, drastically reducing latency and S3 egress costs.
2. **Caching Layer:** Implement **Redis / ElastiCache** for:
   - Category listings and popular search queries.
   - User session metadata and rate-limiting counters.
3. **Database Read Replicas:**
   - Academic resource browsing is $95\%$ reads and $5\%$ writes.
   - Configure Amazon RDS Read Replicas. Route all `GET /api/resources` queries to read replicas and all writes (`POST/PUT/DELETE`) to the primary instance.
4. **Horizontal Autoscaling:** Put the Node.js/Express server in an AWS Auto Scaling Group behind an Application Load Balancer (ALB).
5. **Search Engine:** Replace SQL `LIKE %search%` queries with **Amazon OpenSearch / Elasticsearch** for full-text search, typo tolerance, and relevance ranking.
6. **Asynchronous Processing:** Use AWS SQS and Lambda workers for:
   - Antivirus scanning (ClamAV) on uploaded files before publishing.
   - Automatic PDF thumbnail generation for frontend document previews.

---

## 10. Rapid-Fire Viva & Quick-Review Cheat Sheet

| # | Question | Concise Answer |
|---|----------|----------------|
| **1** | What ORM does EduVault use? | **Prisma ORM 5.x** with MySQL 8.0 dialect. |
| **2** | What is the password hashing algorithm? | **bcrypt** with **12 salt rounds**. |
| **3** | What is the JWT expiration duration? | **7 days** (`7d`). |
| **4** | What is the maximum resource file size limit? | **50 MB** (`MAX_FILE_SIZE = 52428800` bytes). |
| **5** | What is the default user vault storage quota? | **5 GB** (`MAX_VAULT_STORAGE = 5368709120` bytes). |
| **6** | What is the expiration time of S3 pre-signed URLs? | **3600 seconds (1 hour)**. |
| **7** | How are file extensions validated? | Server-side whitelist checking extensions (`.pdf`, `.docx`, `.ppt`, etc.) and MIME types in `config/index.js` and `validate.js`. |
| **8** | How is a file uniquely named in S3? | `${uuidv4()}-${sanitizedFileName}` to prevent naming collisions. |
| **9** | Are public resource uploads admin-approved? | No, they are **immediately published** upon upload completion. |
| **10** | Can an admin deactivate their own account? | No, `toggleUserStatus` in `adminController.js` throws an error if `req.user.id === targetId`. |
| **11** | How does EduVault protect against SQL Injection? | Prisma ORM uses **parameterized queries / prepared statements** by default. |
| **12** | How are BigInt values sent over JSON? | A custom `serializeBigInt` helper converts BigInt values to standard Numbers before serialization. |
| **13** | What happens to bookmarks when a resource is deleted? | MySQL automatically cascades and deletes related bookmarks (`onDelete: Cascade`). |
| **14** | What happens to resources if a category is deleted? | The `categoryId` on resources is set to `NULL` (`onDelete: SetNull`). |
| **15** | Which HTTP headers provide web security? | **Helmet** middleware sets headers including `X-Frame-Options`, `X-Content-Type-Options`, and `HSTS`. |
| **16** | How is the download counter incremented? | Atomically in MySQL using Prisma: `prisma.resource.update({ where: { id }, data: { downloadCount: { increment: 1 } } })`. |
| **17** | What HTTP method is used for direct S3 upload? | **HTTP PUT** with the pre-signed URL and binary file body. |
| **18** | How is IDOR prevented in user vaults? | Every query checks `where: { id: fileId, ownerId: req.user.id }`. |
| **19** | Where is application state stored on the frontend? | In React `AuthContext` with credentials persisted in `localStorage`. |
| **20** | What is the primary benefit of pre-signed URLs? | Shifts heavy binary streaming to Amazon S3, preventing Node.js/EC2 server bottlenecks. |
