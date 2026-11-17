/* Contested Worlds — shared renderer.
   Each world page defines a global `WORLD` object and includes this script.
   Renders: hit-class table (#classes), roster with filters (#roster),
   counter matrix (#matrix), synergies (#synergies), compositions (#comps). */
(function () {
  "use strict";

  // ---- theme toggle (per-viewer convenience only) ----
  function initTheme() {
    var root = document.documentElement;
    try {
      var saved = localStorage.getItem("cw-theme");
      if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
    } catch (e) { /* storage unavailable: fall back to system theme */ }
    var btn = document.querySelector(".theme-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme");
      if (!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("cw-theme", next); } catch (e) { /* ignore */ }
    });
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function render(W) {
    var classById = {}, unitById = {}, branchById = {};
    W.classes.forEach(function (c) { classById[c.id] = c; });
    W.units.forEach(function (u) { unitById[u.id] = u; });
    W.branches.forEach(function (b) { branchById[b.id] = b; });
    var lines = W.lines || { front: "Front", middle: "Middle", rear: "Rear" };
    var tiers = W.tiers || ["Early", "Mid", "Late"];
    var reachNames = W.reach || ["Melee", "Short", "Long", "Extreme"];

    function atk(u, cid) { return (u.atk && u.atk[cid]) || 0; }
    function killersOf(u, n) {
      var cls = u.hitAs;
      return W.units
        .filter(function (o) { return o.id !== u.id && o.hitAs !== "ord" && atk(o, cls) >= 3; })
        .sort(function (a, b) { return atk(b, cls) - atk(a, cls); })
        .slice(0, n || 4);
    }

    // ---- hit classes ----
    var classesEl = document.getElementById("classes");
    if (classesEl) {
      var t = '<div class="tbl-wrap"><table><thead><tr><th>Class</th><th>What it covers</th><th>Hit hardest by</th></tr></thead><tbody>';
      W.classes.forEach(function (c) {
        var best = W.units.filter(function (u) { return atk(u, c.id) >= 4; })
          .sort(function (a, b) { return atk(b, c.id) - atk(a, c.id); })
          .slice(0, 5).map(function (u) { return esc(u.name); }).join(", ");
        t += "<tr><td><b>" + esc(c.name) + "</b></td><td>" + c.desc + "</td><td>" + (best || '<span class="muted">nothing specialised</span>') + "</td></tr>";
      });
      t += "</tbody></table></div>";
      classesEl.innerHTML = t;
    }

    // ---- roster ----
    var rosterEl = document.getElementById("roster");
    var filtersEl = document.getElementById("roster-filters");
    if (rosterEl) {
      W.units.forEach(function (u) {
        var c = el("article", { class: "card unit", "data-branch": u.branch });
        var stats =
          '<div class="u-stats">' +
          "<div>Hit as<b>" + esc(classById[u.hitAs] ? classById[u.hitAs].short || classById[u.hitAs].name : u.hitAs) + "</b></div>" +
          "<div>Line<b>" + esc(lines[u.line] || u.line) + "</b></div>" +
          "<div>Reach<b>" + esc(reachNames[u.reach || 0]) + "</b></div>" +
          "<div>Arrives<b>" + esc(tiers[(u.tier || 1) - 1]) + "</b></div>" +
          "<div>Toughness<b>" + "●".repeat(u.tough || 1) + "<span class='muted'>" + "●".repeat(5 - (u.tough || 1)) + "</span></b></div>" +
          "<div>Speed<b>" + "●".repeat(u.speed || 1) + "<span class='muted'>" + "●".repeat(5 - (u.speed || 1)) + "</span></b></div>" +
          "<div>Cost<b>" + esc(u.cost || "—") + "</b></div>" +
          "<div>Claims<b>" + (u.claims ? "Yes" : "No") + "</b></div>" +
          "</div>";
        var bars = '<div class="bars">';
        W.classes.forEach(function (cl) {
          var v = atk(u, cl.id);
          bars += '<span class="lbl">vs ' + esc(cl.short || cl.name) + '</span><span class="bar' + (v ? "" : " zero") + '" title="' + v + '/5"><i style="width:' + v * 20 + '%"></i></span>';
        });
        bars += "</div>";
        var traits = (u.traits && u.traits.length) ? "<ul>" + u.traits.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "";
        var k = killersOf(u, 4);
        c.innerHTML =
          '<div class="u-head"><span class="u-name">' + esc(u.name) + '</span><span class="u-branch">' + esc(branchById[u.branch] ? branchById[u.branch].name : u.branch) + "</span></div>" +
          '<p class="u-role">' + u.role + "</p>" + stats + bars + traits +
          '<div class="sw"><b class="g">Strong:</b> ' + u.strong + '</div><div class="sw"><b class="r">Weak:</b> ' + u.weak + "</div>" +
          '<div class="killers"><b>Dies to:</b> ' + (k.length ? k.map(function (o) { return esc(o.name); }).join(", ") : "few direct answers — see weaknesses") + "</div>";
        rosterEl.appendChild(c);
      });
      if (filtersEl) {
        var all = [{ id: "*", name: "All" }].concat(W.branches);
        all.forEach(function (b) {
          var btn = el("button", { type: "button", "aria-pressed": b.id === "*" ? "true" : "false", "data-b": b.id }, esc(b.name));
          btn.addEventListener("click", function () {
            filtersEl.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
            btn.setAttribute("aria-pressed", "true");
            rosterEl.querySelectorAll(".unit").forEach(function (card) {
              card.style.display = (b.id === "*" || card.getAttribute("data-branch") === b.id) ? "" : "none";
            });
          });
          filtersEl.appendChild(btn);
        });
      }
    }

    // ---- matrix ----
    var mEl = document.getElementById("matrix");
    if (mEl) {
      var h = '<div class="tbl-wrap"><table class="matrix"><thead><tr><th>Attacker</th>';
      W.classes.forEach(function (c) { h += '<th class="h" title="' + esc(c.name) + '">' + esc(c.short || c.name) + "</th>"; });
      h += '<th>Hit as</th></tr></thead><tbody>';
      W.branches.forEach(function (b) {
        var us = W.units.filter(function (u) { return u.branch === b.id; });
        if (!us.length) return;
        h += '<tr class="grp"><td colspan="' + (W.classes.length + 2) + '">' + esc(b.name) + "</td></tr>";
        us.forEach(function (u) {
          h += '<tr><td class="n">' + esc(u.name) + "</td>";
          W.classes.forEach(function (c) {
            var v = atk(u, c.id);
            h += '<td class="h h' + v + '">' + (v ? v : "·") + "</td>";
          });
          h += "<td class='small muted'>" + esc(classById[u.hitAs] ? classById[u.hitAs].short || classById[u.hitAs].name : "") + "</td></tr>";
        });
      });
      h += "</tbody></table></div>";
      mEl.innerHTML = h;
    }

    // ---- synergies ----
    var sEl = document.getElementById("synergies");
    if (sEl && W.synergies) {
      W.synergies.forEach(function (s) {
        var c = el("div", { class: "card" });
        c.innerHTML = "<h4>" + esc(s.name) + '</h4><div class="chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
          s.units.map(function (id) { return '<span class="chip">' + esc(unitById[id] ? unitById[id].name : id) + "</span>"; }).join("") +
          "</div><p class='small'>" + s.why + "</p>";
        sEl.appendChild(c);
      });
    }

    // ---- compositions ----
    var cEl = document.getElementById("comps");
    if (cEl && W.comps) {
      W.comps.forEach(function (cp) {
        var c = el("div", { class: "card comp" });
        var count = 0;
        var chips = cp.units.map(function (pair) {
          count += pair[1];
          var u = unitById[pair[0]];
          return '<span class="chip"><b>' + pair[1] + "×</b>" + esc(u ? u.name : pair[0]) + "</span>";
        }).join("");
        c.innerHTML =
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h4 style="margin:0">' + esc(cp.name) + "</h4>" +
          '<span class="tag acc">' + esc(cp.mode) + "</span></div>" +
          '<div class="chips">' + chips + "</div>" +
          (cp.size ? '<p class="small muted" style="margin:0 0 8px">' + esc(cp.size) + "</p>" : "") +
          "<dl><dt>Idea</dt><dd>" + cp.idea + "</dd><dt>How to play it</dt><dd>" + cp.play + "</dd><dt>How it loses</dt><dd>" + cp.loses + "</dd></dl>";
        cEl.appendChild(c);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    if (window.WORLD) render(window.WORLD);
  });
})();
