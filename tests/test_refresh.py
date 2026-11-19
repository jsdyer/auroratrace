from pathlib import Path
import json
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from refresh import ROOT, START, timedelta, trace, utc

class SourceTests(unittest.TestCase):
    def test_snapshot_keys_and_associations(self):
        data = json.loads((ROOT / 'web/data/storm.json').read_text())
        self.assertEqual({s['code'] for s in data['stations']}, {'VIC', 'STJ'})
        self.assertEqual(len({e['id'] for e in data['storm']['cme']}), len(data['storm']['cme']))
        self.assertEqual(data['count'], sum(sum(v is not None for v in s['delta_nT']) for s in data['stations']))
        self.assertTrue(all(len(s['delta_nT']) == data['bin_count'] for s in data['stations']))

    def test_single_fill_breaks_only_its_bin(self):
        rows = [[utc(START + timedelta(minutes=i)), [100 if i!=87 else 99999,0,0],0] for i in range(2520)]
        baseline, values, valid = trace(rows, 99999)
        self.assertEqual(baseline, 100)
        self.assertEqual(valid, 503)
        self.assertEqual(values[16:19], [0,None,0])
        with self.assertRaisesRegex(ValueError,'baseline'):
            trace(rows[1:],99999)
