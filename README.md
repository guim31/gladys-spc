# Severe storm outlook (SPC) for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the **convective
outlooks of the NOAA Storm Prediction Center** (SPC) to your house: the severe thunderstorm risk category for
today, tomorrow and the day after, and the tornado, hail and wind probabilities. Public domain data, no account,
no key.

> **Not an official warning service.** These are forecasts of the days ahead; for watches and warnings in force,
> follow the National Weather Service. Not affiliated with NOAA or the National Weather Service.

## What it does

- One device per house of Gladys located in the contiguous United States, with the SPC category (0 to 5) of
  today, tomorrow and the day after, the tornado / hail / wind probabilities of today and tomorrow, the any-severe
  probability of the day after, the conditional intensity group of each hazard (0 to 3), and a summary sentence.
- Scene triggers: **Severe storm risk reaches a category**, **Severe storm risk upgraded** and **Tornado
  probability reaches a level**. The same calendar day is followed from the day 3 outlook to the day 1.
- A dashboard widget: the three days coloured after the SPC scale, the probabilities, a link to the SPC.
- The location of the house never leaves Gladys: the SPC areas are downloaded and checked inside the container.
- It complements the [National Weather Service](https://github.com/William-De71/gladys-national-weather-service)
  integration, which publishes the watches and warnings in force.

Full user documentation: [English](docs/en.md), [français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md).

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- The location of your house set in Gladys (Settings → Houses), in the contiguous United States.

## Installation

In Gladys: **Integrations → Install from GitHub**, address of this repository:
`https://github.com/guim31/gladys-spc`. Accept the access to the location of your houses, then create the device
of your house in the **Discover** tab.

## How it works

Every 15 minutes the integration downloads the GeoJSON layers of the SPC outlooks
(`https://www.spc.noaa.gov/products/outlook/`: `day1otlk_cat`, `_torn`, `_hail`, `_wind`, the same for day 2, and
`day3otlk_cat`, `_prob`, `_cigprob`) with conditional requests, then finds the highest zone that contains each
house (point in polygon, holes included). The probability layers also carry the conditional intensity groups
(`CIG1` to `CIG3`) that replaced the hatched areas in March 2026; the old `_sig*` layers are still served but
frozen, so any layer from another issue than the categorical one is ignored.

## Limits

- **Developed without a severe weather day in progress**: tested on the real outlooks of 27 April 2026 (Moderate
  risk, 15% tornado odds, intensity group 2) and of 7 November 2026. Feedback welcome.
- Contiguous United States only, as the SPC.
- A forecast, not a warning.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
```

The tests run against the fake Gladys of the SDK and real SPC layers recorded under `test/fixtures/<date>/`; they
never touch the network.

## Credits

- Outlooks: [NOAA / NWS Storm Prediction Center](https://www.spc.noaa.gov), public domain (works of the US
  government). Some of them are recorded in `test/fixtures/` as test data.
- Cover: the NOAA emblem, from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:NOAA_logo.svg) (public domain), used to identify the
  data source only.
- Built on the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js).

Not affiliated with, nor endorsed by, NOAA, the National Weather Service or the Storm Prediction Center.

## License

[Apache-2.0](LICENSE)
