"""Rebuild the curated Canadian storm editions from DONKI and INTERMAGNET."""
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
from statistics import mean, median
from time import sleep
from urllib.error import URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ('2024-05-10T15:00:00-GST-001', 'May 2024 Gannon storm', 'storm.json',
     'https://ccmc.gsfc.nasa.gov/storms/may2024/'),
    ('2024-10-10T15:00:00-GST-001', 'October 2024 geomagnetic storm', 'october.json',
     'https://ccmc.gsfc.nasa.gov/CMR/TimeInterval/viewTI?id=2024-10-TP-01'),
]
MINUTES = 42 * 60
STEP = 5
HAPI = 'https://imag-data.bgs.ac.uk/GIN_V1/hapi/'
STATIONS = [('VIC', 'Victoria', 'British Columbia'), ('STJ', 'St. John’s', 'Newfoundland and Labrador')]


def utc(value):
    return value.isoformat(timespec='minutes').replace('+00:00', 'Z')


def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'AuroraTrace/1.0 (https://coolcode.ca/auroratrace/)'}),
                         timeout=45) as response:
                return json.load(response)
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
            sleep(2 ** attempt)


def donki(kind, start, end):
    query = urlencode({'startDate': start, 'endDate': end})
    try:
        return get(f'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{kind}?{query}')
    except (URLError, TimeoutError):
        return get(f'https://api.nasa.gov/DONKI/{kind}?{query}&api_key=DEMO_KEY')


def record_link(record):
    link = record['link']
    parsed = urlsplit(link)
    if parsed.scheme != 'https' or parsed.hostname not in {'ccmc.gsfc.nasa.gov', 'kauai.ccmc.gsfc.nasa.gov'}:
        raise ValueError('Unexpected DONKI record link')
    return link


def events(storm_id):
    day = storm_id[:10]
    storm = next(row for row in donki('GST', day, day) if row['gstID'] == storm_id)
    linked = {entry['activityID'] for entry in storm['linkedEvents']}
    result = {}
    for kind, id_key, time_key in [('CME', 'activityID', 'startTime'),
                                    ('IPS', 'activityID', 'eventTime'),
                                    ('MPC', 'mpcID', 'eventTime')]:
        ids = sorted(i for i in linked if f'-{kind}-' in i)
        rows = []
        if ids:
            # The storm supplies the event IDs. Query their dates, then join by the full ID.
            for entry in donki(kind, ids[0][:10], ids[-1][:10]):
                if entry[id_key] in ids:
                    rows.append({'id': entry[id_key], 'time': entry[time_key],
                                 'region': entry.get('activeRegionNum'), 'link': record_link(entry)})
        if sorted(row['id'] for row in rows) != ids or (not rows and kind in {'CME', 'IPS'}):
            raise ValueError(f'Incomplete {kind} records for {storm_id}')
        result[kind.lower()] = sorted(rows, key=lambda row: row['time'])
    intervals = []
    for row in sorted(storm['allKpIndex'], key=lambda row: row['observedTime']):
        if row['source'] != 'NOAA' or not 0 <= row['kpIndex'] <= 9:
            raise ValueError('Unexpected Kp source or index')
        end = datetime.fromisoformat(row['observedTime'])
        start = end - timedelta(hours=3)
        if intervals and utc(start) < intervals[-1]['end']:
            raise ValueError('Overlapping Kp bins')
        intervals.append({'start': utc(start), 'end': utc(end), 'value': row['kpIndex']})
    if not intervals:
        raise ValueError('Missing Kp')
    return dict(result, id=storm_id, time=storm['startTime'], link=record_link(storm), kp=intervals)


def trace(rows, fill, start):
    minutes = [None] * MINUTES
    seen = set()
    for stamp, vector, _ in rows:
        instant = datetime.fromisoformat(stamp)
        offset = (instant - start).total_seconds() / 60
        if not offset.is_integer() or not 0 <= offset < MINUTES or offset in seen:
            raise ValueError('Unexpected or duplicate minute')
        seen.add(offset)
        x = vector[0]
        if x is not None and x != fill:
            if not math.isfinite(x):
                raise ValueError('Invalid magnetic component')
            minutes[int(offset)] = x
    reference = [value for value in minutes[:60] if value is not None]
    if len(reference) != 60:
        raise ValueError('Incomplete baseline hour')
    baseline = round(median(reference), 2)
    values = []
    for i in range(0, MINUTES, STEP):
        group = minutes[i:i + STEP]
        values.append(None if None in group else round(mean(group) - baseline, 2))
    valid = len(values) - values.count(None)
    if valid < 0.9 * len(values):
        raise ValueError('Station coverage fell below 90%')
    return baseline, values, valid


def station(code, name, province, start, stop):
    dataset = code.lower() + '/definitive/PT1M/xyzf'
    info_url = HAPI + 'info?' + urlencode({'id': dataset})
    data_url = HAPI + 'data?' + urlencode({'id': dataset, 'time.min': utc(start), 'time.max': utc(stop), 'format': 'json'})
    info = get(info_url)
    vector = next(p for p in info['parameters'] if p['name'] == 'Field_Vector')
    if (info['cadence'], info['timeStampLocation'], vector['vectorComponents'][0], vector['units'][0]) != ('PT1M', 'begin', 'x', 'nT'):
        raise ValueError('Station cadence, component or units changed')
    baseline, values, valid = trace(get(data_url)['data'], float(vector['fill']), start)
    return {'code': code, 'name': name, 'province': province, 'baseline_nT': baseline, 'delta_nT': values,
            'valid_bins': valid, 'data_url': data_url, 'info_url': info_url}


def build_edition(storm_id, title, guide, retrieved):
    day = storm_id[:10]
    start = datetime.fromisoformat(day).replace(hour=12, tzinfo=timezone.utc)
    stop = start + timedelta(minutes=MINUTES)
    storm = events(storm_id)
    stations = [station(*source, start, stop) for source in STATIONS]
    return {'title': title, 'date': day, 'source_guide': guide, 'retrieved': retrieved,
            'start': utc(start), 'end': utc(stop), 'step_minutes': STEP, 'bin_count': MINUTES // STEP,
            'count': sum(s['valid_bins'] for s in stations), 'baseline_end': utc(start + timedelta(hours=1)),
            'stations': stations, 'storm': storm}


def main():
    retrieved = datetime.now(timezone.utc).date().isoformat()
    snapshots = {}
    for storm_id, title, filename, guide in CASES:
        edition = build_edition(storm_id, title, guide, retrieved)
        snapshots[filename] = edition
        print(f"{title}: {len(edition['storm']['cme'])} CMEs, {len(edition['storm']['kp'])} Kp intervals, "
              f"{edition['count']} station averages")
    summary = [{'date': edition['date'], 'file': filename, 'count': edition['count']}
               for filename, edition in snapshots.items()]
    snapshots['archive.json'] = {'retrieved': retrieved, 'count': sum(item['count'] for item in summary),
                                 'nights': summary}
    # Finish retrieving and validating both nights before replacing any local file.
    for filename, snapshot in snapshots.items():
        path = ROOT / 'web/data' / filename
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
        tmp.replace(path)


if __name__ == '__main__':
    main()
