# Security Policy

Raster runs entirely on your computer. It has no server, accounts or telemetry,
and your files never leave your machine unless you save or export them. The
installed app checks this repository's GitHub Releases for updates; downloads
are checked against the release's SHA-512 hashes before they install.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository instead. We aim to reply within a week.

Things we especially want to hear about: crafted `.raster`, image or palette
files that crash the editor, hang it, or run code, and anything that lets the
page reach the file system outside the files you chose.
