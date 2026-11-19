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

export function timeText(value) {
  const stamp = new Date(value).toISOString();
  return stamp.slice(8, 10) + " May " + stamp.slice(11, 16);
}

export function fieldText(value) {
  if (value === null) return "Gap";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return sign + Math.abs(rounded) + " nT";
}
