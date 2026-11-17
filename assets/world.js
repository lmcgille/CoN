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

  // ---- war map ----
  // W.map = { w, h, terrain: {key: [name, color]}, owners: {key: [name, color]},
  //   nodes: ["id|x|y|terrain|owner|Label|flags"]  flags: c=city, C=capital, s=strategic site, w=water
  //   link: max distance for auto-links, extraLinks: [[a,b]], noLinks: [[a,b]],
  //   moves: [{ n, from, to, kind: "attack"|"air"|"sea"|"strike"|"revolt", text }] }
  function renderMap(W) {
    var host = document.getElementById("map");
    if (!host || !W.map) return;
    var M = W.map, NS = "http://www.w3.org/2000/svg";
    var nodes = M.nodes.map(function (s) {
      var p = s.split("|");
      return { id: p[0], x: +p[1], y: +p[2], t: p[3], o: p[4], label: p[5], f: p[6] || "" };
    });
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var maxD = M.link || 140;
    var banned = {};
    (M.noLinks || []).forEach(function (l) { banned[l[0] + ">" + l[1]] = banned[l[1] + ">" + l[0]] = 1; });
    var links = [];
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) {
      var a = nodes[i], b = nodes[j];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= maxD && !banned[a.id + ">" + b.id]) links.push([a, b, a.f.indexOf("w") >= 0 || b.f.indexOf("w") >= 0]);
    }
    (M.extraLinks || []).forEach(function (l) { if (byId[l[0]] && byId[l[1]]) links.push([byId[l[0]], byId[l[1]], true]); });

    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + M.w + " " + M.h);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Schematic war map");
    svg.style.width = "100%"; svg.style.height = "auto"; svg.style.display = "block";
    function add(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(e); return e;
    }
    var defs = add("defs", {});
    var kinds = { attack: "var(--bad)", air: "var(--accent-2)", sea: "var(--accent)", strike: "var(--accent-2)", revolt: "var(--ink-3)" };
    Object.keys(kinds).forEach(function (k) {
      var mk = add("marker", { id: "ah-" + k, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" }, defs);
      add("path", { d: "M0,0 L10,5 L0,10 z", fill: kinds[k] }, mk);
    });
    add("rect", { x: 0, y: 0, width: M.w, height: M.h, rx: 12, fill: "var(--bg-2)" });
    links.forEach(function (l) {
      add("line", { x1: l[0].x, y1: l[0].y, x2: l[1].x, y2: l[1].y, stroke: "var(--rule)", "stroke-width": l[2] ? 1.5 : 2.5, "stroke-dasharray": l[2] ? "4 4" : "" });
    });
    nodes.forEach(function (n) {
      var ter = M.terrain[n.t] || ["", "#999"];
      var own = M.owners[n.o];
      var r = n.f.indexOf("C") >= 0 ? 15 : n.f.indexOf("c") >= 0 ? 12 : 8;
      var g = add("g", {});
      var title = add("title", {}, g); title.textContent = n.label + " — " + ter[0] + (own ? " · " + own[0] : "");
      if (n.f.indexOf("w") >= 0) {
        add("rect", { x: n.x - r, y: n.y - r, width: r * 2, height: r * 2, rx: 3, fill: ter[1], stroke: "var(--panel)", "stroke-width": 2, transform: "rotate(45 " + n.x + " " + n.y + ")" }, g);
      } else {
        add("circle", { cx: n.x, cy: n.y, r: r + 4, fill: own ? own[1] : "var(--panel)", opacity: own ? 1 : 0.9 }, g);
        add("circle", { cx: n.x, cy: n.y, r: r, fill: ter[1], stroke: "var(--panel)", "stroke-width": 1.5 }, g);
      }
      if (n.f.indexOf("C") >= 0) add("circle", { cx: n.x, cy: n.y, r: 4, fill: "var(--panel)" }, g);
      if (n.f.indexOf("s") >= 0) add("path", { d: "M" + n.x + "," + (n.y - r - 12) + " l5,9 h-10 z", fill: "var(--accent-2)" }, g);
      if (n.f.indexOf("c") >= 0 || n.f.indexOf("C") >= 0 || n.f.indexOf("s") >= 0 || n.f.indexOf("L") >= 0) {
        var t = add("text", { x: n.x, y: n.y + r + 16, "text-anchor": "middle", "font-size": 13, fill: "var(--ink)", "font-family": "var(--body)", "paint-order": "stroke", stroke: "var(--bg-2)", "stroke-width": 4 }, g);
        t.textContent = n.label;
      }
    });
    (M.moves || []).forEach(function (mv) {
      var a = byId[mv.from], b = byId[mv.to];
      if (!a || !b) return;
      var color = kinds[mv.kind] || "var(--bad)";
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      var bend = mv.bend != null ? mv.bend : (mv.kind === "air" || mv.kind === "strike" ? 0.25 : 0.12);
      var cx = mx - dy / len * len * bend, cy = my + dx / len * len * bend;
      var shrink = 20;
      var ex = b.x - (b.x - cx) / Math.hypot(b.x - cx, b.y - cy) * shrink, ey = b.y - (b.y - cy) / Math.hypot(b.x - cx, b.y - cy) * shrink;
      var sx = a.x + (cx - a.x) / Math.hypot(cx - a.x, cy - a.y) * 14, sy = a.y + (cy - a.y) / Math.hypot(cx - a.x, cy - a.y) * 14;
      if (mv.kind === "revolt") {
        add("circle", { cx: b.x, cy: b.y, r: 22, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-dasharray": "3 4" });
      } else {
        add("path", { d: "M" + sx + "," + sy + " Q" + cx + "," + cy + " " + ex + "," + ey, fill: "none", stroke: color, "stroke-width": 3.5, "stroke-dasharray": mv.kind === "air" || mv.kind === "strike" ? "8 6" : mv.kind === "sea" ? "2 5" : "", "stroke-linecap": "round", "marker-end": "url(#ah-" + mv.kind + ")" });
      }
      var lx = mv.kind === "revolt" ? b.x + 20 : (sx + 2 * cx + ex) / 4, ly = mv.kind === "revolt" ? b.y - 20 : (sy + 2 * cy + ey) / 4;
      add("circle", { cx: lx, cy: ly, r: 12, fill: color });
      var tx = add("text", { x: lx, y: ly + 4.5, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--panel)", "font-family": "var(--body)" });
      tx.textContent = mv.n;
    });

    host.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "tbl-wrap"; wrap.style.padding = "8px";
    var inner = document.createElement("div"); inner.style.minWidth = "640px";
    inner.appendChild(svg); wrap.appendChild(inner); host.appendChild(wrap);

    var leg = document.createElement("div");
    leg.className = "grid g2"; leg.style.marginTop = "14px";
    var terr = Object.keys(M.terrain).map(function (k) {
      return '<span class="tag"><svg width="10" height="10" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><circle cx="5" cy="5" r="5" fill="' + M.terrain[k][1] + '"/></svg>' + esc(M.terrain[k][0]) + "</span>";
    }).join("");
    var own = Object.keys(M.owners).map(function (k) {
      return '<span class="tag"><svg width="10" height="10" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><circle cx="5" cy="5" r="5" fill="' + M.owners[k][1] + '"/></svg>' + esc(M.owners[k][0]) + "</span>";
    }).join("");
    var moves = (M.moves || []).filter(function (mv) { return mv.text; }).map(function (mv) { return "<li><b>" + mv.n + ".</b> " + mv.text + "</li>"; }).join("");
    leg.innerHTML = '<div class="card"><h4>Key</h4><p class="small" style="margin-bottom:6px"><b>Terrain</b> (centre colour)</p><div>' + terr +
      '</div><p class="small" style="margin:10px 0 6px"><b>Owner at the start of the war</b> (ring)</p><div>' + own +
      '</div><p class="small muted" style="margin:10px 0 0">Large circle: city · dot: capital · triangle: strategic site · diamond: water · dashed link: sea lane</p></div>' +
      '<div class="card"><h4>The war on the map</h4><ol class="small" style="margin:0;padding-left:0;list-style:none;display:grid;gap:6px">' + moves + "</ol></div>";
    host.appendChild(leg);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.WORLD) renderMap(window.WORLD);
    initTheme();
    if (window.WORLD) {
      render(window.WORLD);
      document.querySelectorAll("[data-count='units']").forEach(function (n) { n.textContent = window.WORLD.units.length; });
    }
  });
})();
