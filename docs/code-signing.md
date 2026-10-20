# Code signing

Raster's Windows installer is built and published by GitHub Actions
([`.github/workflows/release.yml`](../.github/workflows/release.yml)). The
workflow signs the release once signing is configured; until then releases are
unsigned and Windows SmartScreen warns on first run.

The plan is free signing through [SignPath Foundation](https://signpath.org/),
which gives open source projects a certificate issued to "SignPath
Foundation". The repository side is ready:

- The [code signing policy](../README.md#code-signing-policy) and the
  [privacy policy](privacy.md) SignPath requires
- The installer shows the privacy notice ([`build/installer-notice.txt`](../build/installer-notice.txt))
- SignPath steps in the release workflow, skipped until configured
- The artifact configuration to paste into SignPath
  ([`.signpath/artifact-configuration.xml`](../.signpath/artifact-configuration.xml))

## 1. Apply

1. Turn on two-factor authentication for your GitHub account. SignPath requires
   it for everyone with access to the repository or the SignPath project.
2. Apply at [signpath.org/apply](https://signpath.org/apply) with the
   repository URL. Check that the [terms](https://signpath.org/terms) still
   match what's described here.
3. Wait for approval. SignPath creates an organization for the project and
   invites you to [app.signpath.io](https://app.signpath.io).

## 2. Set up SignPath

In app.signpath.io:

1. **Trusted build system:** add the predefined **GitHub.com** build system to
   the organization.
2. **Project:** create a project with the slug `raster` and link it to the
   GitHub.com build system. Set its repository URL to this repository.
3. **Artifact configuration:** in the project, create one with the slug
   `executables` and paste in
   [`.signpath/artifact-configuration.xml`](../.signpath/artifact-configuration.xml).
   It signs `Raster-Setup-<version>.exe` and `Raster-<version>-portable.exe`
   and checks that both say product name "Raster" and the release version.
4. **Signing policy:** create one with the slug `release-signing`, using the
   SignPath Foundation certificate. Add yourself as an **approver** (each
   release waits for your approval) and a CI user as a **submitter**.
5. **API token:** create an API token for the CI user.

Different slugs work too; set them in step 3 below.

## 3. Connect the repository

In GitHub, open **Settings › Secrets and variables › Actions**:

- **Secrets** tab: add `SIGNPATH_API_TOKEN` with the token from step 2.
- **Variables** tab: add `SIGNPATH_ORGANIZATION_ID` with the organization ID
  shown in SignPath. Optional: `SIGNPATH_PROJECT_SLUG`,
  `SIGNPATH_SIGNING_POLICY_SLUG` and `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` if
  you didn't use `raster`, `release-signing` and `executables`.

Setting `SIGNPATH_ORGANIZATION_ID` is what turns signing on.

Then remove the "Signing starts with the first release after…" note from the
code signing policy in the README.

## 4. Release

Cut and push a version as usual (`npm run release -- minor`, then the git
commands it prints). The workflow:

1. Builds the installer and portable `.exe`, with `publisherName` set to
   "SignPath Foundation" so that version only accepts signed updates.
2. Uploads both and submits a signing request.
3. **Waits for you to approve the request** at app.signpath.io (you get an
   email). It gives up after an hour.
4. Swaps in the signed files, refreshes the update hashes
   ([`scripts/refresh-update-info.mjs`](../scripts/refresh-update-info.mjs)),
   checks the signatures and publishes the release.

If the wait times out, approve the request and re-run the failed job.

## Things to know

- **The installer is signed; the app inside isn't.** SignPath can't open
  NSIS installers, so `Raster.exe` inside stays unsigned. Windows checks the
  downloaded installer and the portable `.exe`, which are both signed.
- **Once a signed version is out, keep signing.** That version's installed
  copies refuse updates that aren't signed by SignPath Foundation. If signing
  breaks, fix it rather than publishing an unsigned release.
- **SmartScreen still needs time.** A new certificate builds reputation as
  people download signed releases, so early ones may still warn.

## Using your own certificate instead

If you buy a code-signing certificate (`.pfx`), skip SignPath and add two
secrets instead: `WIN_CSC_LINK` (the file, base64-encoded) and
`WIN_CSC_KEY_PASSWORD`. Encode it with:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("raster.pfx")) | Set-Clipboard
```

electron-builder then signs the installer, the portable `.exe` and the app
inside, and records the certificate's publisher so updates are verified.
To sign a local build,
set `CSC_LINK` and `CSC_KEY_PASSWORD` before `npm run dist`.

## How updates stay safe without signing

Installed copies download updates only from this repository's GitHub
Releases, over HTTPS, and check each download against the SHA-512 hash in the
release's `latest.yml` before installing it. Signing adds a second check: that
the update came from the certificate's owner.
