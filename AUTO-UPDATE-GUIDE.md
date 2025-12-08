# Auto-Update Guide

AlphaForge now has built-in auto-update functionality that checks for new releases on GitHub and installs them automatically!

## How It Works

1. **Automatic Check**: The app checks for updates 3 seconds after launch (production only)
2. **Manual Check**: Users can click "Check Updates" button in the sidebar
3. **Download**: When an update is available, users can download it with one click
4. **Install**: After download, users can restart and install the update

## Publishing Updates (For Developers)

### Step 1: Bump Version

Update the version in `package.json`:
```json
{
  "version": "1.0.1"  // Change this
}
```

### Step 2: Build the App

```bash
npm run electron:build:win
```

This creates:
- `dist-electron/AlphaForge Knob Modeler Setup 1.0.1.exe` (Installer)
- `dist-electron/AlphaForge Knob Modeler 1.0.1.exe` (Portable)
- `dist-electron/latest.yml` (Update manifest - IMPORTANT!)

### Step 3: Create GitHub Release

1. Go to: https://github.com/willbearfruits/alphaforge-knob-modeler/releases/new
2. Click "Choose a tag" and create a new tag (e.g., `v1.0.1`)
3. Set release title (e.g., `v1.0.1 - Bug Fixes`)
4. Add release notes describing changes
5. Upload these files:
   - `AlphaForge Knob Modeler Setup 1.0.1.exe`
   - `AlphaForge Knob Modeler 1.0.1.exe`
   - `latest.yml` (REQUIRED for auto-update!)
6. Click "Publish release"

### Step 4: Users Get Updates

- Existing users will automatically be notified of the update
- They can download and install with 2 clicks
- No need to manually download from GitHub!

## Testing Updates Locally

You can test the update system by:

1. Building version 1.0.0
2. Installing it
3. Bumping to 1.0.1 and building
4. Publishing 1.0.1 to GitHub
5. Opening the installed 1.0.0 app - it should detect the update!

## Update Flow

```
App Launches → Checks GitHub → Update Available?
                                      ↓ YES
                           Shows Notification → User Downloads
                                      ↓
                           Download Complete → User Clicks "Restart & Install"
                                      ↓
                           App Restarts → New Version Installed ✅
```

## Important Files

- `electron.cjs` - Auto-updater logic
- `preload.cjs` - IPC bridge for updates
- `components/UpdateNotification.tsx` - UI component
- `package.json` - GitHub publish settings
- `dist-electron/latest.yml` - Update manifest (auto-generated)

## GitHub Repository Setup

The app is configured to check:
- **Owner**: willbearfruits
- **Repo**: alphaforge-knob-modeler
- **Release Type**: release (not draft or pre-release)

To change this, edit `package.json`:
```json
"publish": {
  "provider": "github",
  "owner": "willbearfruits",
  "repo": "alphaforge-knob-modeler",
  "releaseType": "release"
}
```

## Troubleshooting

**Update check fails?**
- Make sure `latest.yml` is uploaded to the GitHub release
- Check that the release is published (not draft)
- Verify the GitHub repo settings in package.json

**Update won't install?**
- Windows may require admin permissions for installation
- Make sure the app is closed before installing
- Check electron-log files for errors

## Benefits

✅ No need to recompile for users
✅ Instant updates via GitHub releases
✅ Professional update experience
✅ Version tracking and rollback capability
✅ Automatic notification system

---

**Next Update Instructions:**
1. Make your code changes
2. Update version in `package.json`
3. Run `npm run electron:build:win`
4. Create GitHub release with executables + `latest.yml`
5. Users get notified automatically!
