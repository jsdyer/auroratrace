from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from refresh import CASES, MINUTES, ROOT, trace, utc


class SourceTests(unittest.TestCase):
    def test_each_night_matches_its_source_and_the_archive_total(self):
        directory = ROOT / 'web/data'
        archive = json.loads((directory / 'archive.json').read_text())
        self.assertEqual([row['file'] for row in archive['nights']], [case[2] for case in CASES])
        self.assertEqual(archive['count'], sum(row['count'] for row in archive['nights']))
        for (storm_id, title, filename, guide), entry in zip(CASES, archive['nights']):
            with self.subTest(storm_id=storm_id):
                data = json.loads((directory / filename).read_text())
                self.assertEqual(data['storm']['id'], storm_id)
                self.assertEqual(data['title'], title)
                self.assertEqual(data['source_guide'], guide)
                self.assertEqual(data['date'], entry['date'])
                self.assertEqual(data['retrieved'], archive['retrieved'])
                self.assertEqual(data['count'], entry['count'])
                self.assertEqual({s['code'] for s in data['stations']}, {'VIC', 'STJ'})
                self.assertEqual(data['count'], sum(sum(v is not None for v in s['delta_nT']) for s in data['stations']))
                self.assertTrue(all(len(s['delta_nT']) == data['bin_count'] for s in data['stations']))
                for key in ('cme', 'ips', 'mpc'):
                    ids = [record['id'] for record in data['storm'][key]]
                    self.assertEqual(len(ids), len(set(ids)))

    def test_single_fill_breaks_only_its_bin_for_either_date(self):
        for stamp in ('2024-05-10', '2024-10-10'):
            with self.subTest(stamp=stamp):
                start = datetime.fromisoformat(stamp).replace(hour=12, tzinfo=timezone.utc)
                rows = [[utc(start + timedelta(minutes=i)), [100 if i != 87 else 99999, 0, 0], 0]
                        for i in range(MINUTES)]
                baseline, values, valid = trace(rows, 99999, start)
                self.assertEqual(baseline, 100)
                self.assertEqual(valid, 503)
                self.assertEqual(values[16:19], [0, None, 0])
                with self.assertRaisesRegex(ValueError, 'baseline'):
                    trace(rows[1:], 99999, start)
