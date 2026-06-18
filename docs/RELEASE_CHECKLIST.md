# Release Checklist

## Bobby's Workshop - Release Validation Checklist

**Purpose:** Ensure every release meets quality, safety, and functionality standards before shipping.

---

## Pre-Release Phase

### 1. Code Quality

- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds without errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console errors or warnings in production build
- [ ] Dependencies updated and audited (`npm audit`)
- [ ] No high/critical security vulnerabilities

### 2. Documentation

- [ ] README.md updated with new features
- [ ] CHANGELOG.md updated with all changes
- [ ] PRD.md reflects current product state
- [ ] ROADMAP.md updated with next milestones
- [ ] API documentation updated (if API changes)
- [ ] Migration guide created (if breaking changes)

### 3. Safety & Security

- [ ] No secrets or credentials in codebase
- [ ] All destructive operations require explicit confirmation
- [ ] Audit logging captures all sensitive operations
- [ ] No bypass flows or security circumvention features
- [ ] Ownership verification enforced for device access
- [ ] Dry-run mode is default for all operations

---

## MVP Feature Validation

### 4. Device Detection

- [ ] ADB device detection works
- [ ] Fastboot device detection works
- [ ] BootForge USB scan works
- [ ] Device correlation confidence scores accurate
- [ ] Mock fallback works when hardware unavailable
- [ ] Device queue updates within 3 seconds
- [ ] Platform hints (Android/iOS/etc.) display correctly

### 5. Diagnostic System

- [ ] Diagnostic workflows load from JSON
- [ ] Workflows execute without errors
- [ ] Read-only diagnostics don't modify device state
- [ ] Diagnostic results display correctly
- [ ] Error handling for failed diagnostics works
- [ ] Workflow step progress visible to user

### 6. Case Management

- [ ] Create case with title and notes works
- [ ] Device intake recording works
- [ ] Ownership verification requires typed phrase
- [ ] Ownership verification logs to audit trail
- [ ] Case notes can be edited and saved
- [ ] Case list displays all cases correctly

### 7. Export Functionality

- [ ] Export to JSON includes all case data
- [ ] Export to Markdown formats correctly
- [ ] Exported files include timestamp
- [ ] Exported files include correlation ID
- [ ] Export includes device info and audit trail
- [ ] Export handles special characters correctly

### 8. Audit & Logging

- [ ] All operations logged to audit trail
- [ ] Audit events include timestamp
- [ ] Audit events include user context
- [ ] Policy gates recorded in audit log
- [ ] Exit codes captured in audit log
- [ ] Audit log queryable via API

---

## Validation Scripts

### 9. Healthcheck

Run `bash scripts/healthcheck.sh` and verify:

- [ ] Healthcheck script executes without errors
- [ ] All system dependencies detected
- [ ] All API endpoints respond correctly
- [ ] Device detection endpoints return valid envelopes
- [ ] Diagnostic workflows validate against schema
- [ ] Export functionality generates valid output
- [ ] Safe-mode defaults confirmed

### 10. Smoke Tests

Run `bash scripts/smoke-test.sh` and verify:

- [ ] Smoke test script executes without errors
- [ ] Core API endpoints return 200 OK
- [ ] Envelope format validation passes
- [ ] Device detection mock data works
- [ ] Case creation succeeds
- [ ] Workflow execution completes
- [ ] Export generation succeeds

---

## Platform-Specific Validation

### 11. Windows Testing

- [ ] MSI installer builds successfully
- [ ] NSIS installer builds successfully
- [ ] Application launches on Windows 10
- [ ] Application launches on Windows 11
- [ ] ADB integration works on Windows
- [ ] Fastboot integration works on Windows
- [ ] No Windows Defender false positives
- [ ] Desktop shortcut created correctly

### 12. macOS Testing

- [ ] DMG builds successfully
- [ ] App bundle builds successfully
- [ ] Application launches on macOS 10.13+
- [ ] Application launches on macOS 14+ (latest)
- [ ] ADB integration works on macOS
- [ ] Fastboot integration works on macOS
- [ ] Gatekeeper allows execution
- [ ] Code signing valid (if signed)

### 13. Linux Testing

- [ ] AppImage builds successfully
- [ ] DEB package builds successfully
- [ ] Application launches on Ubuntu 22.04+
- [ ] Application launches on Fedora 38+
- [ ] ADB integration works on Linux
- [ ] Fastboot integration works on Linux
- [ ] Desktop entry created correctly
- [ ] Permissions set correctly

---

## User Experience Validation

### 14. UI/UX Testing

- [ ] All pages load without errors
- [ ] Navigation works correctly
- [ ] Buttons and links functional
- [ ] Forms validate input correctly
- [ ] Error messages display clearly
- [ ] Loading states show appropriately
- [ ] Responsive layout works (desktop only for MVP)
- [ ] Dark mode consistent throughout

### 15. Performance Testing

- [ ] Initial page load < 3 seconds
- [ ] Device detection < 3 seconds
- [ ] Dashboard UI responsiveness < 100ms
- [ ] Workflow execution completes in expected time
- [ ] Export generation < 2 seconds
- [ ] No memory leaks during extended use
- [ ] CPU usage reasonable during idle

### 16. Error Handling

- [ ] API errors display user-friendly messages
- [ ] Network errors handled gracefully
- [ ] File system errors handled gracefully
- [ ] Invalid input rejected with clear feedback
- [ ] Error boundaries catch React errors
- [ ] Console logs actionable errors (not secrets)

---

## Compliance & Legal

### 17. Legal Review

- [ ] LICENSE file present and correct
- [ ] COPYRIGHT notices updated with current year
- [ ] Third-party licenses acknowledged
- [ ] EULA/Disclaimer reviewed and current
- [ ] No copyrighted content without permission
- [ ] Privacy policy addresses data collection (if any)

### 18. Accessibility

- [ ] Keyboard navigation works for all features
- [ ] Screen reader compatibility (basic)
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators visible
- [ ] Alt text for images (if any)
- [ ] Form labels present and correct

---

## Release Packaging

### 19. Version & Metadata

- [ ] Version number updated in `package.json`
- [ ] Version number updated in `src-tauri/tauri.conf.json`
- [ ] Version number updated in `app.metadata.json`
- [ ] Git tag created with version number
- [ ] CHANGELOG.md has entry for this version
- [ ] Release notes drafted

### 20. Build Artifacts

- [ ] Frontend build (`npm run build`) succeeds
- [ ] Tauri Windows build succeeds
- [ ] Tauri macOS build succeeds
- [ ] Tauri Linux build succeeds
- [ ] All binaries signed (if signing enabled)
- [ ] All installers tested on clean systems

### 21. Distribution

- [ ] GitHub Release created with tag
- [ ] Release notes published
- [ ] Installers uploaded to GitHub Release
- [ ] Checksums provided for all artifacts
- [ ] Installation instructions in release notes
- [ ] Known issues documented in release notes

---

## Post-Release

### 22. Monitoring

- [ ] Release announcement published
- [ ] GitHub issues monitored for bug reports
- [ ] Download metrics tracked
- [ ] User feedback collected
- [ ] Critical bugs triaged immediately
- [ ] Patch release planned if needed

### 23. Retrospective

- [ ] Release retrospective scheduled
- [ ] What went well documented
- [ ] What could improve documented
- [ ] Action items created for next release
- [ ] Checklist updated based on learnings

---

## Emergency Rollback Plan

If critical issues discovered post-release:

1. **Assessment** (< 1 hour)
   - Identify scope and severity
   - Determine if rollback needed
   - Communicate to stakeholders

2. **Rollback** (if needed)
   - Mark release as "pre-release" on GitHub
   - Add warning to release notes
   - Publish hotfix or rollback instructions
   - Communicate via GitHub Discussions

3. **Resolution**
   - Fix issue in new branch
   - Fast-track through checklist
   - Release patch version
   - Update release notes

---

## Definition of Done

A release is **DONE** when:

1. ✅ All checklist items completed
2. ✅ Healthcheck script passes
3. ✅ Smoke test script passes
4. ✅ All platform builds succeed
5. ✅ All platform tests pass
6. ✅ Documentation updated
7. ✅ Release notes published
8. ✅ Artifacts uploaded to GitHub

---

## Checklist Usage

### For Regular Releases

1. Copy this checklist to a new GitHub Issue
2. Title: "Release v{version} - Checklist"
3. Assign to release manager
4. Check off items as completed
5. Link to relevant PRs and commits
6. Close issue when release published

### For Hotfix Releases

Use abbreviated checklist:
- Code Quality (section 1)
- Safety & Security (section 3)
- Affected feature validation only
- Platform-specific validation (section 11-13)
- Release packaging (section 19-21)

---

**Checklist Owner:** Bobby's Workshop Team
**Review Cycle:** After each release
**Next Review:** After v5.0.0 ships

> This checklist is a living document. Update it based on lessons learned from each release.
