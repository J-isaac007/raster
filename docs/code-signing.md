# Code signing

Raster's Windows installer is built and published by GitHub Actions
([`.github/workflows/release.yml`](../.github/workflows/release.yml)). The
pipeline signs it automatically once a certificate is configured. Until then
releases are unsigned, so Windows SmartScreen warns on first run.

Signing needs a code-signing certificate from a certificate authority. Raster
can't include one: it's tied to a verified person or organization.

## Getting a certificate

Any of these works with the release pipeline:

- **A standard (OV) certificate** from a CA such as Sectigo, DigiCert or
  SSL.com, as a `.pfx` file. SmartScreen builds trust as the certificate gets
  used.
- **Free signing for open source projects** through
  [SignPath Foundation](https://signpath.org/), if the project qualifies. It
  uses its own CI integration instead of a `.pfx`; follow their setup guide.
- **Azure Trusted Signing**, a low-cost Microsoft service. electron-builder
  supports it through `win.azureSignOptions` in `package.json`; see the
  [electron-builder docs](https://www.electron.build/code-signing-win).

## Turning on signing with a `.pfx`

1. Encode the certificate as base64:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("raster.pfx")) | Set-Clipboard
   ```

2. In the repository, open **Settings › Secrets and variables › Actions** and
   add two secrets:
   - `WIN_CSC_LINK`: the base64 text from step 1
   - `WIN_CSC_KEY_PASSWORD`: the certificate's password
3. In `package.json`, set `build.win.publisherName` to the certificate's
   subject name (the "Issued to" name, for example `"Jane Doe"`). Installed
   copies then only accept updates signed by that publisher.
4. Push the next version tag. The workflow signs the installer, the portable
   `.exe` and the app itself.

Set `publisherName` only once signing is on: an installed copy that expects a
publisher refuses unsigned updates.

To sign a local build, set the same two values as the `CSC_LINK` and
`CSC_KEY_PASSWORD` environment variables before running `npm run dist`.

## How updates stay safe without signing

Installed copies download updates only from this repository's GitHub
Releases, over HTTPS, and check each download against the SHA-512 hash in the
release's `latest.yml` before installing it. Signing adds a second check: that
the update was built by the certificate's owner.
