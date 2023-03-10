// We don't know the actual rendered size of the main photo until after it's
// loaded, so that's when we can calculate how much margin to apply to the main
// photo so it's vertically centered.  (If the image is taller than its
// container, margin can be zero and the image will be scaled down to fit.)
function mainphoto_onload(img) {
  var height = img.height;
  if (img.width > $("#photo-background").width()) {
    // img.height and width give the "true" image size, but the photo will
    // actually render at a scaled size
    height = height * $("#photo-background").width() / img.width;
  }
  if (height < $("#photo-background").height()) {
    var top_margin = ($("#photo-background").height() - height) / 2;
    $(img).css('margin-top', top_margin);
  }
  $(img).css({'max-height': $("#photo-background").height(),
             'max-width': $("#photo-background").width()});
}


(function() {
  var current_racer_id = 0;
  // This cache breaker value is for the title slide image.  We want that image
  // to be cached for the duration of the slideshow.  Reloading the slideshow
  // will pick up any changes to the title slide image.
  var cachebreaker = Date.now();
  var kiosk_parameters = {};
  try {
    KioskPoller.param_callback = function(parameters) {
      kiosk_parameters = parameters;
    };
  } catch (e) {
    // If not in a kiosk, then KioskPoller will be undefined.
  }

  var next_query = {'mode': 'slide',
                    'file': ''};

  // response: {'photo', 'inset', 'name', 'carname', 'carnumber', 'next'}
  function refresh_page(response) {
    console.log('refresh_page', response);
    next_query = response.next;

    // There's always a div.next, which is hidden; we populate it with images
    // for the next racer.  When the next racer becomes current, the old
    // div.current gets removed, div.next becomes div.current, and we create a
    // new div.next.
    $("#photo-background div.current").remove();
    $("#photo-background div.next").removeClass("next").addClass("current");

    var next = $("<div class='next'></div>").appendTo("#photo-background");

    next.append('<img class="mainphoto" onload="mainphoto_onload(this)" src="' +
                response['photo'] + '"/>');

    if (response.hasOwnProperty('name')) {
      var subtitle = $("<p class='subtitle'/>").text(response['name']).appendTo(next);
      if (response.hasOwnProperty('carnumber')) {
          subtitle.prepend(': ')
              .prepend($("<span class='carno'/>").text(response['carnumber']));
      }
      if (response.hasOwnProperty('carname')) {
        subtitle.append("<br/>")
              .append($("<i/>").text(response['carname']));
      }            
    }

    if (response.hasOwnProperty('inset')) {
      next.append('<img class="inset_photo" src="' + response['inset'] + '"/>');
    }

    if (response.hasOwnProperty('title') && kiosk_parameters.title) {
      $('<p class="maintitle"></p>').text(kiosk_parameters.title).appendTo(current);
    }
  }

  function photo_poll() {
    next_query.query = 'photo.next';
    var classids = kiosk_parameters.classids;
    if (classids && classids.length > 0) {
      next_query.classids = classids.join(',');
    }
    $.ajax('action.php',
           {type: 'GET',
            data: next_query,
            success: function(data) {
              if (data.hasOwnProperty('photo')) {
                refresh_page(data.photo);
              } else {
                refresh_page({'photo': 'slide.php/title',
                              'next': {'mode': 'slide',
                                       'file': ''}});
              }
            }
           }
          );
  }

  $(document).ready(function() {
    $("#photo-background").height($("#photo-background").height() -
                                  $("#photo-background").position().top);
    photo_poll();
    setInterval(photo_poll, 10000);
  });
}());
