# Aurora Trace

[Open Aurora Trace](https://coolcode.ca/auroratrace/) to replay the May 2024 Gannon geomagnetic storm. The event log follows NASA’s recorded relationships between solar eruptions and one storm. The shared cursor pairs five-minute ground measurements at Victoria, British Columbia, and St. John’s, Newfoundland and Labrador, with the NOAA planetary Kp interval in effect at that time.

<!-- coolcode:guide -->
Select the first Kp 9 interval to compare both observatories from 21:00 UTC on May 10. The traces show changes in the northward field relative to each station’s median during the same pre-storm hour.
<!-- /coolcode:guide -->

## Following the storm

DONKI storm `2024-05-10T15:00:00-GST-001` links five coronal mass ejections on May 8–9 and one interplanetary shock at 16:36 UTC on May 10. The associations come from NASA's event IDs and may be revised. More than one eruption could contribute to a disturbance. The storm start denotes the beginning of a Kp reporting interval, which explains why it precedes the shock. Each event in the application links to its own DONKI record.

DONKI lists thirteen NOAA Kp values for this storm. Each observation time marks the end of a three-hour interval. For example, the value timestamped May 11 at 00:00 UTC covers May 10 from 21:00 to midnight. Kp is a unitless, global index from 0 to 9. Magnetometers measure a local magnetic field. Ground disturbances and Kp cannot confirm that anyone at the station saw an aurora.

[NASA event overview](https://ccmc.gsfc.nasa.gov/storms/may2024/) · [Storm record](https://ccmc.gsfc.nasa.gov/DONKI/view/GST/30693/-1) · [NOAA interval example](https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/30703/1)

## Ground measurements

The INTERMAGNET archive at the British Geological Survey supplies Natural Resources Canada's definitive one-minute XYZF observations. The HAPI datasets are `vic/definitive/PT1M/xyzf` and `stj/definitive/PT1M/xyzf`. X measures the northward field in nanoteslas. The refresh checks the cadence, component order, units and missing-value code in the source metadata.

The comparison begins May 10 at 12:00 UTC and ends May 12 at 06:00 UTC, exclusive. We subtract each station’s median X for 12:00–12:59 UTC May 10 from its consecutive five-minute means. The baseline is local to each station. A displayed time is the beginning of the five-minute interval. A missing minute makes its entire interval a gap, and traces break at gaps. The readout rounds to the nearest nanotesla, while the public JSON retains two decimal places. Five-minute means smooth brief excursions. At May 11 00:00 UTC the five-minute changes round to −71 nT at Victoria and 0 nT at St. John’s.

Natural Resources Canada operates and supports both observatories. INTERMAGNET promotes observatory standards and distributes the data. The derived traces are provided under the INTERMAGNET CC BY-NC 4.0 terms. The JSON snapshot links both source measurements and station metadata. Browser controls read the snapshot from this site and do not transmit selections or save them.

[INTERMAGNET archive](https://imag-data.bgs.ac.uk/GIN_V1/hapi) · [Data conditions](https://intermagnet.org/data_conditions.html) · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) · [Snapshot](https://coolcode.ca/auroratrace/data/storm.json)

## Build and refresh

The default build works offline with the checked-in edition. The monthly GitHub Actions job rechecks the historical event, calls NASA with the public demonstration key with a keyless CCMC fallback, checks the INTERMAGNET archive, and replaces the snapshot only after validating it. A failed refresh leaves the last published edition in place. The retrieved date records the source check and is independent of the May 2024 observation dates.

Run `python3 scripts/refresh.py` to refresh, `node --test tests/*.test.mjs` and `python3 -m unittest discover -s tests -v` to test, then `python3 scripts/build.py` to create the static site in `dist/`. For the browser check, install the pinned dependency in `tests/browser-requirements.txt`, install Chromium with Playwright, and run `python3 tests/browser_smoke.py`.
