$("document").ready(function ($) {
  var _pageWidth = $("body").outerWidth();
  var _timing = _pageWidth + 3500;
  $(".loader span").each(function (i) {
    var _item = $(this);
    setTimeout(function ($) {
      _item.removeClass("jmp");
      _item.css({ left: "110%" });
    }, 180 * i);
    setTimeout(function ($) {
      _item.addClass("jmp");
      _item.css({ left: "-10%" });
    }, 3000 + 180 * i);
  });

  $("window").resize(function () {
    var _pageWidth = $("body").outerWidth();
    var _timing = _pageWidth + 3500;
  });

  var _pageLoader = setInterval(function () {
    $(".loader span").each(function (i) {
      var _item = $(this);
      setTimeout(function ($) {
        _item.removeClass("jmp");
        _item.css({ left: "110%" });
      }, 180 * i);
      setTimeout(function ($) {
        _item.addClass("jmp");
        _item.css({ left: "-10%" });
      }, 3000 + 180 * i);
    });
  }, _timing);
});
