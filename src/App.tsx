import {
  CalendarClock,
  Gauge,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BODY_DEFINITIONS,
  calculateBodyStates,
  type BodyId,
} from "./astronomy";
import { SolarSystem, type BodyIndicator } from "./SolarSystem";

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;
const MIN_SCRUB_DAYS = -73_048;
const MAX_SCRUB_DAYS = 73_049;

const PLAYBACK_RATES = [
  { value: 1, label: "1 second / second" },
  { value: 60, label: "1 minute / second" },
  { value: 3_600, label: "1 hour / second" },
  { value: 86_400, label: "1 day / second" },
  { value: 2_592_000, label: "30 days / second" },
  { value: 31_557_600, label: "1 year / second" },
];

function toDateInputValue(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 16);
}

function formatUtc(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function App() {
  const [timeMs, setTimeMs] = useState(() => Date.now());
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(86_400);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [focusedId, setFocusedId] = useState<BodyId>("sun");
  const [selectedIds, setSelectedIds] = useState<Set<BodyId>>(
    () => new Set(["sun"]),
  );
  const [focusSequence, setFocusSequence] = useState(0);
  const [overviewSequence, setOverviewSequence] = useState(0);
  const [indicators, setIndicators] = useState<BodyIndicator[]>([]);
  const lastTick = useRef(0);

  const bodies = useMemo(
    () => calculateBodyStates(new Date(timeMs)),
    [timeMs],
  );
  const scrubDays = (timeMs - J2000_MS) / DAY_MS;

  useEffect(() => {
    if (!playing) {
      lastTick.current = performance.now();
      return;
    }

    let frame = 0;
    let lastRendered = 0;
    const tick = (now: number) => {
      const elapsedSeconds = Math.min((now - lastTick.current) / 1_000, 0.25);
      lastTick.current = now;
      if (now - lastRendered > 50) {
        setTimeMs((current) =>
          current + elapsedSeconds * playbackRate * direction * 1_000,
        );
        lastRendered = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [direction, playbackRate, playing]);

  const selectBody = useCallback((id: BodyId, additive = false) => {
    if (additive) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id) && next.size > 1) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      return;
    }

    setSelectedIds(new Set([id]));
    setFocusedId(id);
    setFocusSequence((sequence) => sequence + 1);
  }, []);

  const showOverview = useCallback(() => {
    setSelectedIds(new Set(["sun"]));
    setFocusedId("sun");
    setOverviewSequence((sequence) => sequence + 1);
  }, []);

  const updateIndicators = useCallback((next: BodyIndicator[]) => {
    setIndicators(next);
  }, []);

  return (
    <main className="app-shell">
      <section className="viewport" aria-label="Interactive Solar System">
        <SolarSystem
          bodies={bodies}
          focusedId={focusedId}
          selectedIds={selectedIds}
          focusSequence={focusSequence}
          overviewSequence={overviewSequence}
          onSelect={selectBody}
          onIndicators={updateIndicators}
        />
      </section>

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <h1>Orrery</h1>
            <p>True-scale Solar System</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="utc-readout">{formatUtc(timeMs)} UTC</span>
          <button
            className="icon-button"
            type="button"
            title="Return to system overview"
            aria-label="Return to system overview"
            onClick={showOverview}
          >
            <Search size={18} />
          </button>
        </div>
      </header>

      <aside className="body-rail" aria-label="Celestial bodies">
        <div className="rail-heading">
          <span>Bodies</span>
        </div>
        <div className="body-list">
          {BODY_DEFINITIONS.map((body) => (
            <button
              className={`body-button ${selectedIds.has(body.id) ? "selected" : ""}`}
              key={body.id}
              type="button"
              onClick={(event) =>
                selectBody(body.id, event.metaKey || event.ctrlKey)
              }
              aria-pressed={selectedIds.has(body.id)}
            >
              <span className="body-swatch" style={{ background: body.color }} />
              <span>{body.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="indicator-layer" aria-label="Body indicators">
        {indicators.map((indicator) => (
          <button
            key={indicator.id}
            type="button"
            className={`body-indicator onscreen ${indicator.selected ? "selected" : ""}`}
            style={{ left: indicator.x, top: indicator.y }}
            onClick={(event) =>
              selectBody(indicator.id, event.metaKey || event.ctrlKey)
            }
            title={`Focus ${indicator.name}`}
            aria-label={`Focus ${indicator.name}`}
          >
            <span className="indicator-reticle" style={{ borderColor: indicator.color }} />
            <span>{indicator.name}</span>
          </button>
        ))}
      </div>

      <section className="time-console" aria-label="Simulation time controls">
        <div className="playback-controls">
          <button
            className="primary-icon-button"
            type="button"
            onClick={() => setPlaying((value) => !value)}
            title={playing ? "Pause simulation" : "Play simulation"}
            aria-label={playing ? "Pause simulation" : "Play simulation"}
          >
            {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setDirection((value) => (value === 1 ? -1 : 1))}
            title={direction === 1 ? "Play backward" : "Play forward"}
            aria-label={direction === 1 ? "Play backward" : "Play forward"}
          >
            {direction === 1 ? <RotateCcw size={18} /> : <RotateCw size={18} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTimeMs(Date.now())}
            title="Set current time"
            aria-label="Set current time"
          >
            <LocateFixed size={18} />
          </button>
        </div>

        <div className="scrubber">
          <div className="scrubber-labels" aria-hidden="true">
            <span>1800</span>
            <span>2000</span>
            <span>2200</span>
          </div>
          <input
            type="range"
            min={MIN_SCRUB_DAYS}
            max={MAX_SCRUB_DAYS}
            step="0.25"
            value={Math.max(MIN_SCRUB_DAYS, Math.min(MAX_SCRUB_DAYS, scrubDays))}
            onChange={(event) => {
              setPlaying(false);
              setTimeMs(J2000_MS + Number(event.target.value) * DAY_MS);
            }}
            aria-label="Scrub simulation date from 1800 to 2200"
          />
        </div>

        <label className="control-field date-field">
          <CalendarClock size={16} aria-hidden="true" />
          <span className="sr-only">UTC date and time</span>
          <input
            type="datetime-local"
            value={toDateInputValue(timeMs)}
            onChange={(event) => {
              const next = Date.parse(`${event.target.value}Z`);
              if (Number.isFinite(next)) {
                setPlaying(false);
                setTimeMs(next);
              }
            }}
          />
        </label>

        <label className="control-field rate-field">
          <Gauge size={16} aria-hidden="true" />
          <span className="sr-only">Playback rate</span>
          <select
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate.value} value={rate.value}>
                {rate.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </main>
  );
}
