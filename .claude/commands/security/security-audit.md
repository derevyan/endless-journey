# Security Audit (System Integrity)

## 🎯 Mission
Audit the codebase for security vulnerabilities, data leaks, and unsafe patterns.

## 🛡️ Audit Checklist

### 1. Data Sanitization
- Are user inputs sanitized before being used in DB queries or HTML?
- Check for `dangerouslySetInnerHTML`.

### 2. Authentication & Authorization
- Verify that every API route has an auth check.
- Check service layer for RBAC (Role Based Access Control) logic.

### 3. Environment & Secrets
- Ensure no secrets are hardcoded.
- Audit `.env.example` vs usage.

### 4. Injection Prevention
- Drizzle ORM usage: Ensure no raw SQL interpolation without parameterization.

---

## 🚀 Output
Report all vulnerabilities categorized by severity: **CRITICAL**, **HIGH**, **MEDIUM**, **LOW**.
