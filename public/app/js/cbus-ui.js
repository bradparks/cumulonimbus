cbus.ui = {};

cbus.ui.playerElement = document.getElementsByClassName("player")[0];
cbus.ui.videoCanvasElement = document.getElementsByClassName("player_video-canvas")[0];
cbus.ui.videoCanvasContext = cbus.ui.videoCanvasElement.getContext("2d");
cbus.ui.browserWindow = remote.getCurrentWindow();
cbus.ui.firstrunContainerElem = document.getElementsByClassName("firstrun-container")[0];
cbus.ui.homeListElem = document.getElementsByClassName("list--episodes")[0];
cbus.ui.playerBlurredImageCanvas = document.getElementById("player_blurred-image");
cbus.ui.playerBlurredImageCtx = cbus.ui.playerBlurredImageCanvas.getContext("2d");
cbus.ui.queueListElem = document.getElementsByClassName("list--queue")[0];
cbus.ui.mediaElemsContainer = document.getElementsByClassName("audios")[0];
cbus.ui.settingsLocaleSelectElem = document.getElementsByClassName("settings_select--locale")[0];

cbus.ui.currentFilters = {
  date: "any", length: "any", offline: "any", progress: "any"
};

cbus.ui.display = function(thing, data) {
  if (thing === "feeds") {
    let subscribedFeedsElem = document.getElementsByClassName("podcasts_feeds--subscribed")[0];
    subscribedFeedsElem.innerHTML = "";
    for (let i = 0, l = cbus.data.feeds.length; i < l; i++) {
      subscribedFeedsElem.appendChild(cbus.ui.makeFeedElem(cbus.data.feeds[i], i));
    }
  } else if (thing === "episodes") {
    var startIndex = 0;
    var endIndex = Math.min(cbus.const.STREAM_PAGE_LENGTH, cbus.data.episodes.length);
    if (data && data.afterIndex) {
      startIndex = data.afterIndex;
      endIndex = Math.min(startIndex + cbus.const.STREAM_PAGE_LENGTH, cbus.data.episodes.length - startIndex);
    }
    if (data && data.untilLastDisplayedEpisode) {
      endIndex = cbus.data.episodes.indexOf(
        cbus.data.getEpisodeData({
          id: cbus.ui.homeListElem.children[cbus.ui.homeListElem.children.length - 1].dataset.id
        })
      );
    }

    for (let i = startIndex; i < endIndex; i++) {
      let episode = cbus.data.episodes[i];
      let feed = cbus.data.getFeedData({ url: episode.feedURL });

      if (feed && cbus.ui.homeListElem.querySelectorAll(`[data-id="${episode.url}"]`).length === 0) { // we have feed info AND this episode doesn't yet have an element
        let episodeElem = cbus.ui.makeEpisodeElem({
          title: episode.title,
          date: episode.date,
          feedUrl: feed.url,
          image: feed.image,
          feedTitle: feed.title,
          length: episode.length,
          description: decodeHTML(episode.description),
          url: episode.url,
          index: i
        });

        if (cbus.data.episodesOffline.indexOf(episode.url) !== -1) {
          episodeElem.querySelector(".episode_button--download").textContent = "offline_pin";
        }
        if (cbus.data.episodeCompletedStatuses[episode.url] === true) {
          episodeElem.querySelector(".episode_button--completed").textContent = "check_circle";
        }

        cbus.ui.homeListElem.insertBefore(episodeElem, cbus.ui.homeListElem.children[i]); // what is now at index `i` will become `i + 1` after insertion
      }
    }
    cbus.ui.applyFilters(cbus.ui.currentFilters);
    cbus.data.state.loadingNextHomePage = false;
  } else if (thing === "player") {
    let feed = cbus.data.getFeedData({ url: data.feedURL });

    document.getElementsByClassName("player_detail_title")[0].textContent = data.title;
    document.getElementsByClassName("player_detail_feed-title")[0].textContent = feed.title;
    document.getElementsByClassName("player_detail_date")[0].textContent = moment(data.date).calendar();

    var descriptionFormatted = data.description ? data.description.trim() : "";
    if (
      descriptionFormatted.toLowerCase().indexOf("<br>") === -1 &&
      descriptionFormatted.toLowerCase().indexOf("<br />") === -1 &&
      descriptionFormatted.toLowerCase().indexOf("<p>") === -1
    ) {
      descriptionFormatted = descriptionFormatted.replace(/\n\s*\n/g, "<br><br>")
    }
    descriptionFormatted = descriptionFormatted
      .replace(
        /\d+:\d+(:\d+)*/g,
        "<span class='player_detail_description_timelink'>$&</span>"
      );
    document.getElementsByClassName("player_detail_description")[0].innerHTML = descriptionFormatted;

    // switch to description tab
    cbus.ui.setPlayerTab(0);

    // first show podcast art, then switch to episode art (maybe different, maybe same) when it loads (if it exists)
    let playerImageElement = document.getElementsByClassName("player_detail_image")[0];
    let imageURI = cbus.data.getPodcastImageURI(feed);
    if (imageURI) {
      playerImageElement.style.backgroundImage = "url('" + imageURI + "')";
    } else {
      playerImageElement.style.backgroundImage = "url('img/podcast_art_missing.svg')";
    }
    if (data.art) {
      xhr({
        url: data.art,
        responseType: "arraybuffer"
      }, (err, status, imageBuffer) => {
        Jimp.read(Buffer.from(imageBuffer), function(err, image) {
          if (!err) {
            if (cbus.data.getEpisodeData({ audioElement: cbus.audio.element }).id === data.id) {
              image.cover(cbus.const.PODCAST_ART_SIZE, cbus.const.PODCAST_ART_SIZE)
                .getBase64(Jimp.AUTO, function(err, base64) {
                  playerImageElement.style.backgroundImage = `url(${ base64 })`;
                });
            }
          }
        });
      });
    }

    // description links open in browser
    let aElems = document.querySelectorAll(".player_detail_description a");
    for (let i = 0, l = aElems.length; i < l; i++) {
      aElems[i].addEventListener("click", function(e) {
        e.preventDefault();
        remote.shell.openExternal(this.href);
      });
    }

    // blur podcast art and show in player background
    let podcastImage = document.createElement("img");
    podcastImage.addEventListener("load", function() {
      let size
        = cbus.ui.playerBlurredImageCanvas.width
        = cbus.ui.playerElement.getClientRects()[0].width;
      cbus.ui.playerBlurredImageCanvas.height = size;
      cbus.ui.playerBlurredImageCtx.drawImage(podcastImage, 0, 0, size, size);
      stackBlurCanvasRGBA(cbus.ui.playerBlurredImageCanvas, 0, 0, size, size, 150); // canvas, top_x, top_y, width, height, radius
      cbus.ui.playerBlurredImageCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
      cbus.ui.playerBlurredImageCtx.fillRect(0, 0, size, size);
      cbus.ui.playerBlurredImageCanvas.toBlob((blob) => {
        cbus.ui.playerElement.style.backgroundImage = `url('${ URL.createObjectURL(blob) }')`;
      });
    });
    podcastImage.src = imageURI || "img/podcast_art_missing.svg";

    /* display chapters */

    let chaptersListElem = document.getElementsByClassName("player_detail_chapters")[0];
    let playerDetailElem = document.getElementsByClassName("player_detail")[0];

    chaptersListElem.innerHTML = "";

    if (data.chapters.length > 0) {
      playerDetailElem.classList.remove("no-chapters");

      for (let i = 0, l = data.chapters.length; i < l; i++) {
        let chapterElem = document.createElement("div");
        chapterElem.classList.add("player_detail_chapter");
        chapterElem.dataset.index = i.toString();

        let chapterTitleElem = document.createElement("div");
        chapterTitleElem.classList.add("player_detail_chapter_title");
        chapterTitleElem.textContent = data.chapters[i].title;

        let chapterTimeElem = document.createElement("div");
        chapterTimeElem.classList.add("player_detail_chapter_time");
        chapterTimeElem.textContent = colonSeparateDuration(data.chapters[i].time);

        chapterElem.appendChild(chapterTitleElem);
        chapterElem.appendChild(chapterTimeElem);

        chaptersListElem.appendChild(chapterElem);
      }
    } else {
      playerDetailElem.classList.add("no-chapters");
    }

    /* switch to video mode if appropriate */
    if (data.isVideo) {
      cbus.ui.playerElement.classList.add("video-mode");
    } else {
      cbus.ui.playerElement.classList.remove("video-mode");
    }
  }
};

cbus.ui.setPlayerTab = function(index) {
  var targetDetailBodyElem, targetTabElem;
  if (index === 0) {
    targetDetailBodyElem = document.getElementsByClassName("player_detail_description")[0];
    targetTabElem = document.getElementsByClassName("player_detail_tab--description")[0];
  } else if (index === 1) {
    targetDetailBodyElem = document.getElementsByClassName("player_detail_chapters")[0];
    targetTabElem = document.getElementsByClassName("player_detail_tab--chapters")[0];
  }
  $(".player_detail_body > *").addClass("not-visible");
  targetDetailBodyElem.classList.remove("not-visible");
  $(".player_detail_tab").removeClass("active");
  targetTabElem.classList.add("active");
};

cbus.ui.showSnackbar = function(content, type, buttons) {
  var n;

  if (!type) {
    var type = "notification";
  }

  n = noty({
    text: content,
    type: type,

    maxVisible: 50,

    animation: {
      open: { height: "toggle" },
      close: { height: "toggle" },
      easing: "swing",
      speed: 300
    },
    timeout: 5000,
    layout: "bottomLeft",
    theme: "material"
  });

  if (buttons && Array.isArray(buttons)) {
    n.$message.append("<div class='snackbar_buttons'></div>");
    for (let i = 0, l = buttons.length; i < l; i++) {
      n.$message.find(".snackbar_buttons").append(
        $("<button class='snackbar_button'></button>").text(buttons[i].text).on("click", function() {
          buttons[i].onClick();
        })
      );
    }
  }

  return n;
};

cbus.ui.tabs = {};
cbus.ui.tabs.switch = function(options) {
  if (options.id || !Number.isNaN(options.index)) {
    var $target, $origin;

    if (options.id) {
      $target = $(".content#" + options.id);
      $origin = $("header nav a[data-target='" + options.id + "']");
    } else { // options.index
      $target = $(".content").eq(options.index);
      $origin = $("header nav a").eq(options.index);
    }

    /* show/hide contents */

    $(".content").removeClass("current"); // remove 'current' class from all tabs

    $target.removeClass("left");
    $target.removeClass("right");
    $target.addClass("current");

    var targetIndex = $target.parent().children().index($target);

    for (var i = 0; i < targetIndex; i++) {
      $target.parent().children().eq(i).removeClass("right");
      $target.parent().children().eq(i).addClass("left");
    }

    for (var i = targetIndex + 1; i < $target.parent().children().length; i++) {
      $target.parent().children().eq(i).removeClass("left");
      $target.parent().children().eq(i).addClass("right");
    }

    /* highlight/unhighlight nav buttons */

    $("header nav a").removeClass("current");
    $origin.addClass("current");

    /* show/hide header buttons */

    var scopeButtons = $("[data-scope='" + $target.attr("id") + "']");
    scopeButtons.addClass("visible");
    $(".header_action").not(scopeButtons).removeClass("visible");

    return;
  }
  return false;
};

cbus.ui.colorify = function(options) {
  var element = $(options.element);

  var colorThiefImage = document.createElement("img");
  colorThiefImage.onload = function() {
    var colorThief = new ColorThief();
    var colorRGB = colorThief.getColor(colorThiefImage);
    var colorRGBStr = "rgb(" + colorRGB.join(",") + ")";
    var colorL = 0.2126 * colorRGB[0] + 0.7152 * colorRGB[1] + 0.0722 * colorRGB[2];

    element.css({ backgroundColor: colorRGBStr });
    if (colorL < 158) {
      element.addClass("light-colors");
    } else {
      element.removeClass("light-colors");
    }
  };

  colorThiefImage.src = cbus.data.getPodcastImageURI({
    image: options.image,
    url: options.feedUrl
  });
};

cbus.ui.makeFeedElem = function(data, index, isSearchResult, isExplore) {
  var elem = document.createElement("div");

  if (isSearchResult || isExplore) {
    elem.classList.add("explore_feed", "tooltip--podcast");
  } else {
    elem.classList.add("podcasts_feed", "tooltip--podcast");
  }

  elem.dataset.index = index;

  let tooltipContentElem = document.createElement("div");
  var tooltipFunctionReady;

  if (isSearchResult) {
    elem.dataset.title = data.title;
    elem.dataset.url = data.url;
    elem.dataset.image = data.image;
    elem.dataset.url = data.url;
    elem.style.backgroundImage = `url( ${data.image} )`;

    tooltipContentElem.innerHTML = "<span>" + data.title + "</span><span class='podcasts_control podcasts_control--subscribe material-icons md-18'>add</span>";

    tooltipFunctionReady = function(e) {
      e.popper.getElementsByClassName("podcasts_control--subscribe")[0].onclick = function() {
        cbus.data.subscribeFeed({
          title: e.reference.dataset.title,
          url: e.reference.dataset.url,
          image: e.reference.dataset.image
        }, true);
      };
    };
  } else {
    elem.style.backgroundImage = "url('" + cbus.data.getPodcastImageURI(data) + "')";

    tooltipContentElem.innerHTML = "<span>" + data.title + "</span><span class='podcasts_control podcasts_control--unsubscribe material-icons md-18'>delete</span>";

    tooltipFunctionReady = function(e) {
      e.popper.getElementsByClassName("podcasts_control--unsubscribe")[0].onclick = function() {
        let feedData = cbus.data.getFeedData({
          index: Number(e.reference.dataset.index)
        });

        cbus.data.unsubscribeFeed({ url: feedData.url }, true);
      };
    };
  }

  tippy(elem, {
    html: tooltipContentElem,
    placement: "top",
    interactive: true,
    arrow: true,
    animation: "perspective",
    size: "large",
    onShown: function(e) {
      e.popper.style.transitionProperty = "none";
      tooltipFunctionReady(e);
    },
    onHide: function(e) {
      e.popper.style.transitionProperty = null;
    }
  });

  elem.onclick = function() {
    var url;
    if (this.dataset.url) {
      url = this.dataset.url;
    } else {
      let data = cbus.data.getFeedData({
        index: $(".podcasts_feeds--subscribed .podcasts_feed").index($(this))
      });
      url = data.url;
    }
    cbus.broadcast.send("showPodcastDetail", {
      url: url
    });
  };

  return elem;
};

(function() {
  let template = document.createElement("div");
  template.classList.add("episode");
  template.innerHTML = '<div class="episode_top">\
    <div class="episode_info-button"></div>\
    <div class="episode_info">\
      <div class="episode_image"></div>\
      <div class="episode_text">\
        <h3 class="episode_title"></h3>\
        <div class="episode_meta-container">\
          <span class="episode_feed-title"></span> •\
          <span class="episode_length"></span>\
        </div>\
      </div>\
    </div>\
    <div class="episode_buttons">\
      <button class="button episode_button episode_button--completed material-icons md-24">check</button>\
      <button class="button episode_button episode_button--download material-icons md-24">file_download</button>\
      <button class="button episode_button episode_button--enqueue material-icons md-24">playlist_add</button>\
      <button class="button episode_button episode_button--remove-from-queue material-icons md-24">remove_circle</button>\
      <button class="button episode_button episode_button--play material-icons md-24">play_arrow</button>\
    </div>\
  </div>\
  <div class="episode_bottom">\
    <div class="episode_date">\
      <a target="_blank"></a>\
    </div>\
    <div class="episode_description"></div>\
  </div>';

  cbus.ui.makeEpisodeElem = function(info) {
    let elem = template.cloneNode(true);
    elem.dataset.id = info.url;
    if (info.hasOwnProperty("index")) {
      elem.dataset.index = info.index;
    }

    elem.getElementsByClassName("episode_title")[0].textContent = info.title;
    elem.getElementsByClassName("episode_feed-title")[0].textContent = info.feedTitle;
    elem.getElementsByClassName("episode_length")[0].textContent = colonSeparateDuration(info.length);
    elem.getElementsByClassName("episode_image")[0].style.backgroundImage = `url('${cbus.data.getPodcastImageURI({
      url: info.feedUrl, image: info.image
    })}')`;
    elem.getElementsByClassName("episode_title")[0].setAttribute("title", info.title);
    let dateElem = elem.getElementsByClassName("episode_date")[0].children[0];
    dateElem.setAttribute("href", info.url);
    dateElem.textContent = info.date ? moment(info.date).calendar() : "";
    elem.getElementsByClassName("episode_description")[0].textContent = twttr.txt.autoLink(info.description);

    if (info.isQueueItem) {
      elem.getElementsByClassName("episode_button--enqueue")[0].style.display = "none";
    } else {
      elem.getElementsByClassName("episode_button--remove-from-queue")[0].style.display = "none";
    }

    return elem;
  };
}());

(function() {
  let template = document.createElement("div");
  template.classList.add("podcast-detail_episode");
  template.innerHTML = '<div class="podcast-detail_episode_container">\
    <div class="podcast-detail_episode_info">\
      <h3 class="podcast-detail_episode_title"></h3>\
      <div class="podcast-detail_episode_description-container no-style">\
        <div class="podcast-detail_episode_date"></div>\
        <p class="podcast-detail_episode_description"></p>\
      </div>\
    </div>\
    <div class="podcast-detail_episode_buttons">\
      <button class="button podcast-detail_episode_button podcast-detail_episode_button--play material-icons md-36">play_arrow</button>\
      <button class="button podcast-detail_episode_button podcast-detail_episode_button--enqueue material-icons md-36">playlist_add</button>\
      <button class="button podcast-detail_episode_button podcast-detail_episode_button--download material-icons md-36">file_download</button>\
    </div>\
  </div>';

  cbus.ui.makePodcastDetailEpisodeElem = function(info) {
    let elem = template.cloneNode(true);

    let descriptionTrimmed = decodeHTML(info.description).trim();
    elem.dataset.title = info.title;
    elem.dataset.description = descriptionTrimmed;
    if (descriptionTrimmed.length > 250) { // 50 * avg word length in English
      descriptionTrimmed = descriptionTrimmed.substring(0, 250) + "…";
    }

    elem.getElementsByClassName("podcast-detail_episode_title")[0].textContent = info.title;
    elem.getElementsByClassName("podcast-detail_episode_date")[0].textContent = moment(info.date).calendar();
    elem.getElementsByClassName("podcast-detail_episode_description")[0].textContent = descriptionTrimmed;

    elem.getElementsByClassName("podcast-detail_episode_button--play")[0].onclick = function() {
      cbus.audio.setElement(document.querySelector(".audios [data-id='" + info.id + "']"));
      cbus.audio.play();
    };
    elem.getElementsByClassName("podcast-detail_episode_button--enqueue")[0].onclick = function() {
      cbus.audio.enqueue(document.querySelector(".audios [data-id='" + info.id + "']"));
    };
    elem.getElementsByClassName("podcast-detail_episode_button--download")[0].onclick = function() {
      cbus.data.downloadEpisode(document.querySelector(".audios [data-id='" + info.id + "']"));
    };

    return elem;
  };
}());

cbus.ui.setFullscreen = function(fullscreenOn) {
  document.body.classList[fullscreenOn ? "add" : "remove"]("video-fullscreen");
  cbus.ui.browserWindow.setFullScreen(fullscreenOn);
};

cbus.ui.updateThumbarButtons = function() {
  cbus.ui.browserWindow.setThumbarButtons([{
    tooltip: cbus.audio.element.paused ? i18n.__("button_playback-play") : i18n.__("button_playback-pause"),
    icon: path.join(__dirname, "img", `ic_${cbus.audio.element.paused ? "play_arrow" : "pause"}_white_24dp_1x.png`),
    click: cbus.audio.element.paused ? cbus.audio.play : cbus.audio.pause
  }, {
    tooltip: i18n.__("button_playback-next"),
    icon: path.join(__dirname, "img", `ic_skip_next_${cbus.audio.queue.length ? "white" : "black"}_24dp_1x.png`),
    flags: [ cbus.audio.queue.length ? "enabled" : "disabled" ],
    click: function() { cbus.audio.playQueueItem(0) }
  }]);
};

/* moving parts */

(function() { // developer.mozilla.org/en-US/docs/Web/Events/resize
  var throttle = function(type, name, obj) {
    obj = obj || window;
    var running = false;
    var func = function() {
      if (running) { return; }
      running = true;
      requestAnimationFrame(function() {
        obj.dispatchEvent(new CustomEvent(name));
        running = false;
      });
    };
    obj.addEventListener(type, func);
  };

  throttle("resize", "resize_throttled");
  throttle("scroll", "scroll_throttled", cbus.ui.homeListElem);
})();

cbus.broadcast.listen("audioChange", (e) => {
  if (!e.data.isVideo) {
    cbus.ui.setFullscreen(false);
  }

  cbus.ui.firstrunContainerElem.classList.remove("visible");
});

cbus.broadcast.listen("showPodcastDetail", function(e) {
  $("body").addClass("podcast-detail-visible"); // open sidebar without data

  // display
  $(".podcast-detail_header").css({ backgroundColor: "" });
  $(".podcast-detail_header_image").css({ backgroundImage: "" });
  $(".podcast-detail_header_title").empty();
  $(".podcast-detail_header_publisher").empty();
  $(".podcast-detail_control--toggle-subscribe").removeClass("subscribed").off("click");
  $(".podcast-detail_episodes").empty();
  $(".podcast-detail_header_description").empty();

  // setTimeout(function() {
  //   $(".content-container").on("click", function() {
  //     cbus.broadcast.send("hidePodcastDetail");
  //     $(".content-container").off("click");
  //   });
  // }, 10); // needs a timeout to work, for some reason

  $(".podcast-detail_header").removeClass("light-colors");
});

cbus.broadcast.listen("hidePodcastDetail", function(e) {
  document.body.classList.remove("podcast-detail-visible");
  cbus.data.state.podcastDetailCurrentData = { url: null };
});

cbus.broadcast.listen("gotPodcastData", function(e) {
  var feedData = cbus.data.getFeedData({ url: e.data.url });
  var podcastImage; // can be URL string or Blob
  podcastImage = feedData.image || e.data.image;

  let podcastImageElem = document.getElementsByClassName("podcast-detail_header_image")[0];
  podcastImageElem.style.backgroundImage =
    "url('" + cbus.data.getPodcastImageURI({
      url: feedData.url, image: podcastImage
    }) + "')";

  $(".podcast-detail_header_title").text(e.data.title);
  $(".podcast-detail_header_publisher").text(e.data.publisher);
  if (e.data.description) {
    $(".podcast-detail_header_description").text(removeHTMLTags(e.data.description).trim());
  }

  if (cbus.data.feedIsSubscribed({ url: cbus.data.state.podcastDetailCurrentData.url })) {
    $(".podcast-detail_control--toggle-subscribe").addClass("subscribed");
  }
  $(".podcast-detail_control--toggle-subscribe").on("click", function() {
    var broadcastData = {
      url: cbus.data.state.podcastDetailCurrentData.url,
      image: e.data.image,
      title: e.data.title
    };

    cbus.broadcast.send("toggleSubscribe", broadcastData);
  });

  // colorify
  cbus.ui.colorify({
    image: podcastImage,
    feedUrl: feedData.url,
    element: $(".podcast-detail_header")
  });
});

(function(){
  let podcastDetailEpisodesElem = document.getElementsByClassName("podcast-detail_episodes")[0];

  cbus.broadcast.listen("gotPodcastEpisodes", function(e) {
    e.data.episodes.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    for (let i = 0, l = e.data.episodes.length; i < l; i++) {
      let episode = e.data.episodes[i];

      let elem = cbus.ui.makePodcastDetailEpisodeElem({
        title: episode.title,
        description: episode.description,
        date: episode.date,
        id: episode.id
      });

      if (cbus.data.episodesOffline.indexOf(episode.url) !== -1) {
        elem.getElementsByClassName("podcast-detail_episode_button--download")[0].textContent = "offline_pin";
      }

      podcastDetailEpisodesElem.appendChild(elem);
    }
  });

  /* search within podcast */

  let podcastDetailSearchInput = document.getElementsByClassName("podcast-detail_control--search")[0];

  let handlePodcastDetailSearch = function(self) {
    if (podcastDetailEpisodesElem.children.length > 0) {
      let query = self.value.trim();
      if (query.length > 0) {
        let pattern = new RegExp(query, "i");
        for (let i = 0, l = podcastDetailEpisodesElem.children.length; i < l; i++) {
          let episodeElem = podcastDetailEpisodesElem.children[i];
          if (pattern.test(episodeElem.dataset.title) || pattern.test(episodeElem.dataset.description)) {
            episodeElem.classList.remove("hidden");
          } else {
            episodeElem.classList.add("hidden");
          }
        }
      } else {
        for (let i = 0, l = podcastDetailEpisodesElem.children.length; i < l; i++) {
          podcastDetailEpisodesElem.children[i].classList.remove("hidden");
        }
      }
    }
  };

  podcastDetailSearchInput.addEventListener("keydown", function(e) {
    if (e.keyCode === 13) {
      handlePodcastDetailSearch(this);
    }
  });

  podcastDetailSearchInput.addEventListener("input", function() {
    if (this.value.trim().length === 0) {
      handlePodcastDetailSearch(this);
    }
  });
}());

/* listen for queue change */
cbus.broadcast.listen("queueChanged", function(e) {
  if (!e.data.fromUI) {
    if (cbus.audio.queue.length === 0) {
      document.body.classList.add("queue-empty");
    } else {
      document.body.classList.remove("queue-empty");
    }

    cbus.ui.queueListElem.innerHTML = "";
    for (let i = 0, l = cbus.audio.queue.length; i < l; i++) {
      let queueItem = cbus.audio.queue[i];

      let data = cbus.data.getEpisodeData({ audioElement: queueItem });
      let feed = cbus.data.getFeedData({ url: data.feedURL });

      let queueItemElem = cbus.ui.makeEpisodeElem({
        title: data.title,
        feedTitle: feed.title,
        feedUrl: feed.url,
        length: data.length,
        image: feed.image,
        isQueueItem: true,
        url: data.url,
        description: data.description
      });

      cbus.ui.queueListElem.append(queueItemElem);
    }

    sortable(cbus.ui.queueListElem); // reload queue sortable
  }
}, true);

cbus.broadcast.listen("episodeEnqueue", function(e) {
  if (!e.data.hiddenEnqueue) {
    cbus.ui.showSnackbar(i18n.__("snackbar_added-to-queue", e.data.episodeData.title));
  }
});

/* set up queue sortable */
sortable(cbus.ui.queueListElem, { items: ".episode" });
sortable(cbus.ui.queueListElem)[0].addEventListener("sortupdate", function(e) {
  let episodeElems = cbus.ui.queueListElem.getElementsByClassName("episode");
  for (let i = 0, l = episodeElems.length; i < l; i++) {
    let mediaElem = cbus.ui.mediaElemsContainer.querySelector("[data-id='" + episodeElems[i].dataset.id + "']");
    cbus.audio.queue.splice(i, 1, mediaElem);
  }
  cbus.broadcast.send("queueChanged", { fromUI: true });
});

/* listen for J, K/space, L keyboard shortcuts */
$(document).on("keypress", function(e) {
  if (e.target.tagName.toLowerCase() !== "input") {
    e.preventDefault();
    if (e.keyCode === KEYCODES.j || e.keyCode === KEYCODES.J) {
      cbus.audio.jump(cbus.audio.DEFAULT_JUMP_AMOUNT_BACKWARD);
    } else if (e.keyCode === KEYCODES.l || e.keyCode === KEYCODES.L) {
      cbus.audio.jump(cbus.audio.DEFAULT_JUMP_AMOUNT_FORWARD);
    } else if (
      e.keyCode === KEYCODES.k || e.keyCode === KEYCODES.K ||
      e.keyCode === KEYCODES._space
    ) {
      if (cbus.audio.element.paused) {
        cbus.audio.play();
      } else {
        cbus.audio.pause();
      }
    }
  }
});

// $(".settings_button--remove-duplicate-feeds").on("click", function() {
//   cbus.broadcast.send("removeDuplicateFeeds");
// });
//
// $(".settings_button--update-feed-artworks").on("click", function() {
//   cbus.broadcast.send("updateFeedArtworks");
// });

$(".settings_button--generate-opml").on("click", function() {
  cbus.broadcast.send("makeFeedsBackup");
});

$(".settings_button--import-opml").on("click", function() {
  cbus.broadcast.send("startFeedsImport");
});

$(".settings_button--update-feed-artworks").on("click", function() {
  cbus.broadcast.send("updateFeedArtworks");
});

$(".settings_button--manage-downloaded-episodes").on("click", function() {
  let downloadedEpisodesPath = cbus.const.OFFLINE_STORAGE_DIR;
  remote.shell.showItemInFolder(downloadedEpisodesPath);
});

$(".settings_button--open-devtools").on("click", function() {
  cbus.ui.browserWindow.webContents.openDevTools();
});

document.getElementsByClassName("settings_version-string")[0].textContent = require(
  path.join(__dirname, "../..", "package.json")
).version;
document.getElementsByClassName("settings_licenses-link")[0].href = path.join(__dirname, "..", "licenses.html");
document.getElementsByClassName("settings_issue-reporter-link")[0].href = path.join(__dirname, "report-issue.html");
document.getElementsByClassName("settings_issue-reporter-link")[0].href = path.join(__dirname, "report-issue.html");
document.getElementsByClassName("settings_github-link")[0].addEventListener("click", (e) => {
  e.preventDefault();
  remote.shell.openExternal("https://github.com/z-------------/cumulonimbus/");
});
document.getElementsByClassName("settings_buy-me-a-coffee-link")[0].addEventListener("click", (e) => {
  e.preventDefault();
  remote.shell.openExternal("https://www.buymeacoffee.com/zackguard");
});

/* populate settings locale select */

(function() {
  let availableLocales = i18n.getAvailableLocales(true); // canonical only
  for (let i = 0, l = availableLocales.length; i < l; i++) {
    let optionElem = document.createElement("option");
    optionElem.setAttribute("value", availableLocales[i]);
    optionElem.textContent = i18n.readLocaleFile(availableLocales[i]).__locale_name__;
    cbus.ui.settingsLocaleSelectElem.appendChild(optionElem);
  }
}());

/* settings */

(function() {
  let mappingPairElemTemplate = document.createElement("div");
  mappingPairElemTemplate.innerHTML = '\
<div class="settings_label">\
<div class="settings_label_left"><input type="text" placeholder="--"/></div>\
<div class="settings_label_right"><select></select></div>\
</div>\
  ';
  function makeMappingPairElem(settingKey, valueOptions, key, value) {
    let elem = mappingPairElemTemplate.cloneNode(true);
    elem.getElementsByTagName("input")[0].value = key;
    let selectElem = elem.getElementsByTagName("select")[0];
    for (let i = 0, l = valueOptions.length; i < l; i++) {
      let optionElem = document.createElement("option");
      optionElem.setAttribute("value", valueOptions[i]);
      optionElem.textContent = i18n.__("label_keyboard-shortcuts_action_" + valueOptions[i]);
      selectElem.appendChild(optionElem);
    }
    if (value) selectElem.value = value;
    return elem;
  }

  let settingsElems = document.querySelectorAll("[data-setting-key]");
  for (let i = 0, l = settingsElems.length; i < l; i++) {
    let elem = settingsElems[i];

    if (elem.dataset.settingType === "mapping") {
      let map = cbus.settings.data[elem.dataset.settingKey];
      let valueOptions = elem.dataset.settingValueoptions.split(";");
      for (let key in map) {
        elem.appendChild(makeMappingPairElem(elem.dataset.settingKey, valueOptions, key, map[key]));
      }
      // plus an empty one
      elem.appendChild(makeMappingPairElem(elem.dataset.settingKey, valueOptions, "", null));

      elem.addEventListener("change", e => {
        var newMap = {};
        let inputElems = elem.getElementsByTagName("input");
        let selectElems = elem.getElementsByTagName("select");
        for (let j = 0, m = inputElems.length; j < m; j++) {
          if (inputElems[j].value) {
            newMap[inputElems[j].value] = selectElems[j].value;
          }
        }
        cbus.settings.writeSetting(elem.dataset.settingKey, newMap, err => {
          // TODO: put the snackbar stuff into the writeSetting function itself
          if (err) {
            cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-fail"), "error");
          } else if (typeof elem.dataset.settingNeedrestart !== "undefined") {
            cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-success-restart"));
          } else {
            cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-success"));
          }
        });

        if (inputElems[inputElems.length - 1].value !== "") {
          // add a new empty mapping row
          elem.appendChild(makeMappingPairElem(elem.dataset.settingKey, valueOptions, "", null));
        }
      });
    } else {
      if (elem.getAttribute("type") === "checkbox") {
        elem.checked = cbus.settings.data[elem.dataset.settingKey];
      } else {
        elem.value = cbus.settings.data[elem.dataset.settingKey];
      }

      elem.addEventListener("change", e => {
        var isValid = true;
        var typedValue = e.target.value;
        if (elem.dataset.settingType) {
          if (elem.dataset.settingType === "number") {
            typedValue = Number(e.target.value);
            isValid = !Number.isNaN(typedValue);
          } else if (elem.dataset.settingType === "boolean") {
            typedValue = e.target.checked;
          }
        }
        if (isValid) {
          cbus.settings.writeSetting(elem.dataset.settingKey, typedValue, err => {
            // TODO: put the snackbar stuff into the writeSetting function itself
            if (err) {
              cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-fail"), "error");
            } else if (typeof elem.dataset.settingNeedrestart !== "undefined") {
              cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-success-restart"));
            } else {
              cbus.ui.showSnackbar(i18n.__("snackbar_setting-save-success"));
            }
          });
        }
      });
    }
  }
}());

/* end settings */

$(".podcast-detail_close-button").on("click", function() {
  cbus.broadcast.send("hidePodcastDetail");
});

cbus.ui.updateEpisodeOfflineIndicator = function(episodeURL) {
  let isDownloaded = (cbus.data.episodesOffline.indexOf(episodeURL) !== -1);

  let $episodeElems = $(`.episode[data-id="${episodeURL}"]`);
  if (isDownloaded) {
    $episodeElems.find(".episode_button--download").text("offline_pin");
  } else {
    $episodeElems.find(".episode_button--download").text("file_download")
  }

  let $podcastEpisodeElems = $(`.podcast-detail_episode[id="${episodeURL}"]`);
  if (isDownloaded) {
    $podcastEpisodeElems.find(".podcast-detail_episode_button--download").text("offline_pin");
  } else {
    $podcastEpisodeElems.find(".podcast-detail_episode_button--download").text("file_download")
  }
};

cbus.ui.updateEpisodeCompletedIndicator = function(episodeURL, completed) {
  console.log(episodeURL, completed)
  let $episodeElems = $(`.episode[data-id="${episodeURL}"]`);
  let $podcastEpisodeElems = $(`.podcast-detail_episode[id="${episodeURL}"]`);

  if (completed) {
    $episodeElems.find(".episode_button--completed").text("check_circle");
    $podcastEpisodeElems.find(".podcast-detail_episode_button--completed").text("check_circle");
  } else {
    $episodeElems.find(".episode_button--completed").text("check");
    $podcastEpisodeElems.find(".podcast-detail_episode_button--completed").text("check");
  }
};

cbus.broadcast.listen("episode_completed_status_change", function(e) {
  cbus.ui.updateEpisodeCompletedIndicator(e.data.id, e.data.completed);
});

/* waveform */

if (cbus.settings.data.enableWaveformVisualization) {
  (function(){
    console.log("waveform");

    var canvas = document.querySelector("#player_waveform");
    var ctx = canvas.getContext("2d");

    canvas.height = 300; // arbitrary constant

    const CANVAS_BASELINE = canvas.height;
    const SKIP = 5;
    const CUTOFF = 0.7; // keep only first 70% of streamData
    var initTimeout;

    var audioStream;
    var recordingLength = 0;
    var sampleRate;
    var audioVolume = 0;
    var audioInput;
    var volume;
    var recorder;
    var columnWidth;
    var streamData;
    var animationFrameRequestID;

    var context = new AudioContext();

    function calculateCanvasDimens() {
      canvas.width = cbus.ui.playerElement.getClientRects()[0].width;
      columnWidth = canvas.width / (streamData.length * CUTOFF - SKIP) * SKIP;
    }

    function startAnalyzing(audioInput, element) {
      // retrieve sample rate to be used for wav packaging
      sampleRate = context.sampleRate;

      // create gain node and analyser
      volume = context.createGain();

      var analyser = context.createAnalyser();
      analyser.fftSize = 256;

      // connect nodes
      audioInput.connect(volume);
      volume.connect(analyser);

      streamData = new Uint8Array(analyser.fftSize / 2);

      // lower values -> lower latency.
      // higher values -> avoid audio breakup and glitches
      var bufferSize = Math.pow(2, 8);
      recorder = context.createScriptProcessor(bufferSize, 2, 2);

      recorder.onaudioprocess = function(e) {
        // console.log("audioprocess");

        if (!element.paused && document.hasFocus()) {
          recordingLength += bufferSize;

          // get volume
          analyser.getByteFrequencyData(streamData);

          // console.log(streamData[0], streamData[Math.floor(bufferSize / 2)], streamData[bufferSize - 1]);
        }
      };

      calculateCanvasDimens();
      window.requestAnimationFrame(draw);

      // connect recorder
      volume.connect(recorder);
      recorder.connect(context.destination);

      audioInput.connect(context.destination);
    }

    // draw function
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";

      ctx.beginPath();
      ctx.moveTo(0, CANVAS_BASELINE);

      /* the following code block from "Foundation ActionScript 3.0 Animation: Making things move" (p. 95), via Homan (stackoverflow.com/a/7058606/3234159), modified. */
      // move to the first point
      ctx.lineTo(0, CANVAS_BASELINE - (streamData[0] / 500 * canvas.height));

      for (let i = SKIP, l = streamData.length * CUTOFF * SKIP; i < l; i += SKIP) {
        let xc = (i / SKIP * columnWidth + (i / SKIP + 1) * columnWidth) / 2;
        let yc = (CANVAS_BASELINE - (streamData[i] / 500 * canvas.height) + CANVAS_BASELINE - (streamData[i + SKIP] / 500 * canvas.height)) / 2;
        ctx.quadraticCurveTo(i / SKIP * columnWidth, CANVAS_BASELINE - (streamData[i] / 500 * canvas.height), xc, yc);
      }
      /* end code block */

      ctx.lineTo(canvas.width, CANVAS_BASELINE);
      ctx.closePath();
      ctx.fill();

      animationFrameRequestID = window.requestAnimationFrame(draw);
    }

    function initWaveform() {
      console.log("initWaveform");

      try {
        audioInput = context.createMediaElementSource(cbus.audio.element);
      } catch (e) {
        console.log("media already connected");
      }

      startAnalyzing(audioInput, cbus.audio.element);
    }

    function resumeWaveform() {
      if (!animationFrameRequestID) {
        draw();
      }
    }

    function stopWaveform() {
      if (animationFrameRequestID) {
        window.cancelAnimationFrame(animationFrameRequestID);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationFrameRequestID = undefined;
      }

      // if (context) {
      //   context.close();
      // }

      // audioStream.getAudioTracks().forEach(function(track) {
      //   track.stop();
      // });

      // recorder.onaudioprocess = null;
    }

    window.onblur = function() {
      stopWaveform();
    };

    window.onfocus = function() {
      resumeWaveform();
    };

    window.addEventListener("resize_throttled", calculateCanvasDimens);

    // cbus.broadcast.listen("audio-play", initWaveform);
    // cbus.broadcast.listen("audio-pause", stopWaveform);
    // cbus.broadcast.listen("audio-stop", stopWaveform);
    cbus.broadcast.listen("audioChange", function() {
      stopWaveform();
      initWaveform();
    });
  }());
}

cbus.ui.resizeVideoCanvas = function() {
  if (document.body.classList.contains("video-fullscreen")) {
    cbus.ui.videoCanvasElement.height = window.screen.height;
    cbus.ui.videoCanvasElement.width = window.screen.height * 16 / 9;
  } else {
    cbus.ui.videoCanvasElement.width = cbus.ui.playerElement.getClientRects()[0].width;
    cbus.ui.videoCanvasElement.height = cbus.ui.videoCanvasElement.width * 9 / 16;
  }
};

window.addEventListener("resize_throttled", cbus.ui.resizeVideoCanvas);
cbus.ui.resizeVideoCanvas();

cbus.ui.homeListElem.addEventListener("scroll_throttled", (e) => {
  if (
    e.target.scrollTop + e.target.offsetHeight === e.target.scrollHeight &&
    !cbus.data.state.loadingNextHomePage
  ) {
    cbus.data.state.loadingNextHomePage = true;

    let afterIndex = Number(cbus.ui.homeListElem.children[cbus.ui.homeListElem.children.length - 1].dataset.index);
    cbus.ui.display("episodes", {
      afterIndex: afterIndex
    });
    cbus.data.updateMedias({
      afterIndex: afterIndex
    });
  }
});

/* filters */

cbus.ui.satisfiesFilters = function(data, filters) {
  let dayToMS = 24 * 60 * 60 * 1000;
  /*
  filters: {
    date: "any" | Number days,
    length: "any" | Number minutes,
    offline: "any" | "true",
    progress: "any" | "unplayed" | "partial" | "finished"
  }
  */
  if (typeof filters.date === "number") {
    if (new Date() - new Date(data.date) > filters.date * dayToMS) {
      return false;
    }
  }
  if (typeof filters.length === "number") {
    if (data.length > filters.length * 60) {
      return false;
    }
  }
  if (filters.offline === "true") {
    if (cbus.data.episodesOffline.indexOf(data.url) === -1) {
      return false;
    }
  }
  if (filters.progress !== "any") {
    let progress = cbus.data.getEpisodeProgress(data.url);
    if (filters.progress === "unplayed") {
      if (!(!progress || !progress.time && !progress.completed)) {
        return false;
      }
    } else if (filters.progress === "partial") {
      if (!(progress.time > 0 && !progress.completed)) {
        return false;
      }
    } else if (filters.progress === "finished") {
      if (!progress.completed) {
        return false;
      }
    }
  }
  return true;
};

cbus.ui.applyFilters = function(filters) {
  let listItems = cbus.ui.homeListElem.children;
  for (let i = 0, l = listItems.length; i < l; i++) {
    let elem = listItems[i];
    let data = cbus.data.getEpisodeData({ index: i });
    if (cbus.ui.satisfiesFilters(data, cbus.ui.currentFilters)) {
      elem.classList.remove("hidden");
    } else {
      elem.classList.add("hidden");
    }
  }
};

document.getElementsByClassName("filters")[0].addEventListener("change", function(e) {
  let selectElems = this.children;
  for (let i = 0, l = selectElems.length; i < l; i++) {
    let selectElem = selectElems[i];
    if (selectElem.value !== "any" && (selectElem.name === "date" || selectElem.name === "length")) {
      cbus.ui.currentFilters[selectElem.name] = Number(selectElem.value);
    } else {
      cbus.ui.currentFilters[selectElem.name] = selectElem.value;
    }
  }
  cbus.ui.applyFilters(cbus.ui.currentFilters);
});

/* end filters */

cbus.broadcast.listen("offline_episodes_changed", function(info) {
  cbus.ui.updateEpisodeOfflineIndicator(info.data.episodeURL);
});

/* hide elements that are not on-screen (reduce draw times) */
// setInterval(function() {
//   var listElem = document.getElementsByClassName("list--episodes")[0];
//   var episodeElems = listElem.getElementsByTagName("cbus-episode");
//   var startIndex = Math.floor(listElem.scrollTop / 71) - 5; // 71px = height of episode elem
//   var endIndex = Math.ceil( (listElem.scrollTop + listElem.offsetHeight) / 71 ) + 5;
//   for (let i = 0; i < episodeElems.length; i++) {
//     if (i < startIndex || i > endIndex) {
//       episodeElems[i].classList.add("contents-hidden");
//     } else {
//       episodeElems[i].classList.remove("contents-hidden");
//     }
//   }
// }, 200);

i18n.doDOMReplacement();

tippy(".header_nav a", {
  placement: "right",
  animation: "shift-away",
  arrow: true,
  delay: [500, 0]
});

(function() {
  let playerTogglesElem = document.getElementsByClassName("player-toggles")[0];

  playerTogglesElem.addEventListener("input", (e) => {
    if (e.target.classList.contains("player-toggles_speed")) {
      cbus.audio.setPlaybackRate(Number(e.target.value));
    }
  });

  playerTogglesElem.addEventListener("change", (e) => {
    if (e.target.classList.contains("player-toggles_speed")) {
      localforage.setItem("cbus_playback_speed", Number(e.target.value));
    }
  });

  cbus.broadcast.listen("playbackRateChanged", (e) => {
    playerTogglesElem.getElementsByClassName("player-toggles_speed")[0].value = e.data;
  });

  tippy(document.getElementsByClassName("player_button--toggles")[0], {
    html: playerTogglesElem,
    trigger: "click",
    interactive: true,
    placement: "bottom",
    animation: "shift-away",
    arrow: true
  });

  localforage.getItem("cbus_playback_speed").then((r) => {
    if (r) {
      playerTogglesElem.getElementsByClassName("player-toggles_speed")[0].value = r;
      cbus.audio.element.playbackRate = r;
    }
  });
}());

/* register keyboard shortcuts */

for (let keyboardShortcut in cbus.settings.data.keyboardShortcuts) {
  let actionName = cbus.settings.data.keyboardShortcuts[keyboardShortcut];
  // possible actionName: playpause, skip-backward, skip-forward, next
  var action;
  switch (actionName) {
    case "playpause":
      action = cbus.audio.playpause;
      break;
    case "skip-backward":
      action = function() { cbus.audio.jump(- cbus.settings.data.skipAmountBackward) };
      break;
    case "skip-forward":
      action = function() { cbus.audio.jump(cbus.settings.data.skipAmountForward) };
      break;
    case "next":
      action = function() { cbus.audio.playQueueItem(0) };
      break;
  }
  Mousetrap.bind(keyboardShortcut, action);
}
