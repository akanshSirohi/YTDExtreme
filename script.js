const { ipcRenderer } = require("electron");

let toast = null;
var vidData = null;
const validateUrl = (url) => {
  var p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
  if (url.match(p)) {
    return url.match(p)[1];
  }
  return false;
};

const showLoader = () => {
  $("#loader").show();
};
const hideLoader = () => {
  $("#loader").hide();
};

const showFetch = () => {
  toast = VanillaToasts.create({
    title: "YTDXtreme",
    text: "Parsing video, please wait...",
    type: "info",
    icon: "assets/loader.gif",
    positionClass: "bottomRight",
    timeout: false,
  });
};

const hideFetch = () => {
  if (toast != null) {
    toast.hide();
  }
};

$(document).ready(() => {
  let webview = document.getElementById("web");
  // webview.setUserAgent("Chrome");
  webview.addEventListener("did-start-loading", () => {
    $("#download_btn").hide();
    showLoader();
  });
  webview.addEventListener("did-stop-loading", () => {
    if (validateUrl(webview.getURL())) {
      $("#download_btn").show();
    } else {
      $("#download_btn").hide();
    }
    hideLoader();
  });
  webview.addEventListener("dom-ready", () => {
    webview.insertCSS(`
      ::-webkit-scrollbar {
        width: 10px;
        background-color: #F5F5F5;
      }
      ::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        border-radius: 10px;
        background-color: #F5F5F5;
      }
      ::-webkit-scrollbar-track-piece {
        background-color: rgb(18, 22, 26);
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 10px;
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,.3);
        background-color: #D62929;
      }
  `);
  });
  $("#download_btn").click(() => {
    let url = webview.getURL();
    if (validateUrl(url)) {
      let url = webview.getURL();
      ipcRenderer.send("video:parse", {
        url: url,
        title: webview.getTitle().replace(/([[ \/\\]])\w+/g, ""),
      });
      showFetch();
    } else {
      alert("Not Valid Url!");
    }
  });

  $("#btn-cut").click(() => {
    ipcRenderer.send("wClose", "");
  });
  $("#btn-size").click(() => {
    ipcRenderer.send("wToggle", "");
  });
  $("#btn-min").click(() => {
    ipcRenderer.send("wHide", "");
  });

  ipcRenderer.on("log", (event, data) => {
    console.log(data);
  });
  ipcRenderer.on("video:parsed", (event, data) => {
    if (data != null) {
      vidData = data;
      var videos = data[0];
      var list_a = "";
      var list_v = "";
      var x = 0;
      var label = "";
      videos.forEach((file) => {
        if (file.type == 0) {
          label =
            file.ext.toUpperCase() +
            " | " +
            file.bitrate +
            " | " +
            file.file_size;
          list_a += '<option value="' + x + '">' + label + "</option>";
        } else if (file.type == 1) {
          label =
            file.ext.toUpperCase() +
            " | " +
            file.format_note +
            " | " +
            file.file_size;
          list_v += '<option value="' + x + '">' + label + "</option>";
        } else {
          label =
            file.ext.toUpperCase() +
            " | " +
            file.format_note +
            " | " +
            file.file_size;
          list_v += '<option value="' + x + '">' + label + "</option>";
        }
        x++;
      });
      $("#audio_links").html(list_a);
      $("#video_links").html(list_v);
      $("#dModal").modal("show");
    } else {
      alert("Video parse error!");
    }
    hideFetch();
  });

  $("#downloadVideo").click(function () {
    var x = eval($("#d_videos").val());
    var selVid = vidData[0][x];
    var d;
    if (selVid.merge) {
      d = {
        links: [selVid.url, vidData[1].url],
        merge: true,
        filename: selVid.filename,
        convert: false,
        title: selVid.title,
        thumb: selVid.thumb,
      };
    } else {
      d = {
        links: [selVid.url],
        merge: false,
        filename: selVid.filename,
        convert: selVid.convert,
        title: selVid.title,
        thumb: selVid.thumb,
      };
    }
    ipcRenderer.send("video:download", d);
    $("#dModal").modal("hide");
  });

  ipcRenderer.on("goBack", (event, data) => {
    if (webview.canGoBack()) {
      webview.goBack();
    }
  });

  ipcRenderer.on("refresh", (event, data) => {
    webview.reload();
  });

  ipcRenderer.on("wMax", (event, data) => {
    $("#w_btn").attr("src", "./assets/square_dbl.svg");
  });
  ipcRenderer.on("wMin", (event, data) => {
    $("#w_btn").attr("src", "./assets/square.svg");
  });
});
