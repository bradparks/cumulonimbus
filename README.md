<h1 align="center">
  <br>
  <a href="https://github.com/z-------------/cumulonimbus">
    <img src="https://cdn.rawgit.com/z-------------/cumulonimbus/35c95868/build/icon.svg" width="128" height="128" alt="CPod logo" />
  </a>
  <br>
  CPod
  <br>
</h1>

<p align="center">(formerly Cumulonimbus)</p>
<h4 align="center">A simple, beautiful podcast app.</h4>

<div align="center">
  <a href="https://github.com/z-------------/cumulonimbus/releases"><img src="https://img.shields.io/github/release-date-pre/z-------------/cumulonimbus.svg?label=latest%20(pre)release" /></a>
  <a href="https://gitter.im/cpod-chat/Lobby"><img src="https://img.shields.io/gitter/room/cumulonimbus/cumulonimbus.svg" /></a>
</div>
<br>

**NOTE: CPod is very much a work in progress. Please expect bugs.**

A review by *OMG! Ubuntu!*: [A Terrific Podcast Client with a Terrible Name](http://www.omgubuntu.co.uk/2017/11/cumulonimbus-electron-podcast-client)

![Screenshot](https://i.imgur.com/XBLbKLq.png)

## Install

Get the latest binaries/installers from the [**Releases**](https://github.com/z-------------/cumulonimbus/releases) tab. Available for **Windows** (NSIS installer), **macOS** (.app, .dmg), and **Linux** (AppImage, .deb).

### Install for development

0. Have [Node.js](https://nodejs.org/en/download/), [Yarn](https://yarnpkg.com/docs/install), and [gulp-cli](https://gulpjs.com/) installed (as well as libdbus-1-dev if you are on Linux and want MPRIS integration), and `cd` to the repo directory.
1. Run `yarn` to install npm dependencies.
2. Run `gulp` to compile and concatenate JS, SCSS, Pug, and what have you (or `gulp both` to also watch for changes).
3. Run `yarn start` to start CPod.

Be sure not to work on `all.js` or on any of the compiled `.html` or `.css` files when there is a `.pug` or `.scss` counterpart, respectively.

### Packaging

If you want to try the latest changes before they are available in a (pre)release, you can package CPod by following steps 0 to 2 in [Install for development](#install-for-development) then running `yarn dist`. The binary/installer should then be in the `dist` directory.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md)
