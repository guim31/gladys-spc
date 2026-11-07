// -----------------------------------------------------------------------------
// The heart of the integration: reads the SPC outlooks every 15 minutes,
// evaluates them at each located house, publishes the states of the created
// devices, fires the scene triggers and keeps the connection status.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat
// every 12 hours. Everything is published again in onDeviceCreated, and on a
// reconnection. A day the SPC does not answer for publishes nothing.
//
// Triggers compare the outlooks of the same convective day, whatever its slot:
// yesterday's day 2 is today's day 1. For each house, the last category and
// tornado probability seen for each date are kept (src/store.js, so they
// survive restarts). The first cycle of a house only sets that reference.
//   - risk_reached: one event per level (1 to 5) the category crosses upwards,
//     a date seen for the first time starting from 0;
//   - risk_increased: the category of a date already seen goes up;
//   - tornado_probability_reached: one event per SPC tornado level the day 1
//     or day 2 probability crosses upwards.
//
// The refresh runs on the container's own timer: devices are published with
// should_poll: false; onPoll, if a Gladys polls anyway, reads again only when
// the last cycle is older than half a period.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { REFRESH_MINUTES } from './config.js';
import { buildDevice, deviceStates, houseIds, selectorOfExternalId } from './devices.js';
import { DAY_WORDS, LEVEL_NAMES, STATUS, summaryText } from './messages.js';
import { DAYS, evaluateDay, inCoverage } from './outlook.js';
import { Source } from './source.js';
import { formatDay } from './time.js';

const logger = createLogger({ name: 'spc-monitor' });

export const WIDGET_KEY = 'storm_outlook';
export const TRIGGERS = {
  RISK_REACHED: 'risk_reached',
  RISK_INCREASED: 'risk_increased',
  TORNADO_REACHED: 'tornado_probability_reached',
};
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);
export const LEVEL_THRESHOLDS = [1, 2, 3, 4, 5];
// The probability contours the SPC draws for tornadoes (%).
export const TORNADO_THRESHOLDS = [2, 5, 10, 15, 30, 45, 60];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const HEARTBEAT_MS = 12 * HOUR;
// requestWidgetRefresh is rate-limited to one call every 10 s by the core.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store see store.js
   * @param {Function} [options.fetch]
   * @param {boolean} [options.timers] false in tests: no interval, no delayed refresh
   * @param {Function} [options.now] clock (ms)
   */
  constructor({ gladys, store, fetch, timers = true, now }) {
    this.gladys = gladys;
    this.store = store;
    this.source = new Source(fetch ?? globalThis.fetch);
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.config = { language: 'fr' };
    this.houses = []; // located houses inside the coverage
    this.houseProblem = null; // null, 'noHouse' or 'outsideCoverage'
    this.layers = {}; // day → parsed layers of the last cycle (or null)
    this.memory = {}; // selector → { seeded, dates: { date: { level, tornado } } }
    this.lastCycleAt = null;
    this.running = null;
    this.failing = false;
    this.statusKey = undefined; // last status published
    this.cycleTimer = null;
    this.refreshTimer = null;
    this.lastWidgetRefresh = 0;
  }

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved.houses && typeof saved.houses === 'object') {
      this.memory = saved.houses;
    }
    await this.loadHouses();
    await this.publishDiscovered();
    await this.runCycle();
    if (this.timers && !this.cycleTimer) {
      this.cycleTimer = setInterval(() => this.runCycle(), REFRESH_MINUTES * MINUTE);
      this.cycleTimer.unref?.();
    }
  }

  /** Gladys restarted: read the houses again, publish the devices and every state. */
  async resync(config) {
    this.config = config;
    this.gladys.forgetPublishedStates();
    this.statusKey = undefined;
    await this.loadHouses();
    await this.publishDiscovered();
    await this.publishStates(this.created());
    await this.publishStatus();
  }

  async reconfigure(config) {
    const languageChanged = config.language !== this.config.language;
    this.config = config;
    if (languageChanged) {
      this.gladys.forgetPublishedStates();
    }
    await this.publishDiscovered();
    await this.publishStates(this.created());
    this.refreshWidget();
  }

  /** The houses of Gladys (location: true): no update event, read at start, scan and reconnection. */
  async loadHouses() {
    let houses;
    try {
      houses = await this.gladys.getHouses();
    } catch (err) {
      // Keeps the houses already known: a Gladys still booting.
      logger.warn(`Cannot read the houses of Gladys: ${err.message}`);
      return;
    }
    const located = (houses ?? []).filter(
      (house) =>
        house?.selector && Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
    );
    this.houses = located.filter(inCoverage);
    this.houseProblem =
      located.length === 0 ? 'noHouse' : this.houses.length === 0 ? 'outsideCoverage' : null;
  }

  async scan() {
    await this.loadHouses();
    await this.publishDiscovered();
    await this.runCycle();
  }

  async publishDiscovered() {
    const devices = this.houses.map((house) =>
      buildDevice(this.gladys, house, this.config.language),
    );
    await this.gladys.publishDiscoveredDevices(devices);
  }

  /** Located houses whose device the user created. */
  created() {
    const selectors = new Set(
      (this.gladys.devices ?? []).map((device) =>
        selectorOfExternalId(this.gladys, device.external_id),
      ),
    );
    return this.houses.filter((house) => selectors.has(house.selector));
  }

  /** The name the user gave the device in Gladys, else the house's. */
  deviceName(house) {
    const { device } = houseIds(this.gladys, house.selector);
    const found = (this.gladys.devices ?? []).find((d) => d.external_id === device);
    return found?.name || house.name;
  }

  /** The outlooks at a house: day → evaluateDay() result, a missing or expired day left out. */
  outlooks(house) {
    const now = this.now();
    const outlooks = {};
    for (const day of DAYS) {
      const layers = this.layers[day];
      if (layers?.cat && Number.isFinite(layers.cat.expire) && layers.cat.expire > now) {
        outlooks[day] = evaluateDay(day, layers, house);
      }
    }
    return outlooks;
  }

  /** One cycle at a time: a call during a cycle waits for it. */
  runCycle() {
    if (!this.running) {
      this.running = this.cycle()
        .catch((err) => logger.error('Refresh failed', err))
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    if (this.houses.length === 0) {
      await this.publishStatus();
      return;
    }
    const { days, failure } = await this.source.readAll();
    this.layers = days;
    this.setFailure(failure);
    const created = new Set(this.created().map((house) => house.selector));
    let changed = false;
    for (const house of this.houses) {
      changed = (await this.track(house, created.has(house.selector))) || changed;
    }
    if (changed) {
      await this.save();
    }
    await this.publishStatus();
    await this.publishStates(this.created());
    this.refreshWidget();
  }

  /** Compares the outlooks of a house with the last ones seen, fires the triggers. */
  async track(house, isCreated) {
    const outlooks = this.outlooks(house);
    if (Object.keys(outlooks).length === 0) {
      return false;
    }
    const memory = (this.memory[house.selector] ??= { seeded: false, dates: {} });
    const events = [];
    let changed = false;
    for (const day of DAYS) {
      const outlook = outlooks[day];
      if (!outlook) {
        continue;
      }
      const previous = memory.dates[outlook.date];
      const tornado = outlook.hazards.tornado?.probability ?? null;
      if (memory.seeded) {
        events.push(...this.eventsOf(house, day, outlook, previous, tornado, outlooks));
      }
      const next = { level: outlook.level, tornado: tornado ?? previous?.tornado ?? 0 };
      if (previous?.level !== next.level || previous?.tornado !== next.tornado) {
        memory.dates[outlook.date] = next;
        changed = true;
      }
    }
    // Dates more than two days old are of no use any more.
    const oldest = new Date(this.now() - 2 * DAY).toISOString().slice(0, 10);
    for (const date of Object.keys(memory.dates)) {
      if (date < oldest) {
        delete memory.dates[date];
        changed = true;
      }
    }
    if (!memory.seeded) {
      memory.seeded = true;
      changed = true;
    }
    if (isCreated) {
      await this.fire(events);
    }
    return changed;
  }

  eventsOf(house, day, outlook, previous, tornado, outlooks) {
    const language = this.config.language;
    const { device } = houseIds(this.gladys, house.selector);
    const before = previous?.level ?? 0;
    const common = {
      house: device,
      house_name: this.deviceName(house),
      day: String(day),
      day_name: DAY_WORDS[language][day],
      date: formatDay(outlook.date, language),
      level: outlook.level,
      level_name: LEVEL_NAMES[language][outlook.level],
      summary: summaryText(outlooks, language),
    };
    const events = [];
    for (const threshold of LEVEL_THRESHOLDS) {
      if (before < threshold && outlook.level >= threshold) {
        events.push([TRIGGERS.RISK_REACHED, { ...common, threshold: String(threshold) }]);
      }
    }
    if (previous && outlook.level > previous.level) {
      events.push([
        TRIGGERS.RISK_INCREASED,
        {
          ...common,
          previous_level: previous.level,
          previous_level_name: LEVEL_NAMES[language][previous.level],
        },
      ]);
    }
    if (tornado !== null && day <= 2) {
      const tornadoBefore = previous?.tornado ?? 0;
      for (const threshold of TORNADO_THRESHOLDS) {
        if (tornadoBefore < threshold && tornado >= threshold) {
          events.push([
            TRIGGERS.TORNADO_REACHED,
            {
              ...common,
              threshold: String(threshold),
              probability: tornado,
              intensity: outlook.hazards.tornado.intensity,
            },
          ]);
        }
      }
    }
    return events;
  }

  async fire(events) {
    for (const [key, raw] of events) {
      // A missing value is left out rather than sent as null.
      const data = Object.fromEntries(
        Object.entries(raw).filter(([, value]) => value !== null && value !== undefined),
      );
      logger.debug(`Trigger ${key} for ${data.house_name}, day ${data.day}`);
      try {
        await this.gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
    }
  }

  setFailure(err) {
    if (Boolean(err) !== this.failing) {
      if (err) {
        // One line at the first failure, one at the recovery.
        logger.warn(`Cannot read the SPC outlooks: ${err.message}`);
      } else {
        logger.info('The SPC outlooks are readable again');
      }
      this.failing = Boolean(err);
    } else if (err) {
      logger.debug(`Still cannot read the SPC outlooks: ${err.message}`);
    }
  }

  async publishStatus() {
    const key = this.houseProblem ?? (this.failing ? 'sourceDown' : null);
    if (key === this.statusKey) {
      return;
    }
    try {
      if (key) {
        await this.gladys.setConnectionStatus(false, STATUS[key]);
      } else {
        await this.gladys.setConnectionStatus(true);
      }
      this.statusKey = key;
    } catch (err) {
      logger.debug(`Cannot publish the connection status: ${err.message}`);
    }
  }

  async publishStates(houses, { force = false } = {}) {
    const states = houses.flatMap((house) =>
      deviceStates(this.gladys, house.selector, this.outlooks(house), this.config.language),
    );
    if (states.length === 0) {
      return;
    }
    if (force) {
      for (const house of houses) {
        this.gladys.forgetPublishedStates(houseIds(this.gladys, house.selector).device);
      }
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    } catch (err) {
      // Sent again by the next cycle: publishChangedStates only remembers accepted values.
      logger.warn(`Cannot publish the states: ${err.message}`);
    }
  }

  /** Gladys polls a device (only if it was created with a poll frequency). */
  async poll(device) {
    const selector = selectorOfExternalId(this.gladys, device?.external_id);
    const house = this.houses.find((h) => h.selector === selector);
    if (!house) {
      return;
    }
    if (
      this.lastCycleAt === null ||
      this.now() - this.lastCycleAt >= (REFRESH_MINUTES * MINUTE) / 2
    ) {
      await this.runCycle();
    } else {
      await this.publishStates([house]);
    }
  }

  async onDeviceCreated(device) {
    const selector = selectorOfExternalId(this.gladys, device?.external_id);
    const house = this.houses.find((h) => h.selector === selector);
    if (house) {
      await this.publishStates([house], { force: true });
    }
    this.refreshWidget();
  }

  /** A device renamed or deleted: the widget shows Gladys' names and devices. */
  onDeviceChanged() {
    this.refreshWidget();
  }

  refreshWidget() {
    const elapsed = this.now() - this.lastWidgetRefresh;
    if (elapsed >= WIDGET_REFRESH_GAP_MS || !this.timers) {
      this.lastWidgetRefresh = this.now();
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch((err) =>
        logger.debug(`Widget refresh refused: ${err.message}`),
      );
      return;
    }
    if (!this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.refreshWidget();
      }, WIDGET_REFRESH_GAP_MS - elapsed);
      this.refreshTimer.unref?.();
    }
  }

  save() {
    return this.store.save({ houses: this.memory });
  }

  async stop() {
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    this.refreshTimer = null;
    await this.running;
    await this.store.flush();
  }
}
