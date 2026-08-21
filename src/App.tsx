import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gauge,
  Command,
  MousePointer2,
  Move,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MOON_DEFINITIONS,
  PRIMARY_BODY_DEFINITIONS,
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

export function App() {
  const [timeMs, setTimeMs] = useState(() => Date.now());
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(86_400);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [focusedId, setFocusedId] = useState<BodyId>("sun");
  const [selectedIds, setSelectedIds] = useState<Set<BodyId>>(
    () => new Set(["sun"]),
  );
  const [visibleIds, setVisibleIds] = useState<Set<BodyId>>(
    () => new Set([
      ...PRIMARY_BODY_DEFINITIONS.map((body) => body.id),
      "moon",
    ]),
  );
  const [collapsedBodyIds, setCollapsedBodyIds] = useState<Set<BodyId>>(
    () => new Set<BodyId>(
      PRIMARY_BODY_DEFINITIONS
        .filter((body) =>
          body.id !== "earth"
          && MOON_DEFINITIONS.some((moon) => moon.parentId === body.id),
        )
        .map((body) => body.id),
    ),
  );
  const [focusSequence, setFocusSequence] = useState(0);
  const [indicators, setIndicators] = useState<BodyIndicator[]>([]);
  const [attributionsOpen, setAttributionsOpen] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(true);
  const lastTick = useRef(0);

  const bodies = useMemo(
    () => calculateBodyStates(new Date(timeMs)),
    [timeMs],
  );
  const scrubDays = (timeMs - J2000_MS) / DAY_MS;

  useEffect(() => {
    if (!attributionsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAttributionsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [attributionsOpen]);

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
    setVisibleIds((current) => {
      if (current.has(id)) return current;
      return new Set([...current, id]);
    });

    if (additive) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setFocusSequence((sequence) => sequence + 1);
      return;
    }

    if (selectedIds.size === 1 && selectedIds.has(id)) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set([id]));
    setFocusedId(id);
    setFocusSequence((sequence) => sequence + 1);
  }, [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleBodyVisibility = useCallback((id: BodyId) => {
    setVisibleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleMoonGroup = useCallback((id: BodyId) => {
    setCollapsedBodyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
          visibleIds={visibleIds}
          focusSequence={focusSequence}
          onSelect={selectBody}
          onClearSelection={clearSelection}
          onIndicators={updateIndicators}
        />
      </section>

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
          </div>
          <div>
            <h1>Orrery</h1>
            <p>Interactive Solar System</p>
          </div>
        </div>
        <button
          className="header-link"
          type="button"
          onClick={() => setAttributionsOpen(true)}
        >
          Attributions
        </button>
      </header>

      <aside
        className={`controls-card ${controlsExpanded ? "expanded" : ""}`}
        aria-label="Controls"
      >
        <button
          className="controls-card-heading"
          type="button"
          onClick={() => setControlsExpanded((expanded) => !expanded)}
          aria-expanded={controlsExpanded}
          aria-controls="controls-list"
        >
          <span>Controls</span>
          {controlsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {controlsExpanded && (
          <dl className="controls-list" id="controls-list">
            <div>
              <dt><MousePointer2 size={17} /><span>Select</span></dt>
              <dd>Click or tap a body. Click the final selection again to clear it.</dd>
            </div>
            <div>
              <dt><RotateCw size={17} /><span>Rotate</span></dt>
              <dd>Left drag or one-finger drag.</dd>
            </div>
            <div>
              <dt><Move size={17} /><span>Pan</span></dt>
              <dd>Right drag. Panning clears the current selection.</dd>
            </div>
            <div>
              <dt><ZoomIn size={17} /><span>Zoom</span></dt>
              <dd>Scroll or pinch.</dd>
            </div>
            <div>
              <dt><Command size={17} /><span>Multi-select</span></dt>
              <dd>Command or Control + click.</dd>
            </div>
          </dl>
        )}
      </aside>

      {attributionsOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAttributionsOpen(false);
          }}
        >
          <section
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attributions-title"
          >
            <div className="modal-heading">
              <h2 id="attributions-title">Attributions</h2>
              <button
                className="modal-close"
                type="button"
                onClick={() => setAttributionsOpen(false)}
                aria-label="Close attributions"
                title="Close"
                autoFocus
              >
                <X size={18} />
              </button>
            </div>
            <div className="attribution-entry">
              <h3>Planet textures</h3>
              <p>
                Adapted from textures by Solar System Scope / INOVE, based on
                NASA elevation and imagery data. Files were resized for this project.
              </p>
              <div className="attribution-links">
                <a
                  href="https://www.solarsystemscope.com/textures/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solar System Scope <ExternalLink size={13} aria-hidden="true" />
                </a>
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0 <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        </div>
      )}

      <aside className="body-rail" aria-label="Celestial bodies">
        <div className="rail-heading">
          <span>Bodies</span>
        </div>
        <div className="body-list">
          {PRIMARY_BODY_DEFINITIONS.map((body) => {
            const moons = MOON_DEFINITIONS.filter((moon) => moon.parentId === body.id);
            const hasMoons = moons.length > 0;
            const expanded = hasMoons && !collapsedBodyIds.has(body.id);
            return (
              <div className="body-group" key={body.id}>
                <div className="body-control">
                  <input
                    className="body-visibility"
                    type="checkbox"
                    checked={visibleIds.has(body.id)}
                    onChange={() => toggleBodyVisibility(body.id)}
                    aria-label={`Show ${body.name}`}
                    title={`${visibleIds.has(body.id) ? "Hide" : "Show"} ${body.name}`}
                    style={{ color: body.color }}
                  />
                  <button
                    className={`body-button ${hasMoons ? "has-moons" : ""} ${selectedIds.has(body.id) ? "selected" : ""}`}
                    type="button"
                    onClick={(event) => selectBody(body.id, event.metaKey || event.ctrlKey)}
                    aria-pressed={selectedIds.has(body.id)}
                  >
                    <span>{body.name}</span>
                  </button>
                  {hasMoons && (
                    <button
                      className="moon-toggle"
                      type="button"
                      onClick={() => toggleMoonGroup(body.id)}
                      aria-expanded={expanded}
                      aria-controls={`${body.id}-moons`}
                      aria-label={`${expanded ? "Collapse" : "Expand"} moons of ${body.name}`}
                      title={`${expanded ? "Collapse" : "Expand"} moons`}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="moon-list" id={`${body.id}-moons`}>
                    {moons.map((moon) => (
                      <div className="body-control moon-control" key={moon.id}>
                        <input
                          className="body-visibility moon-visibility"
                          type="checkbox"
                          checked={visibleIds.has(moon.id)}
                          onChange={() => toggleBodyVisibility(moon.id)}
                          aria-label={`Show ${moon.name}`}
                          title={`${visibleIds.has(moon.id) ? "Hide" : "Show"} ${moon.name}`}
                          style={{ color: moon.color }}
                        />
                        <button
                          className={`body-button moon-button ${selectedIds.has(moon.id) ? "selected" : ""}`}
                          type="button"
                          onClick={(event) => selectBody(moon.id, event.metaKey || event.ctrlKey)}
                          aria-pressed={selectedIds.has(moon.id)}
                        >
                          <span>{moon.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <div
        className="indicator-layer"
        aria-label="Body indicators"
        onWheel={(event) => {
          const canvas = event.currentTarget.parentElement?.querySelector("canvas");
          if (!canvas) return;
          event.preventDefault();
          canvas.dispatchEvent(new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            deltaMode: event.deltaMode,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ,
          }));
        }}
      >
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
            {indicator.showReticle && (
              <span
                className="indicator-reticle"
                style={{ borderColor: indicator.color }}
                aria-hidden="true"
              />
            )}
            <span
              className="indicator-label"
              style={{
                left: indicator.labelOffsetX,
                transform: `translateY(calc(-50% + ${indicator.labelOffsetY}px))`,
              }}
            >
              {indicator.name}
            </span>
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

        <div className="control-field date-field">
          <label className="sr-only" htmlFor="simulation-date">UTC date and time</label>
          <input
            id="simulation-date"
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
          <button
            className="date-now-button"
            type="button"
            onClick={() => {
              setPlaying(false);
              setTimeMs(Date.now());
            }}
            title="Set time to now"
            aria-label="Set time to now"
          >
            <CalendarClock size={16} />
          </button>
        </div>

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
