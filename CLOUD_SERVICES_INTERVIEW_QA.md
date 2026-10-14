# ☁️ EduVault: Cloud Services (AWS) Interview Questions & Answers Master Guide

This guide is an in-depth, interview-ready compendium covering every cloud service, deployment concept, security measure, and architectural decision used in **EduVault**. It specifically addresses questions about **Amazon S3, Amazon EC2, Amazon RDS (MySQL), Amazon EBS, AWS IAM, VPC Security Groups, and Cloud DevOps**.

---

## 📑 Table of Contents

1. [Cloud Architecture & Service Overview](#1-cloud-architecture--service-overview)
2. [Amazon S3 (Simple Storage Service) Deep Dive](#2-amazon-s3-simple-storage-service-deep-dive)
3. [Amazon EC2 (Elastic Compute Cloud) Deep Dive](#3-amazon-ec2-elastic-compute-cloud-deep-dive)
4. [Amazon EBS (Elastic Block Store) vs Amazon S3](#4-amazon-ebs-elastic-block-store-vs-amazon-s3)
5. [Amazon RDS (Relational Database Service - MySQL) Deep Dive](#5-amazon-rds-relational-database-service---mysql-deep-dive)
6. [AWS IAM (Identity and Access Management) & Security](#6-aws-iam-identity-and-access-management--security)
7. [Cloud Networking & Security Groups (VPC)](#7-cloud-networking--security-groups-vpc)
8. [Deployment Workflow & Server Management](#8-deployment-workflow--server-management)
9. [Cost Optimization, Monitoring & Free Tier Strategy](#9-cost-optimization-monitoring--free-tier-strategy)
10. [Tricky / Trap Cloud Interview Questions](#10-tricky--trap-cloud-interview-questions)

---

## 1. Cloud Architecture & Service Overview

### Q1: Which cloud provider and services did you use for EduVault, and why?
**Answer:**
EduVault is deployed on **Amazon Web Services (AWS)** using the following core services:
1. **Amazon S3 (Simple Storage Service):** Primary cloud object storage for all uploaded files (both public academic resources and private user vault files).
2. **Amazon EC2 (Elastic Compute Cloud):** Compute instance hosting the Node.js / Express REST API backend and reverse proxy.
3. **Amazon EBS (Elastic Block Store):** Persistent block storage attached to the EC2 instance for hosting the operating system, application code, Node.js runtime, dependencies (`node_modules`), and server logs.
4. **Amazon RDS (Relational Database Service - MySQL 8.0):** Managed relational database instance storing structured metadata (users, categories, resources, tags, bookmarks, activity logs).
5. **AWS IAM (Identity & Access Management):** Access management service defining roles and least-privilege security policies for EC2-to-S3 access.
6. **AWS Security Groups (VPC):** Virtual firewalls controlling network ingress and egress between the internet, EC2, and RDS.

**Why AWS?**
- **Ecosystem Integration:** Seamless integration between EC2, S3, RDS, and IAM roles without needing third-party middleware.
- **Pre-signed URL SDK Support:** First-class support via `@aws-sdk/s3-request-presigner` for client-side direct uploads.
- **Industry Standard & Scalability:** Matches production enterprise standards for cloud computing, making the MCA major project production-ready.

---

### Q2: Can you draw and explain the AWS Cloud Architecture of EduVault?
**Answer:**

```
                  ┌──────────────────────────────────────────────┐
                  │                 PUBLIC INTERNET              │
                  │   Users / Students accessing the platform    │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
            1. HTTPS REST API    │                │ 2. Direct S3 Upload / Download
               (Port 80/443)     │                │    via Pre-signed URLs
                                 │                │    (HTTPS Port 443)
                                 ▼                ▼
┌────────────────────────────────────────────┐  ┌─────────────────────────────────┐
│              AWS CLOUD REGION              │  │        AMAZON S3 BUCKET         │
│          (ap-south-1 / Mumbai)             │  │   eduvault-bucket (Private)     │
│                                            │  │ ┌─────────────────────────────┐ │
│ ┌────────────────────────────────────────┐ │  │ │ resources/                  │ │
│ │          VPC / PUBLIC SUBNET           │ │  │ │   NOTES/, BOOK/, ASSIGNMENT/│ │
│ │                                        │ │  │ ├─────────────────────────────┤ │
│ │ ┌────────────────────────────────────┐ │ │  │ │ private/users/{userId}/     │ │
│ │ │           EC2 INSTANCE             │ │ │  │ │   Isolated Personal Files   │ │
│ │ │       (Ubuntu / Amazon Linux)      │ │ │  │ └─────────────────────────────┘ │
│ │ │                                    │ │ │  └────────────────┬────────────────┘
│ │ │  [IAM Role Attached: EC2-S3-Access]│ │ │                   │
│ │ │  ├── Node.js + Express API         │ │ │  Signs Pre-signed │
│ │ │  ├── Nginx (Reverse Proxy)         │ │ ┼──URLs via AWS SDK─┘
│ │ │  └── PM2 Process Manager           │ │ │  (PutObject / GetObject)
│ │ └─────────────────┬──────────────────┘ │ │
│ │                   │                    │ │
│ │    Attached Block │ Storage            │ │
│ │ ┌─────────────────▼──────────────────┐ │ │
│ │ │           EBS VOLUME               │ │ │
│ │ │  - OS Files & Linux Kernel         │ │ │
│ │ │  - Node.js runtime & App code      │ │ │
│ │ │  - node_modules & Prisma binaries  │ │ │
│ │ │  - Local server logs               │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └───────────────────┬────────────────────┘ │
│                     │ Internal TCP 3306    │
│                     │ (Restricted to EC2)  │
│ ┌───────────────────▼────────────────────┐ │
│ │          PRIVATE RDS SUBNET            │ │
│ │ ┌────────────────────────────────────┐ │ │
│ │ │       AMAZON RDS MySQL 8.0         │ │ │
│ │ │       (Metadata & Relationships)   │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

---

## 2. Amazon S3 (Simple Storage Service) Deep Dive

### Q3: "Did you upload your server files to S3?" — How does an interviewer ask this, and what is the exact answer?
**Answer:**
**The Trap:** Interviewers often ask: *"Did you upload your server files / backend code to Amazon S3?"* or *"Where does your server live in S3?"*
**The Correct Answer:**
> **"No, server application files are NOT hosted in Amazon S3. The Node.js and Express backend server files reside on an Amazon EC2 instance's attached Amazon EBS block volume.**
>
> **Amazon S3 is an Object Storage service used strictly for storing user-uploaded binary assets (academic PDF documents, lecture presentations, notes, and private student vault files).**
>
> **A compute application with dynamic API routes and socket listeners (like Express.js) requires a server CPU and persistent runtime execution environment, which is provided by Amazon EC2, not S3."**

*(Note: In frontend-only static websites, compiled React production bundles can be placed in S3 and served via CloudFront, but backend Express server code runs on EC2).*

---

### Q4: How are files actually uploaded to Amazon S3 in this project? Walk through the AWS SDK calls.
**Answer:**
EduVault uses the **AWS SDK v3 for JavaScript** (`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`) using a **pre-signed URL pattern**:

1. **S3 Client Initialization (`server/src/config/s3.js`):**
   ```javascript
   const { S3Client } = require('@aws-sdk/client-s3');
   const config = require('./index');

   const s3Client = new S3Client({
     region: config.aws.region, // e.g., 'ap-south-1'
     credentials: config.aws.accessKeyId ? {
       accessKeyId: config.aws.accessKeyId,
       secretAccessKey: config.aws.secretAccessKey,
     } : undefined // If undefined, automatically pulls from EC2 IAM Role
   });
   ```

2. **Generating the Pre-signed Upload URL (`server/src/services/s3Service.js`):**
   ```javascript
   const { PutObjectCommand } = require('@aws-sdk/client-s3');
   const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

   const generateUploadPresignedUrl = async (key, contentType, expiresIn = 3600) => {
     const command = new PutObjectCommand({
       Bucket: config.aws.s3BucketName,
       Key: key,
       ContentType: contentType,
     });
     return getSignedUrl(s3Client, command, { expiresIn });
   };
   ```

3. **Direct Browser-to-S3 Upload (`client/src/services/api.js`):**
   The browser receives the signed URL and issues an HTTP `PUT` request with binary data directly to the S3 bucket:
   ```javascript
   await axios.put(presignedUrl, file, {
     headers: { 'Content-Type': file.type },
     onUploadProgress: (progressEvent) => { ... }
   });
   ```

4. **Why this matters for Cloud Architecture:**
   - Zero file byte traffic passes through the EC2 instance.
   - S3 handles high-concurrency binary streaming natively.
   - EC2 CPU and memory remain unencumbered.

---

### Q5: How do you handle file downloads from Amazon S3? How do you ensure downloads have the correct filename?
**Answer:**
Because the bucket is 100% private, users cannot directly access object URLs. Downloads use **Pre-signed `GetObject` URLs** with dynamic HTTP headers:

```javascript
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const generateDownloadPresignedUrl = async (key, expiresIn = 3600, originalFileName) => {
  const command = new GetObjectCommand({
    Bucket: config.aws.s3BucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${originalFileName}"`
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};
```
**Key Technical Detail (`ResponseContentDisposition`):**
- In S3, files are stored using UUIDs (e.g., `resources/NOTES/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-datastructures.pdf`) to prevent naming collisions.
- The `ResponseContentDisposition` parameter instructs S3 to inject an HTTP header into the download response that forces the student's browser to prompt a download with the human-readable `originalFileName` (e.g., `"Data Structures Midterm Notes.pdf"`).

---

### Q6: How is the Amazon S3 Bucket structured? What is your object key naming convention?
**Answer:**
EduVault uses a hierarchical, prefix-partitioned key structure within a single S3 bucket:

```
s3://your-eduvault-bucket/
├── resources/                          # Public Academic Namespace
│   ├── NOTES/
│   │   └── <uuidv4>-<sanitizedFileName>.pdf
│   ├── BOOK/
│   │   └── <uuidv4>-<sanitizedFileName>.pdf
│   ├── QUESTION_PAPER/
│   ├── ASSIGNMENT/
│   ├── STUDY_MATERIAL/
│   └── LAB_RESOURCE/
│
└── private/                            # Private Student Vault Namespace
    └── users/
        ├── 1/                          # Student User ID 1
        │   └── <uuidv4>-<sanitizedFileName>.docx
        ├── 2/                          # Student User ID 2
        └── ...
```

**Key Helper Functions (`s3Service.js`):**
- Academic Resources: `generateResourceKey(resourceType, originalFileName)`:
  `resources/${resourceType}/${uuidv4()}-${sanitizedFileName}`
- Private Vault: `generateVaultKey(userId, originalFileName)`:
  `private/users/${userId}/${uuidv4()}-${sanitizedFileName}`
- `sanitizeFileName`: Replaces any non-alphanumeric character (except dots, hyphens, and underscores) with `_` to guarantee URL and S3 key safety.

---

### Q7: What CORS (Cross-Origin Resource Sharing) policy is required on the S3 bucket and why?
**Answer:**
When a browser executes an `axios.put(presignedUrl, file)` from a frontend running on `http://localhost:5173` or `https://eduvault.edu` towards `https://eduvault-bucket.s3.ap-south-1.amazonaws.com`, the browser recognizes a cross-origin request.
Before sending the upload, the browser issues an `OPTIONS` preflight check. Without an explicit S3 CORS configuration, S3 rejects the request with HTTP 403.

**Configured S3 CORS JSON:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://eduvault.edu"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
- `AllowedMethods`: Includes `PUT` for uploads, `GET` for downloads.
- `ExposeHeaders`: Exposes `ETag` so the client can verify MD5 hash integrity if needed.
- `MaxAgeSeconds`: Caches preflight responses for 1 hour to reduce unnecessary OPTIONS requests.

---

### Q8: How does file deletion work on Amazon S3?
**Answer:**
EduVault implements two deletion methods in `s3Service.js`:
1. **Single File Deletion (`DeleteObjectCommand`):**
   ```javascript
   const deleteS3Object = async (key) => {
     const command = new DeleteObjectCommand({
       Bucket: config.aws.s3BucketName,
       Key: key,
     });
     return s3Client.send(command);
   };
   ```
   Invoked when a user deletes a vault file or an admin deletes a resource.
2. **Bulk File Deletion (`DeleteObjectsCommand`):**
   ```javascript
   const deleteMultipleS3Objects = async (keys) => {
     if (!keys || keys.length === 0) return;
     const command = new DeleteObjectsCommand({
       Bucket: config.aws.s3BucketName,
       Delete: {
         Objects: keys.map(key => ({ Key: key })),
         Quiet: false,
       },
     });
     return s3Client.send(command);
   };
   ```
   Used when purging multiple files or cleaning up user data during account termination.

---

## 3. Amazon EC2 (Elastic Compute Cloud) Deep Dive

### Q9: What is the role of Amazon EC2 in EduVault? How did you configure it?
**Answer:**
Amazon EC2 provides resizable virtual compute capacity (an Amazon Machine Image - AMI virtual server) in the cloud.
In EduVault, the EC2 instance acts as the **central application gateway and business logic host**:
- Runs the Node.js (v18+) runtime environment.
- Hosts the Express.js API server listening on port 5000 (or reverse-proxied on 80/443).
- Executes Prisma ORM queries to connect to Amazon RDS MySQL over VPC.
- Interfaces with AWS S3 using AWS SDK v3 to generate cryptographic pre-signed URLs.
- Executes JWT validation, bcrypt password hashing, and role authorization.

**Instance Specifications Chosen:**
- **Instance Type:** `t2.micro` or `t3.micro` (1 vCPU, 1 GB RAM — fits in AWS Free Tier).
- **OS:** Ubuntu Server 22.04 LTS or Amazon Linux 2023.
- **Architecture:** x86_64 (amd64) or ARM64 (Graviton `t4g.micro` for lower cost and high efficiency).

---

### Q10: How do you keep the Node.js backend alive 24/7 on an EC2 instance?
**Answer:**
If you simply run `node src/server.js` in an SSH terminal session, the server terminates as soon as you close the SSH connection.
EduVault uses a production Process Manager: **PM2** (or `systemd` Linux service):

1. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```
2. **Start the application:**
   ```bash
   pm2 start server/src/server.js --name "eduvault-api"
   ```
3. **Configure automatic restart on system reboot:**
   ```bash
   pm2 startup
   pm2 save
   ```
**Benefits of PM2:**
- **Auto-restart on crash:** If an unhandled exception occurs, PM2 restarts the process immediately.
- **Zero-downtime reloads:** Supports `pm2 reload` when updating code.
- **Log Management:** Automatically aggregates `stdout` and `stderr` logs to disk.
- **Resource Monitoring:** Monitors memory and CPU usage per process via `pm2 monit`.

---

### Q11: Why is an Nginx reverse proxy recommended in front of Node.js on EC2?
**Answer:**
While Node.js can listen on port 80/443 directly, placing **Nginx** as a reverse proxy in front of Node.js is industry best practice:
1. **Privileged Ports:** Ports 80 (HTTP) and 443 (HTTPS) require root privileges in Linux. Running Node.js as `root` is a security risk. Nginx runs as non-root and forwards requests to Node.js running on unprivileged port 5000.
2. **SSL/TLS Termination:** Nginx handles SSL/TLS handshakes using Let's Encrypt / Certbot, freeing Node.js from CPU-heavy cryptographic operations.
3. **Static File Serving:** Nginx can serve static assets (e.g., the compiled React production bundle from `client/dist`) at kernel speed (`sendfile`).
4. **DDoS & Rate Limiting:** Nginx provides built-in rate-limiting directives (`limit_req_zone`) to mitigate brute-force and Denial-of-Service attacks before they hit the Node.js event loop.
5. **Gzip Compression:** Nginx compresses API JSON responses on the fly.

---

## 4. Amazon EBS (Elastic Block Store) vs Amazon S3

### Q12: Compare Amazon EBS and Amazon S3 in the context of this project. Why can't we store all files on EBS?
**Answer:**

| Feature | Amazon EBS (Elastic Block Store) | Amazon S3 (Simple Storage Service) |
|---|---|---|
| **Storage Type** | Block Storage (Raw unformatted virtual disk) | Object Storage (Key-value REST object store) |
| **Accessibility** | Mounted only to a **single EC2 instance** | Accessible from **anywhere via HTTP/S REST API** |
| **EduVault Usage** | OS, Node.js code, `node_modules`, logs | Academic notes, books, user vault files |
| **Scalability** | Fixed volume size (e.g., 20 GB). Must be resized manually. | Infinite horizontal scalability (virtually unlimited) |
| **Availability / Durability** | $99.999\%$ durability within a single Availability Zone (AZ) | **$99.999999999\%$ (11 9's)** durability across $\ge 3$ AZs |
| **Cost Model** | Billed per provisioned GB/month regardless of usage | Billed only for actual stored GB and request count |
| **Multi-instance Sharing** | Cannot be easily shared across multiple servers | Infinitely shared across web, mobile, and serverless workers |

**Why we can't store user files on EBS:**
1. **Horizontal Scaling Bottleneck:** If traffic spikes and we spin up a second EC2 instance behind a load balancer, files stored on Instance A's EBS disk would be invisible to Instance B.
2. **Single Point of Failure:** If the EC2 instance or its Availability Zone experiences an outage, student documents on EBS become inaccessible.
3. **Disk Exhaustion:** If students upload 100GB of materials, EBS runs out of disk space, crashing the operating system. S3 scales automatically without disk management.

---

## 5. Amazon RDS (Relational Database Service - MySQL) Deep Dive

### Q13: Why did you use Amazon RDS MySQL instead of installing MySQL locally on the EC2 instance?
**Answer:**
Running MySQL directly on the EC2 instance is possible, but **Amazon RDS** was chosen for distinct architectural reasons:
1. **Decoupled Architecture (Stateless App Tier):** By separating compute (EC2) from state (RDS), the EC2 instance becomes completely stateless. We can restart, replace, resize, or autoscale EC2 instances without touching the database.
2. **Automated Backups & Point-in-Time Recovery (PITR):** RDS automatically captures daily backups and transaction logs, allowing restoration to any second in the retention window (up to 35 days).
3. **Automated OS & Database Patching:** AWS handles database engine maintenance, security patches, and minor version upgrades.
4. **Hardware Fault Tolerance:** In production, RDS Multi-AZ synchronously replicates data to a standby instance in a different Availability Zone with automatic failover in $< 60$ seconds.
5. **Resource Isolation:** MySQL queries and indexing do not compete with Node.js and bcrypt for CPU cycles and RAM.

---

### Q14: How does the Node.js server connect to Amazon RDS MySQL? Explain the Prisma connection string.
**Answer:**
The application connects via the standard MySQL TCP protocol using Prisma ORM:

```env
DATABASE_URL="mysql://admin:YourSecurePassword@your-rds-instance.c12345678.ap-south-1.rds.amazonaws.com:3306/eduvault"
```

**Deconstruction of the Connection String:**
- `mysql://`: Protocol scheme.
- `admin`: RDS master database username.
- `YourSecurePassword`: Database user authentication password.
- `your-rds-instance...rds.amazonaws.com`: RDS endpoint DNS name assigned by AWS.
- `3306`: Default MySQL database port.
- `/eduvault`: Name of the logical database schema created on the instance.

**Prisma Client Integration (`server/src/config/database.js`):**
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```
Prisma manages an internal connection pool, automatically reusing active database connections across API requests.

---

### Q15: How are database migrations executed on Amazon RDS?
**Answer:**
During local development, developers run:
```bash
npx prisma migrate dev --name init
```
This generates SQL migration files in `server/prisma/migrations/`.

**Production Deployment Execution on RDS:**
When deploying to AWS, we run:
```bash
npx prisma migrate deploy
```
- **Why `migrate deploy` instead of `migrate dev`?**
  `migrate deploy` applies pending SQL migration files against the target RDS database without resetting data, without prompting for interactive confirmations, and without generating local schema changes.
- To populate initial categories and admin accounts:
  ```bash
  npx prisma db seed
  ```

---

## 6. AWS IAM (Identity and Access Management) & Security

### Q16: What is the difference between an IAM User and an IAM Role? Which one did you use for EC2?
**Answer:**

| Property | IAM User | IAM Role (Recommended for EC2) |
|---|---|---|
| **Identity Type** | Permanent identity representing a person or external application | Temporary identity assumed by an AWS service (like EC2) |
| **Credentials** | Long-term `Access Key ID` & `Secret Access Key` | **Temporary security tokens (STS)** rotated automatically |
| **Storage** | Hardcoded in `.env` or config files | **Zero credentials on disk**; fetched via Instance Metadata |
| **Security Risk** | High risk if `.env` is accidentally leaked or committed | Zero credential leakage risk from code or disk |

**The EduVault Production Best Practice:**
- Attach an **IAM Role** (e.g., `EduVault-EC2-S3-Role`) to the EC2 instance profile.
- The AWS SDK v3 automatically checks the EC2 Instance Metadata Service (IMDSv2 at `http://169.254.169.254/latest/meta-data/`) to fetch temporary rotating credentials.
- In `server/src/config/s3.js`, if `AWS_ACCESS_KEY_ID` is omitted, the SDK defaults to the instance role credentials seamlessly.

---

### Q17: Write the exact IAM Policy JSON required for EduVault to interact with Amazon S3.
**Answer:**
Following the **Principle of Least Privilege**, the policy grants only the specific actions required on the specific bucket ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ObjectActions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:DeleteObjects"
      ],
      "Resource": "arn:aws:s3:::eduvault-bucket/*"
    },
    {
      "Sid": "AllowBucketListing",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::eduvault-bucket"
    }
  ]
}
```
**Why these specific permissions?**
- `s3:PutObject`: Required to generate pre-signed upload URLs.
- `s3:GetObject`: Required to generate pre-signed download URLs.
- `s3:DeleteObject` & `s3:DeleteObjects`: Required when users delete files from the vault or admin deletes resources.
- `s3:ListBucket`: Evaluated on the bucket ARN itself (`arn:aws:s3:::eduvault-bucket`), used for bucket verification.
- **Notice what is absent:** No `s3:CreateBucket`, no `s3:DeleteBucket`, no `s3:PutBucketPolicy`. Destructive infrastructure actions are completely prohibited.

---

## 7. Cloud Networking & Security Groups (VPC)

### Q18: How did you configure AWS Security Groups to protect the database from the public internet?
**Answer:**
EduVault uses a multi-tier firewall configuration via **VPC Security Groups**:

```
[Public Internet] 
       │ 
       ▼ HTTPS (Port 443) / HTTP (Port 80)
┌──────────────────────────────────────────────┐
│ EC2 Security Group (`sg-eduvault-backend`)   │
│ Inbound:                                     │
│ - Port 80   (HTTP)  from 0.0.0.0/0           │
│ - Port 443  (HTTPS) from 0.0.0.0/0           │
│ - Port 22   (SSH)   from Admin My-IP ONLY    │
└──────────────────────┬───────────────────────┘
                       │ 
                       ▼ MySQL (Port 3306)
┌──────────────────────────────────────────────┐
│ RDS Security Group (`sg-eduvault-database`)  │
│ Inbound:                                     │
│ - Port 3306 (MySQL) ONLY from                │
│   Source: `sg-eduvault-backend` (Security    │
│   Group ID reference, NOT an IP address!)    │
│                                              │
│ Inbound from 0.0.0.0/0: STRICTLY DENIED      │
└──────────────────────────────────────────────┘
```

**Key Security Concept (Security Group Referencing):**
Instead of allowing an IP address into RDS, the RDS security group rule specifies the **ID of the EC2 Security Group** (`sg-eduvault-backend`).
- Even if the EC2 instance's IP changes upon reboot or autoscaling, RDS dynamically trusts any instance belonging to that security group.
- The database is completely unroutable and invisible from the public internet.

---

## 8. Deployment Workflow & Server Management

### Q19: Step-by-step: How did you deploy EduVault onto AWS?
**Answer:**
Here is the complete end-to-end deployment runbook:

1. **Step 1: Database Provisioning:**
   - Create an RDS MySQL 8.0 instance in the target region (`ap-south-1`).
   - Create database `eduvault`.
   - Set security group to accept traffic on port 3306 from the EC2 security group.

2. **Step 2: S3 Bucket Provisioning:**
   - Create private S3 bucket `eduvault-files-prod`.
   - Enable "Block All Public Access".
   - Apply S3 CORS JSON policy.

3. **Step 3: EC2 Setup & IAM Configuration:**
   - Launch Ubuntu 22.04 LTS instance (`t3.micro`).
   - Attach IAM Role with S3 permissions.
   - SSH into the instance: `ssh -i key.pem ubuntu@<ec2-public-ip>`.
   - Install system dependencies:
     ```bash
     sudo apt update && sudo apt install -y nodejs npm nginx git
     sudo npm install -g pm2
     ```

4. **Step 4: Application Deployment:**
   - Clone repository: `git clone <repo-url> EDUVAULT`.
   - Navigate to `server`:
     ```bash
     cd EDUVAULT/server
     npm install --production
     cp .env.example .env
     ```
   - Configure `.env` with `DATABASE_URL`, `JWT_SECRET`, `S3_BUCKET_NAME`, and `AWS_REGION`.
   - Run database migrations: `npx prisma migrate deploy && npx prisma db seed`.
   - Start backend via PM2: `pm2 start src/server.js --name "eduvault-api"`.

5. **Step 5: Frontend Build & Nginx Configuration:**
   - Navigate to `client`:
     ```bash
     cd ../client
     npm install
     npm run build
     ```
   - Configure Nginx (`/etc/nginx/sites-available/default`) to serve `client/dist` statically for web routes and proxy `/api/*` to `http://localhost:5000`.
   - Reload Nginx: `sudo systemctl restart nginx`.

---

## 9. Cost Optimization, Monitoring & Free Tier Strategy

### Q20: Can this entire architecture run within the AWS Free Tier? What are the limits?
**Answer:**
**Yes!** EduVault is specifically architected to be 100% compatible with the **AWS 12-Month Free Tier**:
- **Amazon EC2:** 750 hours/month of `t2.micro` or `t3.micro` instances (sufficient to run 1 instance 24/7 all month).
- **Amazon EBS:** 30 GB of General Purpose SSD (gp2 / gp3) storage.
- **Amazon RDS:** 750 hours/month of `db.t2.micro` or `db.t3.micro` or `db.t4g.micro` MySQL database, plus 20 GB of database storage and 20 GB of automated backup storage.
- **Amazon S3:** 5 GB of standard S3 storage, 20,000 `GET` requests, and 2,000 `PUT` requests per month.

**How EduVault avoids unexpected cloud charges:**
1. **Pre-signed URL Efficiency:** Avoids EC2 data transfer out (bandwidth egress) charges because uploads and downloads connect directly with S3.
2. **Quota Limiting:** Users have a strict 5 GB vault quota, preventing accidental bucket storage blowouts.
3. **50 MB File Cap:** Prevents single users from exhausting request or bandwidth thresholds.

---

### Q21: What S3 Lifecycle Rules would you configure for cost optimization in a large-scale academic university?
**Answer:**
In an academic setting, resources have distinct seasonal access patterns:
- Lecture notes and past exam papers uploaded in 2022 are accessed frequently during finals, but rarely accessed three years later.
- Students who graduate leave files in their vault that are rarely touched.

**Configured S3 Lifecycle Policy:**
1. **Transition to S3 Standard-IA (Infrequent Access) after 90 days:**
   Storage cost drops from $\$0.023/\text{GB}$ to $\$0.0125/\text{GB}$ ($\sim 45\%$ cost savings) while preserving millisecond retrieval times.
2. **Transition archived student vaults to S3 Glacier Flexible Deep Archive after 365 days:**
   Storage cost drops to $\$0.00099/\text{GB}$ ($\sim 95\%$ cost savings).
3. **Abort Incomplete Multipart Uploads after 7 days:**
   Automatically purges uncommitted upload fragments from abandoned browser sessions, eliminating silent storage leaks.

---

## 10. Tricky / Trap Cloud Interview Questions

### Q22: "If someone intercepts the pre-signed upload URL in their browser network tab, can they use it to overwrite other files in your S3 bucket?"
**Answer:**
**No, absolutely not.**
- A pre-signed upload URL is cryptographically bound to **one exact S3 Object Key** and **one specific HTTP method (`PUT`)**:
  - The S3 Key was generated server-side: `resources/NOTES/<unique-uuid>-notes.pdf`.
  - The signature incorporates the bucket name, the exact key, the HTTP method, the query string parameters, and the expiration timestamp signed with the server's IAM credentials.
- If an attacker attempts to modify the URL to upload to a different path (e.g., `private/users/admin/hack.pdf`), the AWS signature recalculation fails, and Amazon S3 rejects the request with HTTP `403 SignatureDoesNotMatch`.
- Furthermore, the URL expires after 3600 seconds.

---

### Q23: "What happens if your EC2 instance crashes or terminates? Do you lose your database data and student files?"
**Answer:**
**No data is lost.**
- **Application Code & Runtime:** Re-instantiated from GitHub / Docker image.
- **Database (RDS):** RDS runs as an independent, fully managed instance. Terminating EC2 has zero impact on RDS MySQL tables or transactions.
- **Files (S3):** S3 is completely independent object storage with 11 9's durability. Terminating EC2 has zero impact on files in S3.
- Because the backend is stateless, launching a replacement EC2 instance and pointing its `.env` to the existing RDS endpoint and S3 bucket restores full platform functionality immediately.

---

### Q24: "Why didn't you host your frontend on S3 Static Website Hosting?"
**Answer:**
Hosting a static React build on S3 + CloudFront is a valid architecture, but for our deployment:
- **Simplicity:** Serving the built frontend via Nginx on the EC2 instance allows a single domain name to serve both client and API routes (e.g., `https://eduvault.com/` for React and `https://eduvault.com/api/` for Express) without needing cross-domain CORS configurations or separate DNS mappings.
- **Production Scalability Evolution:** If we scale to millions of users, decoupling the frontend to **Amazon S3 + Amazon CloudFront CDN** would be the logical next step, reducing EC2 web traffic to pure API JSON handling.

---

### Q25: "How does the AWS SDK v3 differ from SDK v2 in your backend implementation?"
**Answer:**
EduVault specifically uses **AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`):
1. **Modular Architecture:** In SDK v2, importing `aws-sdk` required bundling the entire multi-megabyte monolithic package containing every AWS service (DynamoDB, SQS, EC2, etc.). SDK v3 allows importing only the specific modular clients needed (`@aws-sdk/client-s3`), dramatically reducing `node_modules` size, memory footprint, and cold-start times.
2. **Command Pattern:** Operations use explicit command classes (`new PutObjectCommand(...)`, `new GetObjectCommand(...)`, `s3Client.send(command)`), making code cleaner, type-safe, and tree-shakeable.
3. **Dedicated Presigner Module:** `@aws-sdk/s3-request-presigner` cleanly separates signed URL generation logic from client execution.

---

## 11. Cloud Services Quick Reference Table

| Cloud Service | Primary Purpose in EduVault | Storage / Compute Mechanism | Security / Access Control |
|---|---|---|---|
| **Amazon S3** | Binary asset storage (academic resources + private vaults) | Object Store (Bucket / Prefix / Key) | 100% Private, Block Public Access, Pre-signed URLs |
| **Amazon EC2** | Application host for Node.js / Express API | Virtual Machine (vCPU, RAM, Linux OS) | Security Group (Ports 80, 443, 22), IAM Role |
| **Amazon EBS** | Persistent local disk for EC2 | Block Volume (Attached SSD) | Bound to single EC2 instance, encrypted at rest |
| **Amazon RDS** | Relational metadata store (Users, Categories, Tags) | Managed MySQL 8.0 Engine | Isolated in private subnet, Port 3306 open only to EC2 |
| **AWS IAM** | Identity & role delegation | IAM Policies & EC2 Instance Profile | Least-privilege policy, rotating STS credentials |
| **VPC Sec Groups**| Network traffic firewalls | Statefull packet filtering | Explicit ingress rules, security group ID referencing |
