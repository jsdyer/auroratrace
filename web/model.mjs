export function timeAt(data, index) {
  return Date.parse(data.start) + index * data.step_minutes * 60000;
}

export function indexAt(data, stamp) {
  const elapsed = Date.parse(stamp) - Date.parse(data.start);
  return Math.max(
    0,
    Math.min(
      data.bin_count - 1,
      Math.floor(elapsed / (data.step_minutes * 60000)),
    ),
  );
}

export function kpAt(intervals, time) {
  return intervals.find(
    (bin) => Date.parse(bin.start) <= time && time < Date.parse(bin.end),
  );
}

export function linePath(values, x, y) {
  let connected = false;
  const parts = [];
  values.forEach((value, index) => {
    if (value === null) {
      connected = false;
      return;
    }
    parts.push(
      (connected ? "L" : "M") + x(index).toFixed(2) + "," + y(value).toFixed(2),
    );
    connected = true;
  });
  return parts.join(" ");
}

const monthName = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "short",
});
export function timeText(value) {
  const instant = new Date(value);
  const stamp = instant.toISOString();
  return (
    stamp.slice(8, 10) +
    " " +
    monthName.format(instant) +
    " " +
    stamp.slice(11, 16)
  );
}

const locations = [
  ["Victoria", "America/Vancouver"],
  ["St. John’s", "America/St_Johns"],
].map(([name, timeZone]) => ({
  name,
  clock: new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }),
  date: new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }),
}));

export function stationClocks(instant) {
  return locations.map(({ name, clock, date }) => ({
    name,
    clock: clock.format(instant),
    date: date.format(instant),
  }));
}

export function eveningStops(edition) {
  const stops = [];
  for (let index = 0; index < edition.bin_count; index += 1) {
    for (const station of stationClocks(timeAt(edition, index))) {
      if (station.clock === "21:00") stops.push({ index, ...station });
    }
  }
  return stops;
}

export function fieldText(value) {
  if (value === null) return "Gap";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return sign + Math.abs(rounded) + " nT";
}
