(function () {
  "use strict";

  var config = window.NOVUS_LMS_CONFIG;
  var app = document.getElementById("app");
  var modalRoot = document.getElementById("modalRoot");
  var helpButton = document.getElementById("helpButton");
  var appLoader = document.getElementById("appLoader");
  var loaderTitle = document.getElementById("loaderTitle");
  var loaderProgressBar = document.getElementById("loaderProgressBar");
  var loaderProgressText = document.getElementById("loaderProgressText");

  var state = {
    screen: "welcome",
    shortcutIndex: 0,
    sdnModalShown: false,
  };

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function isIOSSafari() {
    var ua = navigator.userAgent;
    return isIOS() && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  }

  function chooseTelegramInstallLink() {
    if (isIOS()) return config.links.telegramInstall.ios;
    if (isAndroid()) return config.links.telegramInstall.android;
    return config.links.telegramInstall.fallback;
  }

  function updateLoaderProgress(done, total) {
    var percent = total ? Math.round((done / total) * 100) : 100;
    if (loaderProgressBar) loaderProgressBar.style.width = percent + "%";
    if (loaderProgressText) loaderProgressText.textContent = percent + "%";
  }

  function addAsset(list, value) {
    if (!value || typeof value !== "string") return;
    if (/^(https?:|mailto:|tel:|#)/i.test(value)) return;
    if (list.indexOf(value) === -1) list.push(value);
  }

  function collectPreloadAssets() {
    var assets = [];
    addAsset(assets, config.brand.logoPath);
    addAsset(assets, config.brand.heroPath);
    if (config.loader && config.loader.backgroundImage) addAsset(assets, config.loader.backgroundImage);
    if (config.instructions) {
      addAsset(assets, config.instructions.iosSafariFirstStep && config.instructions.iosSafariFirstStep.image);
      (config.instructions.ios || []).forEach(function (step) {
        addAsset(assets, step.image);
      });
      (config.instructions.android || []).forEach(function (step) {
        addAsset(assets, step.image);
      });
    }
    Object.keys(config.videos || {}).forEach(function (key) {
      var video = config.videos[key];
      if (video && video.type === "mp4") addAsset(assets, video.src);
    });
    return assets;
  }

  function preloadImage(src) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = src;
    });
  }

  function preloadVideo(src) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("canplaythrough", finish, { once: true });
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("error", finish, { once: true });
      video.src = src;
      video.load();
      window.setTimeout(finish, 5000);
    });
  }

  function preloadAsset(src) {
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(src)) return preloadVideo(src);
    return preloadImage(src);
  }

  function hideLoader() {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    if (!appLoader) return;
    appLoader.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      appLoader.remove();
    }, 260);
  }

  function preloadBeforeStart(callback) {
    var loaderConfig = config.loader || {};
    if (!loaderConfig.enabled) {
      callback();
      hideLoader();
      return;
    }

    if (loaderTitle && loaderConfig.title) loaderTitle.textContent = loaderConfig.title;
    if (appLoader && loaderConfig.backgroundImage) {
      appLoader.style.setProperty("--loader-bg", "url('" + loaderConfig.backgroundImage.replace(/'/g, "\\'") + "')");
    }

    var startedAt = Date.now();
    var assets = collectPreloadAssets();
    var total = assets.length;
    var done = 0;
    var finished = false;
    updateLoaderProgress(0, total);

    function complete() {
      if (finished) return;
      finished = true;
      var delay = Math.max(0, (loaderConfig.minVisibleMs || 0) - (Date.now() - startedAt));
      window.setTimeout(function () {
        callback();
        hideLoader();
      }, delay);
    }

    if (!total) {
      updateLoaderProgress(1, 1);
      complete();
      return;
    }

    window.setTimeout(complete, loaderConfig.maxWaitMs || 8000);
    Promise.all(assets.map(function (src) {
      return preloadAsset(src).then(function () {
        done += 1;
        updateLoaderProgress(done, total);
      });
    })).then(complete);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function button(label, action, variant) {
    return '<button class="button ' + (variant || "primary") + '" type="button" data-action="' +
      action + '">' + escapeHtml(label) + "</button>";
  }

  function linkButton(label, action) {
    return '<button class="text-link" type="button" data-action="' + action + '">' +
      escapeHtml(label) + "</button>";
  }

  function card(inner, extraClass) {
    return '<section class="card ' + (extraClass || "") + '">' + inner + "</section>";
  }

  function appLogo() {
    return '<header class="topbar"><img class="logo" src="' + escapeHtml(config.brand.logoPath) +
      '" alt="' + escapeHtml(config.brand.logoAlt) + '"></header>';
  }

  function imageBlock(path, alt, className) {
    if (!path) {
      return '<div class="image-placeholder ' + (className || "") + '">' +
        escapeHtml(config.texts.placeholders.image) + "</div>";
    }
    return '<img class="' + (className || "screen-image") + '" src="' + escapeHtml(path) +
      '" alt="' + escapeHtml(alt || config.texts.placeholders.image) +
      '">';
  }

  function renderVideo(video) {
    var type = video && video.type;
    var src = video && video.src;
    if (type === "mp4" && src) {
      return '<div class="video-frame"><video controls preload="metadata" src="' +
        escapeHtml(src) + '"></video></div>';
    }
    if ((type === "youtube" || type === "iframe") && src) {
      return '<div class="video-frame"><iframe src="' + escapeHtml(src) +
        '" title="' + escapeHtml(video.title || config.texts.placeholders.video) +
        '" loading="lazy" allowfullscreen></iframe></div>';
    }
    if (type === "link" && src) {
      return '<div class="video-placeholder"><span class="video-icon">▶</span><p>' +
        escapeHtml(video.placeholder || config.texts.placeholders.video) +
        '</p><a class="inline-link" href="' + escapeHtml(src) + '" target="_blank" rel="noopener">' +
        escapeHtml(config.texts.buttons.openVideo) + '</a></div>';
    }
    return '<div class="video-placeholder"><span class="video-icon">▶</span><p>' +
      escapeHtml((video && video.placeholder) || config.texts.placeholders.video) + "</p></div>";
  }

  function renderWelcome() {
    var t = config.texts;
    return appLogo() + card(
      imageBlock(config.brand.heroPath, config.brand.heroAlt, "hero-image") +
      '<h1>' + escapeHtml(config.app.title) + '</h1>' +
      '<p class="lead"><strong>' + escapeHtml(t.welcome.greeting) + '</strong><br>' +
      escapeHtml(t.welcome.intro) + '</p>' +
      '<p>' + escapeHtml(t.welcome.choose) + '</p>' +
      '<div class="actions">' +
      button(t.buttons.telegramChoice, "telegram-check", "primary") +
      button(t.buttons.sdnChoice, "sdn-direct", "secondary") +
      '</div>'
    );
  }

  function renderTelegramCheck() {
    var t = config.texts;
    return appLogo() + card(
      '<h1>' + escapeHtml(t.telegramCheck.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.telegramCheck.body) + '</p>' +
      '<div class="actions">' +
      button(t.buttons.telegramYes, "telegram-video", "primary") +
      button(t.buttons.telegramNo, "telegram-install", "secondary") +
      linkButton(t.buttons.chooseAnother, "welcome") +
      '</div>'
    );
  }

  function renderTelegramInstall() {
    var t = config.texts;
    return appLogo() + card(
      '<h1>' + escapeHtml(t.telegramInstall.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.telegramInstall.body) + '</p>' +
      '<p class="note">' + escapeHtml(t.telegramInstall.note) + '</p>' +
      '<div class="actions">' +
      '<a class="button primary" href="' + escapeHtml(chooseTelegramInstallLink()) + '" target="_blank" rel="noopener">' +
      escapeHtml(t.buttons.installTelegram) + '</a>' +
      button(t.buttons.telegramInstalled, "telegram-video", "secondary") +
      linkButton(t.buttons.refuseTelegram, "sdn-from-telegram") +
      linkButton(t.buttons.previous, "telegram-check") +
      '</div>'
    );
  }

  function renderTelegramVideo() {
    var t = config.texts;
    return appLogo() + card(
      '<h1>' + escapeHtml(t.telegramVideo.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.telegramVideo.body) + '</p>' +
      renderVideo(config.videos.telegram) +
      '<div class="actions">' +
      button(t.buttons.openTelegramBot, "open-telegram", "primary") +
      linkButton(t.buttons.chooseAnother, "welcome") +
      '</div>'
    );
  }

  function renderSdnVideo() {
    var t = config.texts;
    return appLogo() + card(
      '<h1>' + escapeHtml(t.sdnVideo.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.sdnVideo.body) + '</p>' +
      renderVideo(config.videos.sdn) +
      '<aside class="hint"><strong>' + escapeHtml(t.sdnVideo.badgeHintTitle) + '</strong><p>' +
      escapeHtml(t.sdnVideo.badgeHint) + '</p></aside>' +
      '<div class="actions">' +
      button(t.buttons.continue, "shortcut-intro", "primary") +
      linkButton(t.buttons.chooseAnother, "welcome") +
      '</div>'
    );
  }

  function renderShortcutIntro() {
    var t = config.texts;
    if (!isIOS() && !isAndroid()) {
      return appLogo() + card(
        '<h1>' + escapeHtml(t.desktopFallback.title) + '</h1>' +
        '<p class="lead">' + escapeHtml(t.desktopFallback.body) + '</p>' +
        '<div class="actions">' +
        button(t.buttons.goToSdn, "open-sdn", "primary") +
        linkButton(t.buttons.chooseAnother, "welcome") +
        '</div>'
      );
    }
    return appLogo() + card(
      '<h1>' + escapeHtml(t.shortcutIntro.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.shortcutIntro.body) + '</p>' +
      '<div class="shortcut-mark" aria-hidden="true">СДН</div>' +
      '<div class="actions">' +
      button(t.buttons.showShortcut, "shortcut-slider", "primary") +
      linkButton(t.buttons.skipToSdn, "open-sdn") +
      '</div>'
    );
  }

  function getShortcutSteps() {
    if (isIOS()) {
      var iosSteps = config.instructions.ios.slice();
      if (!isIOSSafari()) iosSteps.unshift(config.instructions.iosSafariFirstStep);
      return iosSteps;
    }
    if (isAndroid()) return config.instructions.android;
    return [];
  }

  function renderShortcutSlider() {
    var t = config.texts;
    var steps = getShortcutSteps();
    if (!steps.length) return renderShortcutIntro();
    var index = Math.max(0, Math.min(state.shortcutIndex, steps.length - 1));
    state.shortcutIndex = index;
    var step = steps[index];
    var progress = Math.round(((index + 1) / steps.length) * 100);
    var nextAction = index === steps.length - 1 ? "shortcut-complete" : "shortcut-next";
    var nextLabel = index === steps.length - 1 ? t.buttons.done : t.buttons.next;

    return appLogo() + card(
      '<p class="step-count">' + escapeHtml(t.slider.stepPrefix) + ' ' + (index + 1) +
      ' ' + escapeHtml(t.slider.stepSeparator) + ' ' + steps.length + '</p>' +
      '<div class="progress" aria-hidden="true"><span style="width:' + progress + '%"></span></div>' +
      imageBlock(step.image, step.alt, "instruction-image") +
      '<h1>' + escapeHtml(t.slider.stepPrefix) + ' ' + (index + 1) + '</h1>' +
      '<h2>' + escapeHtml(step.title) + '</h2>' +
      '<p class="lead">' + escapeHtml(step.text) + '</p>' +
      '<div class="slider-actions">' +
      button(t.buttons.previous, "shortcut-prev", index === 0 ? "secondary disabled" : "secondary") +
      button(nextLabel, nextAction, "primary") +
      '</div>'
    );
  }

  function renderShortcutComplete() {
    var t = config.texts;
    return appLogo() + card(
      '<h1>' + escapeHtml(t.shortcutComplete.title) + '</h1>' +
      '<p class="lead">' + escapeHtml(t.shortcutComplete.body) + '</p>' +
      '<div class="shortcut-mark complete" aria-hidden="true">✓</div>' +
      '<div class="actions">' +
      button(t.buttons.goToSdnAfterShortcut, "open-sdn", "primary") +
      linkButton(t.buttons.skipToSdn, "open-sdn") +
      '</div>'
    );
  }

  function renderModal() {
    var t = config.texts;
    modalRoot.innerHTML = '<div class="modal-backdrop" role="presentation">' +
      '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<h2 id="modalTitle">' + escapeHtml(t.modal.title) + '</h2>' +
      '<p>' + escapeHtml(t.modal.body) + '</p>' +
      '<div class="actions">' +
      button(t.buttons.tryTelegram, "modal-telegram", "primary") +
      button(t.buttons.stillSdn, "modal-sdn", "secondary") +
      '</div></section></div>';
  }

  function renderHelpModal() {
    var help = config.help;
    var phone = help.phone || "";
    var cleanPhone = phone.replace(/\s+/g, "");
    modalRoot.innerHTML = '<div class="modal-backdrop" role="presentation">' +
      '<section class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="helpModalTitle">' +
      '<h2 id="helpModalTitle">' + escapeHtml(help.modalTitle) + '</h2>' +
      '<p>' + escapeHtml(help.modalText) + '</p>' +
      '<div class="admin-contact">' +
      '<span class="admin-label">' + escapeHtml(help.adminLabel) + '</span>' +
      '<strong>' + escapeHtml(help.adminName) + '</strong>' +
      (phone ? '<a class="phone-link" href="tel:' + escapeHtml(cleanPhone) + '">' +
      escapeHtml(phone) + '</a>' : '<span class="phone-empty">' + escapeHtml(help.emptyPhoneText) + '</span>') +
      '</div>' +
      '<div class="actions">' +
      (phone ? '<a class="button primary" href="tel:' + escapeHtml(cleanPhone) + '">' +
      escapeHtml(help.phoneLabel) + '</a>' : '') +
      button(help.closeLabel, "close-modal", "secondary") +
      '</div></section></div>';
  }

  function clearModal() {
    modalRoot.innerHTML = "";
  }

  function render() {
    clearModal();
    var html = "";
    if (state.screen === "welcome") html = renderWelcome();
    if (state.screen === "telegram-check") html = renderTelegramCheck();
    if (state.screen === "telegram-install") html = renderTelegramInstall();
    if (state.screen === "telegram-video") html = renderTelegramVideo();
    if (state.screen === "sdn-video") html = renderSdnVideo();
    if (state.screen === "shortcut-intro") html = renderShortcutIntro();
    if (state.screen === "shortcut-slider") html = renderShortcutSlider();
    if (state.screen === "shortcut-complete") html = renderShortcutComplete();
    app.innerHTML = html;
    try {
      app.focus({ preventScroll: true });
    } catch (error) {
      app.focus();
    }
  }

  function go(screen) {
    state.screen = screen;
    if (screen === "shortcut-slider") state.shortcutIndex = 0;
    render();
  }

  function openSameTab(url) {
    window.location.href = url;
  }

  function handleAction(action) {
    if (!action) return;
    if (action === "welcome") return go("welcome");
    if (action === "telegram-check") return go("telegram-check");
    if (action === "telegram-install") return go("telegram-install");
    if (action === "telegram-video") return go("telegram-video");
    if (action === "shortcut-intro") return go("shortcut-intro");
    if (action === "shortcut-slider") return go("shortcut-slider");
    if (action === "shortcut-complete") return go("shortcut-complete");
    if (action === "open-telegram") return openSameTab(config.links.telegramBotUrl);
    if (action === "open-sdn") return openSameTab(config.links.sdnUrl);
    if (action === "sdn-from-telegram") return go("sdn-video");
    if (action === "sdn-direct") {
      if (config.featureFlags.showTelegramRecommendationModal && !state.sdnModalShown) {
        state.sdnModalShown = true;
        renderModal();
        return;
      }
      return go("sdn-video");
    }
    if (action === "modal-telegram") return go("telegram-check");
    if (action === "modal-sdn") return go("sdn-video");
    if (action === "close-modal") return clearModal();
    if (action === "shortcut-next") {
      state.shortcutIndex += 1;
      return render();
    }
    if (action === "shortcut-prev") {
      if (state.shortcutIndex > 0) state.shortcutIndex -= 1;
      return render();
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-action]");
    if (!target || target.classList.contains("disabled")) return;
    handleAction(target.getAttribute("data-action"));
  });

  document.addEventListener("error", function (event) {
    var target = event.target;
    if (!target || target.tagName !== "IMG") return;
    var fallback = document.createElement("div");
    fallback.className = "image-placeholder";
    fallback.textContent = config.texts.placeholders.image;
    target.replaceWith(fallback);
  }, true);

  function setupHelp() {
    helpButton.querySelector("span:last-child").textContent = config.help.label;
    helpButton.setAttribute("aria-label", config.help.ariaLabel);
    helpButton.href = "#";
    helpButton.addEventListener("click", function (event) {
      event.preventDefault();
      renderHelpModal();
    });
  }

  function registerServiceWorker() {
    if (!config.featureFlags.enableServiceWorker || !("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (registration) {
        registration.update();
      }).catch(function () {
        // The app must keep working when service workers are unavailable.
      });
    });
  }

  setupHelp();
  registerServiceWorker();
  preloadBeforeStart(render);

  window.NOVUSDevice = {
    isIOS: isIOS,
    isAndroid: isAndroid,
    isIOSSafari: isIOSSafari,
    chooseTelegramInstallLink: chooseTelegramInstallLink,
  };
})();
