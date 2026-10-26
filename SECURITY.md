# Security Policy

## Supported Versions

Security updates are provided for the current release line. Older versions are unsupported—please upgrade to `1.12.x`.

| Version | Supported |
| :--- | :--- |
| `1.12.x` (Current) | :white_check_mark: |
| `< 1.12.0` | :x: |

## Reporting a Security Issue

We take the protection of laboratory records, chain-of-custody data, and national soil information systems seriously.

**Please do not report security issues through public GitHub issues, pull requests, or discussions.**

Instead, send a private report by email to the project maintainers:
- **Email:** `security@soilfer.org` (or directly to `yusuf.yigini@fao.org`)

When reporting, please include:
1. A short description of the issue and the affected component or file path.
2. Clear steps to reproduce the behavior.
3. The deployment version and configuration context (without sharing passwords, tokens, or private keys).

## What Happens After a Report

1. **Acknowledgment:** We confirm receipt of your report within 48 hours.
2. **Review & Verification:** Maintainers reproduce and assess the report within 5 business days and keep you updated on progress.
3. **Fix & Release:** Validated fixes are prepared, tested, and published in a `1.12.x` or subsequent release on `main`, followed by release notes for laboratory administrators.

## Safe Installation & Configuration Settings

Laboratory administrators and system operators should review the installation and configuration guides when deploying or updating SoilFER LIMS:

- [Installation Guide](docs/INSTALL.md) — production Docker deployment, TLS/reverse-proxy setup, and initial administrator setup.
- [Environment Configuration](docs/book/src/installation/configuration.md) — required secrets, environment variables, and per-laboratory policy presets.
- [HTTP Deployment Settings](docs/http-deployment-settings.md) — reverse-proxy trust, browser origin allowlists, and request body settings.
- [Sign-in & Password Protection](docs/sign-in-protection.md) — password length and sign-in throttle settings.
