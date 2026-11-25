"use client";

import { Info } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatAxisClock,
  formatAxisMonth,
  formatAxisTime,
  formatDateRange,
  formatTemperature,
  formatTime,
  notPlottedNote,
} from "@/lib/temperatureAnswer/format";
import type {
  Observation,
  TemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { columnLabel } from "@/lib/temperatureAnswer/temperatureColumn";

interface TemperatureChartProps {
  answer: TemperatureAnswer;
}

type Point = Observation & { temperature: number };

const PADDING = { left: 36, right: 10, top: 10, bottom: 26 };
const MAX_POINT_MARKERS = 60;
const DEFAULT_WIDTH = 640;
const NARROW_WIDTH = 480;
const DAY_MS = 24 * 60 * 60 * 1000;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Whole-degree ticks with a 1/2/5/10 step, at most six of them. */
function temperatureTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const step = [1, 2, 5, 10, 20].find((s) => span / s <= 5) ?? 50;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = low; tick <= high; tick += step) ticks.push(tick);
  return ticks;
}

type TickMode = "month" | "clock" | "day";

/** Which labels fit the span: months, clock times within a day, or days. */
function tickMode(points: Point[]): TickMode {
  const span = points[points.length - 1].time.epochMs - points[0].time.epochMs;
  if (points[0].time.kind === "date" && span > 92 * DAY_MS) return "month";
  if (points[0].time.kind === "datetime" && span <= DAY_MS) return "clock";
  return "day";
}

function timeTicks(points: Point[], mode: TickMode, narrow: boolean): Point[] {
  if (mode === "month") {
    // Long daily series: one label per month (every third on narrow widths).
    return points.filter((point) => {
      const date = new Date(point.time.epochMs);
      return (
        date.getUTCDate() === 1 && date.getUTCMonth() % (narrow ? 3 : 1) === 0
      );
    });
  }
  const count = Math.min(points.length, narrow ? 4 : 5);
  return Array.from(
    { length: count },
    (_, i) => points[Math.round((i * (points.length - 1)) / (count - 1 || 1))],
  );
}

const TICK_LABEL: Record<TickMode, (point: Point) => string> = {
  month: (point) => formatAxisMonth(point.time),
  clock: (point) => formatAxisClock(point.time),
  day: (point) => formatAxisTime(point.time),
};

/** Splits the time-ordered observations into line segments at each gap. */
function segments(observations: Observation[]): Point[][] {
  const result: Point[][] = [];
  let current: Point[] = [];
  for (const observation of observations) {
    if (observation.temperature === null) {
      if (current.length) result.push(current);
      current = [];
    } else {
      current.push(observation as Point);
    }
  }
  if (current.length) result.push(current);
  return result;
}

/**
 * Line chart of the returned observations: no resampling, interpolation or
 * summaries. A missing value breaks the line; the table view carries the same
 * data for anyone not using the chart.
 */
export function TemperatureChart({ answer }: TemperatureChartProps) {
  const { ref, width } = useWidth();
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  // Only keyboard moves are announced; hovering would flood a screen reader.
  const [announced, setAnnounced] = useState<number | null>(null);

  const narrow = width < NARROW_WIDTH;
  const height = narrow ? 200 : 240;
  const label = columnLabel(answer.temperatureColumn);

  const points = useMemo(
    () =>
      answer.observations.filter(
        (observation): observation is Point => observation.temperature !== null,
      ),
    [answer.observations],
  );
  const lines = useMemo(
    () => segments(answer.observations),
    [answer.observations],
  );

  if (points.length < 2) return null;

  const values = points.map((point) => point.temperature);
  const yTicks = temperatureTicks(Math.min(...values), Math.max(...values));
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const tFirst = points[0].time.epochMs;
  const tLast = points[points.length - 1].time.epochMs;
  const plotWidth = width - PADDING.left - PADDING.right;
  const baseline = height - PADDING.bottom;
  const x = (epochMs: number) =>
    PADDING.left + ((epochMs - tFirst) / (tLast - tFirst)) * plotWidth;
  const y = (value: number) =>
    PADDING.top +
    (1 - (value - yMin) / (yMax - yMin || 1)) * (baseline - PADDING.top);

  const mode = tickMode(points);
  const monthly = mode === "month";
  const xTicks = timeTicks(points, mode, narrow);
  const activePoint = active === null ? null : points[active];
  const range = answer.dateRange
    ? formatDateRange(answer.dateRange, " to ")
    : "";
  const note = notPlottedNote(answer.notPlotted);

  const nearestIndex = (svgX: number) => {
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (
        Math.abs(x(points[i].time.epochMs) - svgX) <
        Math.abs(x(points[best].time.epochMs) - svgX)
      ) {
        best = i;
      }
    }
    return best;
  };

  const onMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = rect.width > 0 ? width / rect.width : 1;
    setActive(nearestIndex((event.clientX - rect.left) * scale));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    const next: Record<string, number> = {
      ArrowRight: active === null ? 0 : Math.min(active + 1, last),
      ArrowLeft: active === null ? 0 : Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in next) {
      event.preventDefault();
      setActive(next[event.key]);
      setAnnounced(next[event.key]);
    }
  };

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-2">
      <div
        role="img"
        tabIndex={0}
        aria-label={`Line chart of ${label}, ${points.length} values${
          range ? `, ${range}` : ""
        }`}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setActive(null);
          setAnnounced(null);
        }}
        className="relative rounded-md focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          // The SVG fills its container; its width never feeds back into
          // the measurement, so narrow screens do not widen the answer.
          className="block max-w-full overflow-visible text-blue-500"
          aria-hidden="true"
          onMouseMove={onMouseMove}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-slate-200"
              />
              <text
                x={PADDING.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-gray-650 text-xs"
              >
                {tick}°
              </text>
            </g>
          ))}
          {xTicks.map((point, index) => (
            <text
              key={point.time.epochMs}
              x={x(point.time.epochMs)}
              y={height - 6}
              textAnchor={
                index === 0
                  ? "start"
                  : index === xTicks.length - 1 && !monthly
                    ? "end"
                    : "middle"
              }
              className="fill-gray-650 text-xs"
            >
              {TICK_LABEL[mode](point)}
            </text>
          ))}
          <g>
            {lines.map((segment) => {
              const coordinates = segment
                .map(
                  (point) => `${x(point.time.epochMs)},${y(point.temperature)}`,
                )
                .join(" ");
              const startX = x(segment[0].time.epochMs);
              const endX = x(segment[segment.length - 1].time.epochMs);
              return segment.length > 1 ? (
                <g key={segment[0].time.epochMs}>
                  <polygon
                    points={`${startX},${baseline} ${coordinates} ${endX},${baseline}`}
                    fill={`url(#${gradientId})`}
                  />
                  <polyline
                    points={coordinates}
                    fill="none"
                    className="stroke-blue-500"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ) : null;
            })}
            {points.map((point) =>
              points.length <= MAX_POINT_MARKERS ||
              lines.some((s) => s.length === 1 && s[0] === point) ? (
                <circle
                  key={point.time.epochMs}
                  data-point=""
                  cx={x(point.time.epochMs)}
                  cy={y(point.temperature)}
                  r={3.25}
                  className="fill-white stroke-blue-500"
                  strokeWidth={1.75}
                />
              ) : null,
            )}
            {activePoint && (
              <>
                <line
                  x1={x(activePoint.time.epochMs)}
                  x2={x(activePoint.time.epochMs)}
                  y1={PADDING.top}
                  y2={baseline}
                  className="stroke-slate-400"
                />
                <circle
                  cx={x(activePoint.time.epochMs)}
                  cy={y(activePoint.temperature)}
                  r={5}
                  className="fill-blue-500 stroke-white"
                  strokeWidth={2}
                />
              </>
            )}
          </g>
        </svg>
        {activePoint && (
          <div
            data-testid="chart-tooltip"
            className="pointer-events-none absolute whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-s3"
            style={{
              left: Math.min(x(activePoint.time.epochMs) + 14, width - 150),
              top: Math.max(y(activePoint.temperature) - 52, 0),
            }}
          >
            <span className="block text-descriptions-12-regular text-gray-650">
              {formatTime(activePoint.time)}
            </span>
            <b className="text-body-14-medium text-slate-850">
              {formatTemperature(activePoint.temperature)} °C
            </b>
          </div>
        )}
      </div>
      <div role="status" className="sr-only">
        {announced !== null && points[announced]
          ? `${formatTime(points[announced].time)}: ${formatTemperature(points[announced].temperature)} °C`
          : ""}
      </div>
      {note && (
        <p className="flex items-start gap-1.5 text-descriptions-12-regular text-gray-650">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}
    </div>
  );
}
