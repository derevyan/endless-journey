# Dependency Audit (Supply Chain Security)

## 🎯 Mission
Analyze the project's dependencies for vulnerabilities, license issues, and bloat.

## 🛡️ Audit Checklist

### 1. Vulnerability Scan
- Run `pnpm audit`.
- Identify high-risk packages.

### 2. Dependency Bloat
- Find unused packages (e.g. using `depcheck`).
- Identify duplicate libraries (e.g. two different date-fns versions).

### 3. Outdated Packages
- Identify critical libraries that are more than 2 major versions behind.

### 4. License Check
- Ensure all packages comply with project's license policy.

---

## 🚀 Output
List packages to **Remove**, **Update**, or **Replace**.
