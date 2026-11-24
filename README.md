# Aurora Trace

[Open Aurora Trace](https://coolcode.ca/auroratrace/) to choose between two Canadian storm nights. The shared cursor compares five-minute ground measurements in Victoria, British Columbia, and St. John’s, Newfoundland and Labrador, with the NOAA planetary Kp interval covering the same time. The event log follows NASA’s recorded relationships from the solar eruptions to Earth.

<!-- coolcode:guide -->
Jump to the largest coast-to-coast difference. On October 10 at 23:25 UTC, Victoria was 552 nT above its reference and St. John’s was 622 nT below. Each Kp value covers three hours, while the station readings cover five minutes.
<!-- /coolcode:guide -->

## Pick a night

| Night | Eruptions linked by NASA | Interplanetary shock near Earth | Peak Kp in DONKI |
| --- | --- | --- | --- |
| [May 10, 2024](https://coolcode.ca/auroratrace/?night=2024-05-10) | Five CMEs from May 8–9 | May 10 at 16:36 UTC | 9 |
| [October 10, 2024](https://coolcode.ca/auroratrace/?night=2024-10-10) | One CME on October 9 at 02:12 UTC | October 10 at 14:46 UTC | 8.67 |

The May edition opens by default. The selector changes the chart, measurements, reference fields, Kp intervals, event log and source links together. Sharing the address opens the selected night. The evening menu jumps to 9 p.m. at either observatory on either local date. Both station readouts always use the same UTC instant.

NASA supplies the event associations, which may be revised. Several eruptions can contribute to a storm. The May Gannon storm has thirteen NOAA Kp intervals. The October storm has eight and includes a modelled magnetopause crossing at 17:13 UTC on October 10. Each event links to its DONKI record.

Kp is a unitless planetary index from 0 to 9. DONKI dates each three-hour interval by its end. For example, the Kp 9 value timestamped May 11 at 00:00 UTC covers May 10 from 21:00 to midnight. Both storms’ catalogue start times mark the beginning of a Kp interval. Ground measurements or Kp alone cannot establish whether someone saw an aurora.

[May event overview](https://ccmc.gsfc.nasa.gov/storms/may2024/) · [May storm record](https://ccmc.gsfc.nasa.gov/DONKI/view/GST/30693/-1) · [October event overview](https://ccmc.gsfc.nasa.gov/CMR/TimeInterval/viewTI?id=2024-10-TP-01) · [October storm record](https://ccmc.gsfc.nasa.gov/DONKI/view/GST/33913/-1) · [NOAA interval example](https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/30703/1)

## Ground measurements

The INTERMAGNET archive at the British Geological Survey supplies Natural Resources Canada’s definitive one-minute XYZF observations. The HAPI datasets are `vic/definitive/PT1M/xyzf` and `stj/definitive/PT1M/xyzf`. X measures the northward field in nanoteslas. The refresh checks the cadence, component order, units and missing-value code in the source metadata.

Each record spans 42 hours, beginning on the 10th at 12:00 UTC and ending on the 12th at 06:00 UTC, exclusive. Each station’s reference is its median X from 12:00 to 12:59 UTC on the first day of that record. Subtracting the reference from each subsequent five-minute mean puts the changes on a shared scale. A displayed time marks the beginning of its five-minute interval. If any constituent minute is missing, the station’s line breaks at that interval. The readout rounds to the nearest nanotesla, while the JSON retains two decimal places. Averaging smooths brief excursions.

Natural Resources Canada operates and supports both observatories. INTERMAGNET promotes observatory standards and distributes the data. The derived traces are provided under INTERMAGNET’s CC BY-NC 4.0 terms. Each public snapshot links the source observations and station metadata. The browser reads the archive from this site. It stores no measurements or selections on the device.

[INTERMAGNET archive](https://imag-data.bgs.ac.uk/GIN_V1/hapi) · [Data conditions](https://intermagnet.org/data_conditions.html) · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) · [May snapshot](https://coolcode.ca/auroratrace/data/storm.json) · [October snapshot](https://coolcode.ca/auroratrace/data/october.json)

## Build and refresh

The default build works offline with the checked-in editions. A monthly GitHub Actions job rechecks the historical events using NASA CCMC’s keyless service, with the NASA gateway’s public demonstration key as a fallback. It checks both INTERMAGNET records and publishes only after both editions validate. A failed refresh leaves the last published site in place. The retrieved date records the source check, separate from the 2024 observation dates. The [archive manifest](https://coolcode.ca/auroratrace/data/archive.json) reports the retrieval date, per-night counts and total.

Run `python3 scripts/refresh.py` to refresh, `node --test tests/*.test.mjs` and `python3 -m unittest discover -s tests -v` to test, then `python3 scripts/build.py` to build the static site in `dist/`. For browser tests, install the pinned dependency in `tests/browser-requirements.txt`, install Chromium with Playwright and run `python3 tests/browser_smoke.py`.

<!-- schedule-reliability -->
## Schedule reliability

Public GitHub repositories can have scheduled workflows disabled after 60 days of inactivity. A separate weekly [schedule guard](.github/workflows/schedule-guard.yml) calls GitHub's enable-workflow API for an explicit list of refresh workflows and itself. It can restore workflows disabled for inactivity, preserves manually disabled workflows, and runs independently of collection failures.

This is an interim mitigation, not a scheduling guarantee: GitHub does not document active-workflow renewal as a permanent exemption, and scheduled runs can be delayed or dropped. A scheduler on our own Linux server is the planned independent trigger. The guard does not collect data, create dummy commits, or change source/check timestamps; successful collection and published data freshness still need monitoring.
<!-- /schedule-reliability -->
