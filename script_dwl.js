const { ipcRenderer } = require("electron");
const checkIfEmpty = () => {
  if ($(".item").length == 0) {
    $("#empty").show();
  } else {
    $("#empty").hide();
    initListeners();
  }
};

const initListeners = () => {
  $("i[data-btn='cbtn']").off();
  $("i[data-btn='cbtn']").click((e) => {
    let id = $(e.target).attr("id");
    let item_id = $(e.target).data("id");
    if (id.endsWith("_pp")) {
      if ($(e.target).hasClass("fa-pause")) {
        $(e.target).removeClass("fa-pause");
        $(e.target).addClass("fa-play");
        ipcRenderer.send("video:pause", item_id);
      } else {
        $(e.target).removeClass("fa-play");
        $(e.target).addClass("fa-pause");
        ipcRenderer.send("video:resume", item_id);
      }
    } else if (id.endsWith("_stp")) {
      id = id.replace("stp", "info");
      $(`#${id}`).html("Downloading Stopped...");
      id = id.replace("info", "controls");
      $(`#${id}`).hide();
      id = id.replace("_controls", "");
      setTimeout(() => {
        $(`#${id}`).hide("slow", () => {
          $(`#${id}`).remove();
          checkIfEmpty();
        });
      }, 2000);
      ipcRenderer.send("video:cancel", item_id);
    }
  });
};

$(document).ready(() => {
  checkIfEmpty();
  $("#btn-cut").click(() => {
    ipcRenderer.send("dwl:wClose", "");
  });
  $("#btn-min").click(() => {
    ipcRenderer.send("dwl:wHide", "");
  });
  ipcRenderer.on("download:create", (event, data) => {
    let template = `
      <div class="item" id="item_${data.item_id}">
        <div class="item-thumb">
          <img src="${data.item_thumb}" alt="" />
        </div>
        <div class="item-info" id="item_${data.item_id}_info">
          <div class="item-title">${data.item_title}</div>
          <div class="progress">
            <div
              class="progress-bar progress-bar-grad"
              role="progressbar"
              aria-valuemax="100"
              style="width: 0%"
              id="item_${data.item_id}_pBar"
            ></div>
          </div>
          <div class="row mt-1" style="font-size: 10px">
            <div class="col" style="text-align: left">
              <b>Progress:</b>&nbsp;<span id="item_${data.item_id}_percent">---</span><br />
              <b>Status:</b>&nbsp;<span id="item_${data.item_id}_status"
                >Pending Download...</span
              >
            </div>
            <div class="col" style="text-align: right">
              <b>Downloaded:</b>&nbsp;<span id="item_${data.item_id}_dwnloaded">-</span>
              Of
              <span id="item_${data.item_id}_total">-</span>
            </div>
          </div>
        </div>
        <div class="item-controls" id="item_${data.item_id}_controls" style="display:none;">
          <i class="fas fa-pause" data-btn="cbtn" data-id="${data.item_id}" id="item_${data.item_id}_pp"></i>
          <i class="fas fa-stop" data-btn="cbtn" data-id="${data.item_id}" id="item_${data.item_id}_stp"></i>
        </div>
      </div>
    `;
    $("#container").append(template);
    checkIfEmpty();
  });
  ipcRenderer.on("video:progress", (event, progress) => {
    $(`#item_${progress.id}_percent`).html(
      progress.progress.progress.toFixed(2) + "%"
    );
    $(`#item_${progress.id}_dwnloaded`).html(progress.progress.downloaded);
    $(`#item_${progress.id}_total`).html(progress.progress.total);
    $(`#item_${progress.id}_status`).html(progress.msg);
    $(`#item_${progress.id}_pBar`).css(
      "width",
      progress.progress.progress + "%"
    );
  });

  ipcRenderer.on("video:status", (event, data) => {
    $(`#item_${data.id}_status`).html(data.msg);
  });

  ipcRenderer.on("video:downloaded", (event, data) => {
    $(`#item_${data.id}_info`).html("File Downloaded Successfully...");
    $(`#item_${data.id}_controls`).hide();
  });

  ipcRenderer.on("video:hideOpts", (event, id) => {
    $(`#item_${id}_controls`).hide();
  });
  ipcRenderer.on("video:showOpts", (event, id) => {
    $(`#item_${id}_controls`).show();
  });
});
