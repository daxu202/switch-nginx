import { app, BrowserWindow, Menu, Tray } from 'electron'
const path = require('path');
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */

  const iconName = 'nginx.ico';
    const iconPath = path.join(__static, iconName);
    console.log(iconPath)
  mainWindow = new BrowserWindow({
      width: 800,
      height: 500,
      minWidth: 400,
      minHeight: 250,
      fullscreenable: true,
      useContentSize: true,
      skipTaskbar: true,
      show: true,
      icon: iconPath
  })

  mainWindow.loadURL(winURL);
  
  mainWindow.on('closed', () => {
    mainWindow = null
  })


    let tray = new Tray(iconPath);

    global.sharedObject = {
        tray: tray
    }

    tray.on('click', function(e) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */


// import { autoUpdater } from 'electron-updater'
//
// autoUpdater.on('update-downloaded', () => {
//   autoUpdater.quitAndInstall()
// })
//
// app.on('ready', () => {
//   if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
// })
//
