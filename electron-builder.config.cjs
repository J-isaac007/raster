// electron-builder configuration: the Windows installer (NSIS) and portable exe.
// https://www.electron.build/configuration

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'io.github.jisaac007.raster',
  productName: 'Raster',
  copyright: 'Copyright © 2026 The Raster Contributors',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['out/**', 'package.json'],
  fileAssociations: [
    {
      ext: 'raster',
      name: 'Raster Project',
      description: 'Raster pixel art project',
      role: 'Editor',
    },
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'build/icon.png',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Raster',
    artifactName: 'Raster-Setup-${version}.${ext}',
    license: 'build/installer-notice.txt',
  },
  portable: {
    artifactName: 'Raster-${version}-portable.${ext}',
  },
  publish: {
    provider: 'github',
    owner: 'J-isaac007',
    repo: 'raster',
  },
};
