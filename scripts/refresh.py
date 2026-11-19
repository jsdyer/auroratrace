"""Rebuild the May 2024 storm edition from DONKI and INTERMAGNET."""
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
STORM_ID = '2024-05-10T15:00:00-GST-001'
START = datetime(2024, 5, 10, 12, tzinfo=timezone.utc)
STOP = datetime(2024, 5, 12, 6, tzinfo=timezone.utc)
MINUTES = int((STOP - START).total_seconds() / 60)
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
        return get(f'https://api.nasa.gov/DONKI/{kind}?{query}&api_key=DEMO_KEY')
    except (URLError, TimeoutError):
        return get(f'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/{kind}?{query}')


def record_link(record):
    link = record['link']
    parsed = urlsplit(link)
    if parsed.scheme != 'https' or parsed.hostname not in {'ccmc.gsfc.nasa.gov', 'kauai.ccmc.gsfc.nasa.gov'}:
        raise ValueError('Unexpected DONKI record link')
    return link


def events():
    storm = next(row for row in donki('GST', '2024-05-10', '2024-05-13') if row['gstID'] == STORM_ID)
    linked = {entry['activityID'] for entry in storm['linkedEvents']}
    result = {}
    for kind, first, last in [('CME', '2024-05-06', '2024-05-10'), ('IPS', '2024-05-10', '2024-05-12')]:
        rows = []
        for entry in donki(kind, first, last):
            if entry['activityID'] in linked:
                rows.append({'id': entry['activityID'], 'time': entry['startTime' if kind == 'CME' else 'eventTime'],
                             'region': entry.get('activeRegionNum'), 'link': record_link(entry)})
        if not rows or {row['id'] for row in rows} != {i for i in linked if f'-{kind}-' in i}:
            raise ValueError(f'Incomplete {kind} records for {STORM_ID}')
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
    return dict(result, id=STORM_ID, time=storm['startTime'], link=record_link(storm), kp=intervals)


def trace(rows, fill):
    minutes = [None] * MINUTES
    seen = set()
    for stamp, vector, _ in rows:
        instant = datetime.fromisoformat(stamp)
        offset = (instant - START).total_seconds() / 60
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
    baseline = median(reference)
    values = []
    for i in range(0, MINUTES, STEP):
        group = minutes[i:i + STEP]
        values.append(None if None in group else round(mean(group) - baseline, 2))
    valid = len(values) - values.count(None)
    if valid < 0.9 * len(values):
        raise ValueError('Station coverage fell below 90%')
    return baseline, values, valid


def station(code, name, province):
    dataset = code.lower() + '/definitive/PT1M/xyzf'
    info_url = HAPI + 'info?' + urlencode({'id': dataset})
    data_url = HAPI + 'data?' + urlencode({'id': dataset, 'time.min': utc(START), 'time.max': utc(STOP), 'format': 'json'})
    info = get(info_url)
    vector = next(p for p in info['parameters'] if p['name'] == 'Field_Vector')
    if (info['cadence'], info['timeStampLocation'], vector['vectorComponents'][0], vector['units'][0]) != ('PT1M', 'begin', 'x', 'nT'):
        raise ValueError('Station cadence, component or units changed')
    baseline, values, valid = trace(get(data_url)['data'], float(vector['fill']))
    return {'code': code, 'name': name, 'province': province, 'baseline_nT': baseline, 'delta_nT': values,
            'valid_bins': valid, 'data_url': data_url, 'info_url': info_url}


def main():
    storm = events()
    stations = [station(*source) for source in STATIONS]
    edition = {'retrieved': datetime.now(timezone.utc).date().isoformat(), 'start': utc(START), 'end': utc(STOP),
               'step_minutes': STEP, 'bin_count': MINUTES // STEP, 'count': sum(s['valid_bins'] for s in stations),
               'baseline_end': utc(START + timedelta(hours=1)), 'stations': stations, 'storm': storm}
    path = ROOT / 'web/data/storm.json'
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(edition, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    tmp.replace(path)
    print(f"Retrieved {len(storm['cme'])} linked CMEs, {len(storm['kp'])} Kp bins and {edition['count']} station means")


if __name__ == '__main__':
    main()
