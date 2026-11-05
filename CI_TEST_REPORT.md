# AccessLab — End-to-End CI Test Report

**Branch:** end-to-end-ci  
**Date:** 5 November 2026  
**Node.js:** v22.23.4  
**npm:** 10.9.9  
**Environment:** Windows PowerShell

## 1. CI Test Results

| CI Stage | Command | Result |
|---|---|---|
| Dependency installation | npm ci | PASS* |
| ESLint | npm run lint | PASS |
| Prettier | npm run format:check | FAIL |
| Automated tests | npm test -- --run | PASS |
| Production build | npm run build | PASS |

*The standard npm command was initially blocked by the NVM malware-definition check (HTTP 401). Dependency installation succeeded using the installed npm CLI directly through Node.js 22.

## 2. Detailed Results

### Dependency installation
- 366 packages added.
- 367 packages audited.
- 0 vulnerabilities reported.

### ESLint
- Command: npm run lint
- Result: Passed.
- No lint errors reported.

### Prettier formatting
- Command: npm run format:check
- Result: Failed.
- 191 files reported as not matching Prettier formatting rules.
- This is a repository-wide formatting issue.
- All seven files changed for the bookmarklet feature passed an individual Prettier check.

### Automated tests
- Command: npm test -- --run
- Test files passed: 47/47.
- Tests passed: 445/445.
- Tests failed: 0.

### Production build
- Command: npm run build
- Result: Passed.
- Vite version: 8.3.4.
- Modules transformed: 209.
- Build completed in 289 ms.

## 3. Additional Checks

- git status --short: clean.
- git diff --check: passed.
- No tracked source-code changes were left by the testing process.

## 4. Conclusion

Four of the five CI stages passed.

The only failing stage was the repository-wide Prettier formatting check, which reported 191 files with formatting differences.

The seven files changed for the bookmarklet feature passed Prettier individually.

No unrelated files were modified to address the repository-wide formatting issue.

**Note:** These results are from a local Windows run. A fresh GitHub Actions run on this branch has not yet been performed.
