# Severe storm outlook (SPC)

The convective outlooks of the NOAA **Storm Prediction Center** (SPC) at your house, in Gladys: the severe
thunderstorm risk category for today, tomorrow and the day after, and the tornado, hail and damaging wind
probabilities of today and tomorrow. Scene triggers and a dashboard widget come with it.

> **Not an official warning service.** The outlooks are forecasts of the days ahead. For watches and warnings in
> force, follow the National Weather Service (the
> [National Weather Service](https://github.com/William-De71/gladys-national-weather-service) integration brings
> them into Gladys), a NOAA Weather Radio and your local authorities.

Not affiliated with NOAA or the National Weather Service.

## What you get

- **One device per house** of Gladys located in the contiguous United States.
- The **SPC category** of today, tomorrow and the day after: 0 (no severe risk, or general thunderstorms only),
  1 Marginal, 2 Slight, 3 Enhanced, 4 Moderate, 5 High.
- The **probability** (%) of a tornado, of large hail (1 inch or more) and of damaging wind (58 mph or more) within
  25 miles of the house, today and tomorrow; for the day after, the probability of any severe weather.
- The **conditional intensity group** (0 to 3) of each hazard: the higher it is, the more intense the storms could
  be (strong tornadoes, giant hail, destructive gusts). It replaced the hatched "significant" areas in 2026.
- A **summary** sentence, e.g. "Slight risk of severe storms today (tornado 5%, hail 15%, wind 15%); tomorrow:
  3 · Enhanced".
- Three **scene triggers** and a **dashboard widget**.

## Requirements

- Gladys Assistant 5.3.0 or later.
- The **location of your house** set in Gladys (Settings → Houses), in the contiguous United States. Alaska,
  Hawaii, Puerto Rico and the other countries are not covered by the SPC.
- Internet access from Gladys. No account and no key.

## Configuration

### Settings

| Setting                       | Default | What it does                                                                   |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| Language of the feature names | French  | Names of the features of new devices, language of the summary and of variables |

The integration asks for the **location of your houses** at installation: it reads their coordinates from Gladys
and checks the SPC areas **inside the container**. Your location is never sent to anyone. Then open the
**Discover** tab of the integration and create the device of your house. A house added or moved later shows up
after a new scan in the Discover tab.

## Devices

| Feature                                 | Type   | Value                                             |
| --------------------------------------- | ------ | ------------------------------------------------- |
| Storm risk today / tomorrow / in 2 days | number | SPC category, 0 to 5                              |
| Tornado / Hail / Wind probability       | %      | Today and tomorrow, within 25 miles               |
| Severe storm probability in 2 days      | %      | Any severe weather, the day after tomorrow        |
| … intensity group                       | number | Conditional intensity group of the hazard, 0 to 3 |
| Severe storm outlook                    | text   | Summary sentence, in the language of the settings |

The categories are numbers (not the Gladys "risk" badge, which only knows four levels), so a scene condition such
as "risk today ≥ 2" works. "Today" is the SPC convective day, from 12 UTC to 12 UTC the next morning. When the SPC
does not answer, nothing is published: the last values simply age.

## Dashboard widget

**Severe storm outlook**: for the house you choose (the first one otherwise), one line per day with its category,
coloured after the SPC scale as far as the Gladys palette goes (green Marginal, yellow Slight and Enhanced, red
Moderate and High, blue for general thunderstorms), a heading from Slight upwards, the tornado / hail / wind
probabilities of today and tomorrow (with the highest intensity group, "CIG2"), the time of issue and a button to
the SPC outlooks. The probabilities and the button each have a setting to hide them.

## Scene triggers

- **Severe storm risk reaches a category**: a new outlook raises the category of a day to the chosen level (1 to 5)
  or above, once, when the level is crossed upwards. Filters: house, day (today, tomorrow, in 2 days).
- **Severe storm risk upgraded**: a new outlook raises the category of a day already forecast, whatever the level.
- **Tornado probability reaches a level**: the tornado probability of today or tomorrow reaches the chosen level
  (2 to 60%).

The same calendar day is followed from one outlook to the next: when the day 3 already said Enhanced, the day 2
that confirms it fires nothing. Variables: house, day, date, category and its name, summary; the previous category
for an upgrade; the probability and the intensity group for a tornado. The very first outlooks read after the
installation only set the reference: they fire nothing.

## Scene examples

- When the risk of tomorrow reaches Slight, send "{{level_name}} risk of severe storms tomorrow" to the family.
- When the tornado probability of today reaches 10%, turn the hallway light orange and send a message.
- Every morning at 7, if the risk today is 3 or more, read the summary out loud.

## Data sources, licence and quotas

- [SPC convective outlooks](https://www.spc.noaa.gov/products/outlook/), NOAA / National Weather Service, public
  domain (a work of the US government). Read every 15 minutes: eleven small GeoJSON files, with conditional
  requests, so a file unchanged since the last cycle costs a 304 answer with no content. The SPC issues the day 1
  outlook five times a day, day 2 twice and day 3 once or twice.

## Troubleshooting

- **"No house of Gladys has a location"**: set the location of your house in Settings → Houses, then rescan in the
  Discover tab.
- **"No house is in the contiguous United States"**: the SPC only covers the lower 48 states.
- The connection status says the outlooks cannot be read: the SPC site is unreachable. Nothing is published until
  it answers again, every 15 minutes.

## Limits

- A forecast of the days ahead, not a warning: storms can form outside the areas drawn by the SPC.
- Developed without a severe weather day in progress: the tests use the real outlooks of 27 April 2026 (Moderate
  risk) and 7 November 2026. Feedback welcome.
- The probability of a hazard is given for 25 miles around the house, as the SPC defines it, not for the house
  itself.
