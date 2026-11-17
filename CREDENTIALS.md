# 🎓 EduVault — Demo Credentials & Access Notes

This document contains all login credentials for the **EduVault** platform, including the Super Admin account and the 10 dummy student user accounts created for testing, demonstrations, and viva presentations.

---

## 🌐 Live Access URLs

| Access Type | URL |
| :--- | :--- |
| **Primary Domain (HTTPS - Secure)** | [https://eduvaults.duckdns.org](https://eduvaults.duckdns.org) |
| **Elastic IP Direct URL (HTTP)** | [http://3.6.182.140](http://3.6.182.140) |
| **API Health Check** | [http://3.6.182.140/api/health](http://3.6.182.140/api/health) |

---

## 🛡️ Super Admin Credentials

The Admin account has full platform permissions: user management, category CRUD, storage quota adjustment, activity log inspection, and platform statistics.

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Role** | `ADMIN` | Full administrative privileges |
| **Email** | `admin@eduvault.com` | Primary administrator account |
| **Password** | `Admin@123` | *Case-sensitive (Capital 'A')* |
| **Dashboard URL** | [http://3.6.182.140/admin](http://3.6.182.140/admin) | Accessible after login |

---

## 👥 Dummy Student User Accounts (10 Accounts)

All dummy student accounts have the standard `USER` role. They can browse resources, upload public academic materials, bookmark items, and manage their isolated private storage in **My Vault** (default quota: 5 GB).

> **Universal Password for All Student Accounts:** `User@123` *(Capital 'U')*

| # | Student Name | Email Address | Role | Password | Storage Quota |
| :-: | :--- | :--- | :-: | :--- | :-: |
| 1 | **Aarav Sharma** | `aarav@eduvault.com` | `USER` | `User@123` | 5 GB |
| 2 | **Priya Patel** | `priya@eduvault.com` | `USER` | `User@123` | 5 GB |
| 3 | **Rahul Verma** | `rahul@eduvault.com` | `USER` | `User@123` | 5 GB |
| 4 | **Sneha Reddy** | `sneha@eduvault.com` | `USER` | `User@123` | 5 GB |
| 5 | **Vikram Singh** | `vikram@eduvault.com` | `USER` | `User@123` | 5 GB |
| 6 | **Ananya Iyer** | `ananya@eduvault.com` | `USER` | `User@123` | 5 GB |
| 7 | **Rohan Gupta** | `rohan@eduvault.com` | `USER` | `User@123` | 5 GB |
| 8 | **Neha Joshi** | `neha@eduvault.com` | `USER` | `User@123` | 5 GB |
| 9 | **Aditya Nair** | `aditya@eduvault.com` | `USER` | `User@123` | 5 GB |
| 10 | **Pooja Mehta** | `pooja@eduvault.com` | `USER` | `User@123` | 5 GB |

---

## 🧪 Additional Test Users (From Database Seed)

| # | User Name | Email Address | Role | Password |
| :-: | :--- | :--- | :-: | :--- |
| 11 | **Test User 1** | `user1@eduvault.com` | `USER` | `User@123` |
| 12 | **Test User 2** | `user2@eduvault.com` | `USER` | `User@123` |

---

## ☁️ AWS Cloud Infrastructure Reference

| Service | Identifier / Name | Configuration |
| :--- | :--- | :--- |
| **AWS Region** | `ap-south-1` | Asia Pacific (Mumbai) |
| **Amazon EC2** | `eduvault-server` | Ubuntu 24.04 LTS (`t2.micro` / `t3.micro`), 20 GiB gp3 |
| **Elastic IP** | `3.6.182.140` | Static Public IPv4 (Permanent) |
| **Amazon RDS** | `eduvault-db` | MySQL 8.0 Free Tier |
| **Amazon S3** | `eduvault-storage-arun` | Private Bucket (Pre-signed URL uploads/downloads) |
| **AWS IAM** | `EduVault-EC2-S3-Role` | EC2 Instance Profile with S3 permissions |
| **Web Server** | Nginx | Reverse proxy on Port 80/443 |
| **Process Manager** | PM2 | Daemon: `eduvault-api` (Port 5000) |
