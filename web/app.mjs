import {
  fieldText,
  indexAt,
  kpAt,
  linePath,
  timeAt,
  timeText,
} from "./model.mjs";
const byId = (id) => document.getElementById(id);
const chart = byId("chart"),
  slider = byId("cursor");
const colors = { VIC: "#b4edb3", STJ: "#ffafbb" };
let edition,
  selected = 144,
  plot;

function svg(tag, attributes, content) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, val] of Object.entries(attributes))
    node.setAttribute(key, val);
  if (content !== undefined) node.textContent = content;
  return node;
}

function make(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function link(text, url) {
  const anchor = make("a", text);
  anchor.href = url;
  return anchor;
}

function draw() {
  const width = chart.clientWidth,
    height = chart.clientHeight;
  const left = 40,
    top = 12,
    right = width - 6,
    bottom = height - 25;
  const all = edition.stations.flatMap((station) =>
    station.delta_nT.filter(Number.isFinite),
  );
  const step = 500,
    low = step * Math.floor(Math.min(...all) / step),
    high = step * Math.ceil(Math.max(...all) / step);
  const y = (value) => bottom - ((value - low) / (high - low)) * (bottom - top);
  const x = (index) =>
    left + ((right - left) * index) / (edition.bin_count - 1);
  chart.setAttribute("viewBox", [0, 0, width, height].join(" "));
  chart.replaceChildren(
    svg(
      "title",
      { id: "chart-title" },
      "Northward field changes in Victoria and St. John’s, on one scale. The time cursor below reads both traces.",
    ),
  );
  for (let tick = low; tick <= high; tick += step) {
    chart.append(
      svg("line", {
        x1: left,
        x2: right,
        y1: y(tick),
        y2: y(tick),
        class: tick === 0 ? "grid zero" : "grid",
      }),
    );
    chart.append(
      svg(
        "text",
        {
          x: left - 5,
          y: y(tick) + 3,
          "text-anchor": "end",
          class: "chart-label",
        },
        tick,
      ),
    );
  }
  const ticks =
    width < 550 ? [0, 144, 288, 432] : [0, 72, 144, 216, 288, 360, 432, 503];
  for (const index of ticks) {
    const end = index === edition.bin_count - 1;
    const xx = x(index),
      timestamp = timeText(timeAt(edition, index));
    const label =
      timestamp.slice(7, 12) === "00:00"
        ? timestamp.slice(0, 6)
        : timestamp.slice(7, 12);
    chart.append(
      svg("line", { x1: xx, x2: xx, y1: top, y2: bottom, class: "grid" }),
    );
    chart.append(
      svg(
        "text",
        {
          x: xx,
          y: height - 6,
          "text-anchor": end ? "end" : index === 0 ? "start" : "middle",
          class: "chart-label",
        },
        label,
      ),
    );
  }
  edition.stations.forEach((station) =>
    chart.append(
      svg("path", {
        class: "line " + station.code,
        d: linePath(station.delta_nT, x, y),
      }),
    ),
  );
  const cursor = svg("g", {});
  chart.append(cursor);
  plot = { x, y, left, right, top, bottom, cursor };
  read(selected);
}

function read(index) {
  selected = Math.max(0, Math.min(edition.bin_count - 1, index));
  slider.value = selected;
  const time = timeAt(edition, selected),
    bin = kpAt(edition.storm.kp, time);
  const label = timeText(time) + " UTC";
  slider.setAttribute("aria-valuetext", label);
  byId("selected").textContent = label;
  byId("kp-value").textContent = bin ? String(bin.value) : "—";
  byId("back").disabled = selected === 0;
  byId("next").disabled = selected === edition.bin_count - 1;
  const { x, y, top, bottom, cursor } = plot;
  const xx = x(selected);
  cursor.replaceChildren(
    svg("line", { x1: xx, x2: xx, y1: top, y2: bottom, class: "cursor-line" }),
  );
  for (const station of edition.stations) {
    const value = station.delta_nT[selected];
    byId(station.code.toLowerCase() + "-value").textContent = fieldText(value);
    if (value !== null)
      cursor.append(
        svg("circle", {
          cx: xx,
          cy: y(value),
          r: 4.2,
          fill: colors[station.code],
          class: "point",
        }),
      );
  }
  const binText = bin
    ? timeText(bin.start) +
      " to " +
      timeText(bin.end) +
      " UTC · Kp " +
      bin.value
    : "This time falls outside the Kp intervals listed in the storm record.";
  byId("kp-detail").textContent = binText;
  byId("selection-note").textContent =
    "Five-minute station mean beginning " +
    label +
    ". " +
    (bin
      ? "Kp covers the surrounding three-hour interval."
      : "No Kp value listed for this time.");
  for (const button of byId("bars").children)
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.start === bin?.start),
    );
}

function populate() {
  const { storm } = edition;
  for (const interval of storm.kp) {
    const button = make("button", interval.value);
    button.type = "button";
    button.dataset.start = interval.start;
    button.style.height = 12 + interval.value * 11 + "px";
    button.title =
      timeText(interval.start) +
      " to " +
      timeText(interval.end) +
      " UTC · Kp " +
      interval.value;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () =>
      read(indexAt(edition, interval.start)),
    );
    byId("bars").append(button);
  }
  const events = [
    ...storm.cme.map((row) => ({ ...row, name: "Coronal mass ejection" })),
    { ...storm, name: "Storm interval begins" },
    ...storm.ips.map((row) => ({
      ...row,
      name: "Interplanetary shock at Earth",
    })),
  ];
  for (const event of events.sort((a, b) => a.time.localeCompare(b.time))) {
    const row = make("li"),
      timing = make("time", timeText(event.time) + " UTC", "event-time");
    timing.dateTime = event.time;
    const description = make("span", event.name);
    if (event.region) description.append(make("small", "AR " + event.region));
    const anchor = link("NASA record ↗", event.link);
    anchor.setAttribute(
      "aria-label",
      event.name + " at " + timeText(event.time) + ", NASA record",
    );
    row.append(timing, description, anchor);
    byId("event-list").append(row);
  }
  byId("baselines").textContent =
    "Reference values: " +
    edition.stations
      .map(
        (station) =>
          station.name +
          " " +
          station.baseline_nT.toLocaleString("en-CA", {
            maximumFractionDigits: 2,
          }) +
          " nT",
      )
      .join(" · ") +
    ".";
  for (const station of edition.stations) {
    const item = make("li");
    item.append(
      link(station.name + " definitive measurements", station.data_url),
      " · ",
      link("Station metadata", station.info_url),
    );
    byId("source-links").append(item);
  }
  byId("edition").textContent =
    "Sources retrieved " +
    edition.retrieved +
    " · " +
    edition.count.toLocaleString("en-CA") +
    " five-minute station means · Monthly archive check.";
  slider.max = edition.bin_count - 1;
  slider.disabled = false;
  slider.addEventListener("input", () => read(Number(slider.value)));
  byId("back").onclick = () => read(selected - 1);
  byId("next").onclick = () => read(selected + 1);
  byId("shock").onclick = () => read(indexAt(edition, storm.ips[0].time));
  const peak = Math.max(...storm.kp.map((bin) => bin.value));
  byId("peak").textContent = "First Kp " + peak + " interval";
  byId("peak").onclick = () =>
    read(indexAt(edition, storm.kp.find((bin) => bin.value === peak).start));
  chart.addEventListener("pointerdown", (event) => {
    const rect = chart.getBoundingClientRect();
    read(
      Math.round(
        ((event.clientX - rect.left - plot.left) / (plot.right - plot.left)) *
          (edition.bin_count - 1),
      ),
    );
  });
  draw();
  new ResizeObserver(draw).observe(chart);
}

try {
  const response = await fetch("./data/storm.json");
  if (!response.ok) throw Error("Snapshot unavailable");
  edition = await response.json();
  populate();
} catch {
  byId("selected").textContent = "Data unavailable";
  byId("selection-note").textContent =
    "The storm snapshot could not load. Reload the page or use the NASA and INTERMAGNET links below.";
}
