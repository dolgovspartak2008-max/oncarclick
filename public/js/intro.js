/* OnCarClick — видео-интро при первом заходе на главную (один раз за сессию).
   Телефон (вертикальный экран) — вертикальная версия, ПК — горизонтальная.
   Если видео не стартовало за 3 с, автозапуск запрещён или ошибка — сайт открывается сразу. */
(function () {
  var root = document.documentElement;
  var box = document.getElementById("intro");
  if (!box) return;
  if (!root.classList.contains("has-intro")) { box.remove(); return; }

  var video = box.querySelector(".intro__video");
  var skip = box.querySelector(".intro__skip");
  var portrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
  var name = portrait ? "intro-mobile" : "intro-pc";
  var done = false;
  var timers = [];

  try { sessionStorage.setItem("occ-intro", "1"); } catch (e) {}

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    document.removeEventListener("keydown", onKey);
    box.classList.add("is-out");
    root.classList.add("intro-reveal");
    root.classList.remove("has-intro");
    setTimeout(function () {
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
      box.remove();
      root.classList.remove("intro-reveal");
    }, 1900); // дождались конца плавного перехода
  }
  function onKey(e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish(); }

  video.muted = true;
  video.poster = "assets/video/" + name + ".webp";

  // Форматы от лучшего к запасному: AV1 (самый лёгкий) → HEVC (iPhone/Safari) → H.264 (всё остальное).
  // AV1/HEVC берём, только если устройство декодирует их аппаратно — иначе на слабом телефоне будут рывки.
  var base = "assets/video/" + name;
  var size = portrait ? { width: 1080, height: 2400 } : { width: 1920, height: 1098 };
  var variants = [
    { src: base + "-av1.mp4", codec: portrait ? "av01.0.12M.08" : "av01.0.08M.08", bitrate: 2200000 },
    { src: base + "-hevc.mp4", codec: portrait ? "hvc1.1.6.L150.B0" : "hvc1.1.6.L120.B0", bitrate: 2500000 }
  ];
  var fallback = base + ".mp4";

  function check(v) {
    var type = 'video/mp4; codecs="' + v.codec + '"';
    if (!video.canPlayType(type)) return Promise.resolve(false);
    if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) {
      return Promise.resolve(v.codec.indexOf("hvc1") === 0); // старый Safari: HEVC там аппаратный
    }
    return navigator.mediaCapabilities.decodingInfo({
      type: "file",
      video: { contentType: type, width: size.width, height: size.height, bitrate: v.bitrate, framerate: 24 }
    }).then(function (r) { return r.supported && r.smooth && r.powerEfficient; }, function () { return false; });
  }
  function pick(i) {
    if (i >= variants.length) return Promise.resolve(fallback);
    return check(variants[i]).then(function (ok) { return ok ? variants[i].src : pick(i + 1); });
  }
  function start(src) {
    if (done) return;
    video.src = src;
    var p = video.play();
    if (p && p.catch) p.catch(finish); // автозапуск запрещён (энергосбережение и т.п.)
  }

  video.addEventListener("playing", function () {
    box.classList.add("is-playing");
    clearTimeout(timers[0]);
    timers.push(setTimeout(function () { skip.classList.add("is-shown"); }, 900));
  }, { once: true });
  // переход начинается за 0,9 с до конца ролика — видео ещё играет, а сайт уже проявляется
  video.addEventListener("timeupdate", function () {
    if (video.duration && video.duration - video.currentTime <= 0.9) finish();
  });
  video.addEventListener("ended", finish);
  // если выбранный формат всё же не открылся — пробуем запасной H.264, и только потом сдаёмся
  video.addEventListener("error", function () {
    if (video.src && video.src.indexOf(fallback) === -1) start(fallback); else finish();
  });
  skip.addEventListener("click", finish);
  document.addEventListener("keydown", onKey);

  timers.push(setTimeout(function () { if (video.paused) finish(); }, 4000)); // не дождались старта
  timers.push(setTimeout(finish, 11000)); // страховка

  pick(0).then(start, function () { start(fallback); });
})();
