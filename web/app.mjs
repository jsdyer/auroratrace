import {
  widestDifference,
  eveningStops,
  fieldText,
  stationClocks,
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
const cases = new Map([
  ["2024-05-10", "./data/storm.json"],
  ["2024-10-10", "./data/october.json"],
]);
const currentUrl = new URL(location.href);
const requested = currentUrl.searchParams.get("night");
const night = cases.has(requested) ? requested : "2024-05-10";
const dataPath = cases.get(night);
function caseUrl(value) {
  const url = new URL(location.href);
  url.searchParams.set("night", value);
  return url.href;
}
byId("night").value = night;
byId("case-link").href = caseUrl(night);
byId("data-download").href = dataPath;
byId("night").onchange = () => location.assign(caseUrl(byId("night").value));
window.addEventListener("pageshow", () => {
  byId("night").value = night;
});
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
  const tickSpacing = Math.max(
    1,
    Math.round((width < 550 ? 720 : 360) / edition.step_minutes),
  );
  const ticks = Array.from(
    { length: Math.ceil(edition.bin_count / tickSpacing) },
    (_, n) => n * tickSpacing,
  );
  if (width >= 550 && ticks.at(-1) < edition.bin_count - 1)
    ticks.push(edition.bin_count - 1);
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
  const evening = byId("evening");
  evening.value = [...evening.options].some(
    (option) => option.value === String(selected),
  )
    ? String(selected)
    : "";
  byId("local-times").textContent =
    stationClocks(time)
      .map((station) => station.name + " " + station.date + " " + station.clock)
      .join(" · ") + " local time.";
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
  const values = edition.stations.map(station => station.delta_nT[selected]);
  if (values.every(Number.isFinite)) {
    const relation = values.every(value => value > 0) ? "Both fields rose above their own references."
      : values.every(value => value < 0) ? "Both fields fell below their own references."
      : values[0] * values[1] < 0 ? "One field rose while the other fell relative to its reference."
      : "At least one field was at its reference level.";
    byId("selection-note").textContent += " " + relation;
  }
  for (const button of byId("bars").children)
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.start === bin?.start),
    );
}

function populate() {
  const { storm } = edition;
  const [west, east] = edition.stations;
  const widest = widestDifference(west.delta_nT, east.delta_nT);
  byId("contrast").disabled = !widest;
  if (widest) {
    const {index, difference} = widest;
    byId("contrast-summary").textContent =
      "The largest difference between the stations’ changes was " +
      Math.round(difference).toLocaleString("en-CA") + " nT at " +
      timeText(timeAt(edition, index)) + " UTC. " + west.name + " read " +
      fieldText(west.delta_nT[index]) + " and " + east.name + " read " +
      fieldText(east.delta_nT[index]) + " relative to their own reference hours.";
    byId("contrast").onclick = () => read(index);
  }
  const civilDay = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const startDate = new Date(edition.start);
  byId("plot-period").textContent = civilDay.formatRange(
    startDate,
    new Date(Date.parse(edition.end) - 1),
  );
  byId("event-intro").textContent =
    `NASA’s DONKI catalogue associates ${storm.cme.length === 1 ? "one coronal mass ejection" : storm.cme.length + " coronal mass ejections"} with the ${civilDay.format(startDate)} storm. The log follows the linked events in UTC.`;
  const guide = byId("storm-guide");
  guide.href = edition.source_guide || storm.link;
  guide.textContent =
    "NASA record · " + (edition.title || civilDay.format(startDate));
  byId("baseline-method").textContent =
    "Each point is a five-minute average of definitive one-minute X measurements. Each station’s reference is the median X over the hour beginning " +
    timeText(edition.start) +
    " UTC and ending just before " +
    timeText(edition.baseline_end) +
    " UTC. Negative values indicate a decrease from that local reference. A missing minute leaves a gap for that station.";
  for (const stop of eveningStops(edition)) {
    byId("evening").add(
      new Option(stop.name + " · " + stop.date + " at 21:00", stop.index),
    );
  }
  byId("evening").onchange = () => {
    if (byId("evening").value !== "") read(Number(byId("evening").value));
  };
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
    ...(storm.mpc || []).map((row) => ({
      ...row,
      name: "Modelled magnetopause crossing (NASA SWMF)",
    })),
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
  const response = await fetch(dataPath);
  if (!response.ok) throw Error("Snapshot unavailable");
  edition = await response.json();
  populate();
} catch {
  byId("selected").textContent = "Data unavailable";
  byId("selection-note").textContent =
    "The storm snapshot could not load. Reload the page or use the NASA and INTERMAGNET links below.";
}
