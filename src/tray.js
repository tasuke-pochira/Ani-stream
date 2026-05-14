const SysTray = require('systray2').default;
const path = require('path');
const open = require('open');

function initTray(port) {
  const itemOpen = {
    title: 'Open AniStream',
    tooltip: 'Open Web UI',
    checked: false,
    enabled: true,
    click: () => open(`http://localhost:${port}`)
  };

  const itemQuit = {
    title: 'Quit',
    tooltip: 'Close Application',
    checked: false,
    enabled: true,
    click: () => process.exit(0)
  };

  const systray = new SysTray({
    menu: {
      icon: path.join(__dirname, '../assets/tray.ico'),
      title: 'AniStream',
      tooltip: 'AniStream - Local Anime',
      items: [itemOpen, SysTray.separator, itemQuit]
    },
    debug: false,
    copyDir: true // copies binary to a temp directory
  });

  systray.onClick(action => {
    if (action.item.click) action.item.click();
  });

  systray.ready().then(() => {
    console.log('System tray initialized');
  }).catch(err => {
    console.error('System tray failed to load:', err.message);
  });
}

module.exports = { initTray };
