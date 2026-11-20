// Tiny helper for the static mockups. No framework, no build step.
// 1. Theme: ?theme=cobalt on any screen, remembered across screens.
// 2. Offer slider: recomputes the sample numbers on the offer screens.
(function () {
  var themes = ["evergreen", "cobalt", "signal", "paper"];
  var q = new URLSearchParams(location.search).get("theme");
  var saved = null;
  try { saved = localStorage.getItem("cs-theme"); } catch (e) {}
  var theme = themes.indexOf(q) >= 0 ? q : themes.indexOf(saved) >= 0 ? saved : "evergreen";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("cs-theme", theme); } catch (e) {}

  // Sample offer maths. Replace with the engine's real quote in the app.
  var GALLONS = 10000, TRIGGER = 4.2, CAP = 5.0, SCENARIO = 4.8, PRICE_PER_PCT = 4.5;
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  function set(name, value) {
    document.querySelectorAll('[data-out="' + name + '"]').forEach(function (el) { el.textContent = value; });
  }
  function render(cov) {
    var covered = GALLONS * cov / 100;
    var pays = covered * (SCENARIO - TRIGGER);
    var extra = GALLONS * (SCENARIO - TRIGGER);
    set("cov", cov + "%");
    set("gal", covered.toLocaleString("en-US") + " gallons");
    set("pays", usd(pays));
    set("carry", usd(extra - pays));
    set("max", usd(covered * (CAP - TRIGGER)));
    set("price", usd(cov * PRICE_PER_PCT));
    var bar = document.querySelector("[data-bar]");
    if (bar) bar.style.width = cov + "%";
  }
  document.addEventListener("DOMContentLoaded", function () {
    var slider = document.querySelector("[data-cov]");
    if (!slider) return;
    slider.addEventListener("input", function () { render(Number(slider.value)); });
    render(Number(slider.value));
  });
})();
