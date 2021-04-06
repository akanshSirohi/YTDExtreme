const electron = require("electron");
const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  session,
  dialog,
} = electron;
const path = require("path");
const url = require("url");
const prettyBytes = require("pretty-bytes");
const ytdl = require("ytdl-core");
const ElectronBlocker = require("@cliqz/adblocker-electron").ElectronBlocker;
const fetch = require("cross-fetch");
let fs = require("fs");
const sanitize = require("sanitize-filename");
const DownloadManager = require("electron-download-manager");
const exec = require("child_process").exec;

const debug = false;
const ffmpegPath = "ffmpeg"; //  Windows

let mWin, winDWL;
let win_size = 0;
let total_downloads = 0;
let is_download_win_opened = false;
let pending_dwl = null;
let download_files = [];
let downloadedFiles = [];
let partials = [];
let isDownloading = false;
let currentDwlId = null;

let dItem;

DownloadManager.register({
  downloadFolder: app.getPath("downloads"),
});

const execute = (command, callback) => {
  exec(command, (error, stdout, stderr) => {
    callback(error, stdout, stderr);
  });
};

const createWindow = () => {
  mWin = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      devTools: debug,
    },
    minWidth: 900,
    minHeight: 700,
    show: false,
    frame: false,
    height: 800,
    width: 1200,
  });

  ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInSession(session.defaultSession);
  });

  mWin.once("ready-to-show", () => {
    mWin.show();
    mWin.webContents.session.on("will-download", (event, item, webContents) => {
      dItem = item;
    });
  });
  mWin.loadURL(url.pathToFileURL(path.join(__dirname, "/index.html")).href);
};

const downloadWindow = () => {
  winDWL = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      devTools: debug,
    },
    show: false,
    frame: false,
    width: 700,
    height: 500,
    resizable: false,
  });
  winDWL.once("ready-to-show", () => {
    winDWL.show();
    is_download_win_opened = true;
    if (pending_dwl != null) {
      winDWL.webContents.send("download:create", pending_dwl);
      let obj = {
        item_id: pending_dwl.item_id,
        item_data: pending_dwl.data,
      };
      pending_dwl = null;
      startDownload(obj);
    }
  });
  winDWL.on("close", () => {
    is_download_win_opened = false;
  });

  winDWL.loadURL(
    url.pathToFileURL(path.join(__dirname, "/downloader.html")).href
  );
};

ipcMain.on("video:download", function (e, data) {
  if (!is_download_win_opened) {
    downloadWindow();
    pending_dwl = {
      item_id: total_downloads,
      item_title: data.title,
      item_thumb: data.thumb,
      data: data,
    };
    total_downloads += 1;
  } else {
    createDownload(data);
  }
});

const DManager = (id, files, merge, flg, filename, convert, overrride) => {
  if (!isDownloading || overrride) {
    isDownloading = true;
    if (!overrride) {
      winDWL.webContents.send("video:showOpts", id);
    }
    currentDwlId = id;
    let file, msg;
    if (files.length == 2) {
      if (!flg) {
        downloadedFiles = [];
        file = files[0];
        msg = "Downloading Video Stream...";
      } else {
        msg = "Downloading Audio Stream...";
        file = files[1];
      }
    } else {
      downloadedFiles = [];
      flg = true;
      file = files[0];
      msg = "Downloading File...";
    }

    DownloadManager.download(
      {
        url: file,
        onProgress: (progress, item) => {
          let pD = {
            progress: progress,
            msg: msg,
            id: currentDwlId,
          };
          winDWL.webContents.send("video:progress", pD);
        },
      },
      function (error, info) {
        if (error) {
          console.log(error);
        } else {
          partials.push(info.filePath);
          downloadedFiles.push(info.filePath);
          if (!flg) {
            DManager(currentDwlId, files, true, true, filename, false, true);
          } else {
            if (merge) {
              mergeStreams(
                downloadedFiles[0],
                downloadedFiles[1],
                filterName(filename),
                currentDwlId
              );
            } else {
              let renRes = renamer(downloadedFiles[0], filename);
              if (convert) {
                audConvertStream(renRes, currentDwlId);
              } else {
                winDWL.webContents.send("video:downloaded", {
                  file: renRes,
                  id: currentDwlId,
                });
                checkPendingDwl();
              }
            }
          }
        }
      }
    );
  }
};

const checkPendingDwl = () => {
  isDownloading = false;
  downloadedFiles = [];
  partials = [];
  let i = 0;
  download_files.forEach((obj) => {
    if (obj.item_id == currentDwlId) {
      download_files.splice(i, 1);
    }
    i++;
  });
  if (download_files.length > 0) {
    let obj = download_files[0];
    currentDwlId = obj.item_id;
    DManager(
      obj.item_id,
      obj.item_data.links,
      obj.item_data.merge,
      false,
      obj.item_data.filename,
      obj.item_data.convert,
      false
    );
  }
};

const createDownload = (data) => {
  winDWL.webContents.send("download:create", {
    item_id: total_downloads,
    item_title: data.title,
    item_thumb: data.thumb,
  });
  let obj = {
    item_id: total_downloads,
    item_data: data,
  };
  total_downloads += 1;
  startDownload(obj);
};

const startDownload = (obj) => {
  download_files.push(obj);
  DManager(
    obj.item_id,
    obj.item_data.links,
    obj.item_data.merge,
    false,
    obj.item_data.filename,
    obj.item_data.convert,
    false
  );
  winDWL.focus();
};

const mergeStreams = (audio, video, output, id) => {
  winDWL.webContents.send("video:status", {
    id: id,
    msg: "Merging Started...",
  });
  winDWL.webContents.send("video:hideOpts", id);
  let parentDir = path.dirname(video);
  output = parentDir + "\\" + output;
  execute(
    `${ffmpegPath} -i ${video} -i ${audio} -c:v copy -c:a aac ${output}`,
    (err, out, stderr) => {
      winDWL.webContents.send("video:status", {
        id: id,
        msg: "Merging Completed!",
      });
      fs.unlinkSync(audio);
      fs.unlinkSync(video);
      winDWL.webContents.send("video:downloaded", { file: output, id: id });
      checkPendingDwl();
    }
  );
};

const audConvertStream = (file, id) => {
  winDWL.webContents.send("video:status", {
    id: id,
    msg: "Converting audio stream...",
  });
  winDWL.webContents.send("video:hideOpts", id);
  let parentDir = path.dirname(file);
  let newname = parentDir + "\\" + path.parse(file).name + ".mp3";
  execute(`${ffmpegPath} -i ${file} ${newname}`, (err, out, stderr) => {
    winDWL.webContents.send("video:status", {
      id: id,
      msg: "Conversion finished!",
    });
    fs.unlinkSync(file);
    winDWL.webContents.send("video:downloaded", { file: newname, id: id });
    checkPendingDwl();
  });
};

const renamer = (oldname, newname) => {
  let name = newname.substring(0, newname.lastIndexOf("."));
  let ext = newname.substring(newname.lastIndexOf(".") + 1, newname.length);
  newname = filterName(name) + "." + ext;
  let parentDir = path.dirname(oldname);
  fs.renameSync(oldname, parentDir + "\\" + newname);
  return parentDir + "\\" + newname;
};

const filterName = (fname) => {
  fname = sanitize(fname, { replacement: "" });
  fname = fname = fname.replace(/\s+/g, "_");
  return fname;
};

const splitAV = (node) => {
  let audioFormatIds = [139, 140, 141, 171, 172, 249, 250, 251];
  let videoFormatIds = [
    402,
    272,
    138,
    401,
    337,
    315,
    313,
    266,
    400,
    336,
    308,
    271,
    264,
    399,
    335,
    303,
    248,
    299,
    137,
    398,
    334,
    302,
    247,
    298,
    136,
    397,
    333,
    244,
    135,
    396,
    332,
    243,
    134,
    395,
    331,
    242,
    133,
    394,
    330,
    278,
    160,
  ];
  let normalFormatIds = [5, 17, 36, 18, 22, 43];
  if (audioFormatIds.indexOf(eval(node.itag)) > 0) {
    return 0;
  } else if (videoFormatIds.indexOf(eval(node.itag)) > 0) {
    return 1;
  } else if (normalFormatIds.indexOf(eval(node.itag)) > 0) {
    return -1;
  }
};

ipcMain.on("video:parse", (err, data) => {
  ytdl
    .getInfo(data.url)
    .then((info) => {
      mWin.webContents.send("log", info);
      let videos = info.formats;
      let mObj = [];
      let maxBitRate = videos[0].audioBitrate;
      let maxBitRateUrl = videos[0].url;
      let maxBitRateSize = videos[0].contentLength;
      videos.forEach((video) => {
        let x = splitAV(video);
        if (x == 0) {
          if (video.audioBitrate > maxBitRate) {
            maxBitRate = video.audioBitrate;
            maxBitRateUrl = video.url;
            maxBitRateSize = video.contentLength;
          }
        }
      });
      let audioMerge = {
        bitRate: maxBitRate,
        url: maxBitRateUrl,
        size: maxBitRateSize,
      };
      videos.forEach((video) => {
        let x = splitAV(video);
        let tmp;
        if (x == 0) {
          let ext = video.container;
          let conv = false;
          if (ext == "webm" || ext == "mp4") {
            ext = "MP3";
            conv = true;
          }
          let cLen = "";
          if (!video.contentLength) {
            cLen = "Unknown";
          } else {
            cLen = prettyBytes(eval(video.contentLength));
          }
          tmp = {
            type: x,
            format_note: "",
            ext: ext,
            file_size: cLen,
            url: video.url,
            bitrate: video.audioBitrate + " KBPS",
            merge: false,
            convert: conv,
            title: data.title,
            filename: data.title + "_" + ext + "." + video.container,
            thumb:
              info.videoDetails.thumbnails[
                info.videoDetails.thumbnails.length - 2
              ].url,
          };
          mObj.push(tmp);
        } else if (x == 1) {
          let cLen = "";
          if (!video.contentLength) {
            cLen = "Unknown";
          } else {
            cLen = prettyBytes(
              eval(video.contentLength) + eval(maxBitRateSize)
            );
          }
          tmp = {
            type: x,
            format_note: video.qualityLabel,
            ext: "MP4",
            file_size: cLen,
            url: video.url,
            bitrate: "",
            merge: true,
            convert: false,
            title: data.title,
            filename: data.title + "_" + video.qualityLabel + ".mp4",
            thumb:
              info.videoDetails.thumbnails[
                info.videoDetails.thumbnails.length - 2
              ].url,
          };
          mObj.push(tmp);
        } else if (x == -1) {
          let cLen = "";
          if (!video.contentLength) {
            cLen = "Unknown";
          } else {
            cLen = prettyBytes(eval(video.contentLength));
          }
          tmp = {
            type: x,
            format_note: video.qualityLabel,
            ext: video.container,
            file_size: cLen,
            url: video.url,
            bitrate: video.audioBitrate + " KBPS",
            merge: false,
            convert: false,
            title: data.title,
            filename:
              data.title + "_" + video.qualityLabel + "." + video.container,
            thumb:
              info.videoDetails.thumbnails[
                info.videoDetails.thumbnails.length - 2
              ].url,
          };
          mObj.push(tmp);
        }
      });
      let dData = [mObj, audioMerge];
      mWin.webContents.send("video:parsed", dData);
    })
    .catch((err) => {
      mWin.webContents.send("video:parsed", null);
    });
});

ipcMain.on("wClose", (err, data) => {
  if (isDownloading) {
    dialog
      .showMessageBox(winDWL, {
        buttons: ["Yes", "No"],
        message: "Do you really want to quit?",
        detail: "This will cancel all ongoing downloads...",
        title: "Warning",
        type: "warning",
      })
      .then((e) => {
        if (e.response == 0) {
          dItem.cancel();
          partials.forEach((e) => {
            fs.unlinkSync(e);
          });
          mWin.close();
          if (winDWL != null) {
            try {
              winDWL.close();
            } catch (e) {}
          }
          app.quit();
        }
      });
  } else {
    mWin.close();
    if (winDWL != null) {
      try {
        winDWL.close();
      } catch (e) {}
    }
    app.quit();
  }
});

ipcMain.on("dwl:wClose", (err, data) => {
  if (isDownloading) {
    dialog
      .showMessageBox(winDWL, {
        buttons: ["Yes", "No"],
        message: "Do you really want to quit?",
        detail: "This will cancel all ongoing downloads...",
        title: "Warning",
        type: "warning",
      })
      .then((e) => {
        if (e.response == 0) {
          dItem.cancel();
          partials.forEach((e) => {
            fs.unlinkSync(e);
          });
          winDWL.close();
        }
      });
  } else {
    winDWL.close();
  }
});

ipcMain.on("wToggle", (err, data) => {
  if (win_size == 0) {
    mWin.maximize();
  } else {
    mWin.unmaximize();
  }
});

ipcMain.on("wHide", (err, data) => {
  mWin.minimize();
});

ipcMain.on("dwl:wHide", (err, data) => {
  winDWL.minimize();
});

ipcMain.on("video:pause", function (e, id) {
  console.log("Pause Event Called!");
  dItem.pause();
  winDWL.webContents.send("video:status", {
    id: id,
    msg: "Downloading Paused...",
  });
});

ipcMain.on("video:resume", function (e, d) {
  dItem.resume();
});

ipcMain.on("video:cancel", function (e, d) {
  dItem.cancel();
  partials.forEach((e) => {
    fs.unlinkSync(e);
  });
  checkPendingDwl();
});

app.on("ready", () => {
  createWindow();
  mWin.on("focus", (event, win) => {
    globalShortcut.register("Ctrl+Backspace", () => {
      mWin.webContents.send("goBack", "");
    });
    globalShortcut.register("Ctrl+R", () => {
      mWin.webContents.send("refresh", "");
    });
  });
  mWin.on("blur", (event, win) => {
    globalShortcut.unregisterAll();
  });
  mWin.on("maximize", (e) => {
    mWin.webContents.send("wMax", "");
    win_size = 1;
  });
  mWin.on("unmaximize", (e) => {
    mWin.webContents.send("wMin", "");
    win_size = 0;
  });
});

app.on("close", () => {
  app.quit();
});
