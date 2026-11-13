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
    }, 900);
  }
  function onKey(e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish(); }

  video.muted = true;
  video.poster = "assets/video/" + name + ".webp";
  video.src = "assets/video/" + name + ".mp4";

  video.addEventListener("playing", function () {
    box.classList.add("is-playing");
    clearTimeout(timers[0]);
    timers.push(setTimeout(function () { skip.classList.add("is-shown"); }, 900));
  }, { once: true });
  video.addEventListener("ended", finish);
  video.addEventListener("error", finish);
  skip.addEventListener("click", finish);
  document.addEventListener("keydown", onKey);

  timers.push(setTimeout(function () { if (video.paused) finish(); }, 3000)); // не дождались старта
  timers.push(setTimeout(finish, 12000)); // страховка

  var p = video.play();
  if (p && p.catch) p.catch(finish); // автозапуск запрещён (энергосбережение и т.п.)
})();
