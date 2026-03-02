"use client";

import { Clock3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./time-picker.module.css";

type PickerMode = "hour" | "minute";

function parse24(value: string) {
  if (!value || !value.includes(":")) return { h: 12, m: 0, ap: "AM" as const };
  const [hStr, mStr] = value.split(":");
  let h = Number.parseInt(hStr, 10) || 0;
  const m = Number.parseInt(mStr, 10) || 0;
  const ap = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { h, m, ap: ap as "AM" | "PM" };
}

function to24(h: number, m: number, ap: "AM" | "PM") {
  let hh = h % 12;
  if (ap === "PM") hh += 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDisplay(value: string) {
  const { h, m, ap } = parse24(value);
  return `${pad(h)}:${pad(m)} ${ap}`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const CX = 115;
const CY = 115;
const R_OUTER = 95;
const R_NUM = 77;
const HOUR_NUMS = Array.from({ length: 12 }, (_, i) => i + 1);
const MIN_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const MIN_TICKS = Array.from({ length: 60 }, (_, i) => i);

function ClockFace({
  mode,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onModeSwitch,
}: {
  mode: PickerMode;
  hour: number;
  minute: number;
  onHourChange: (value: number) => void;
  onMinuteChange: (value: number) => void;
  onModeSwitch: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);

  const committedAngle = mode === "hour" ? (hour % 12) * 30 : minute * 6;
  const displayAngle = liveAngle ?? committedAngle;
  const handTip = polar(CX, CY, R_NUM, displayAngle);

  const getAngle = useCallback((event: PointerEvent | React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const dx = event.clientX - rect.left - CX;
    const dy = event.clientY - rect.top - CY;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    return deg;
  }, []);

  const snapFromAngle = useCallback(
    (deg: number) => {
      if (mode === "hour") {
        const step = Math.round(deg / 30) % 12;
        const value = step || 12;
        return { value, angle: value * 30 };
      }
      const value = Math.round(deg / 6) % 60;
      return { value, angle: value * 6 };
    },
    [mode]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      event.preventDefault();
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const deg = getAngle(event);
      const { value, angle } = snapFromAngle(deg);
      setLiveAngle(angle);
      if (mode === "hour") onHourChange(value);
      else onMinuteChange(value);
    },
    [getAngle, mode, onHourChange, onMinuteChange, snapFromAngle]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current) return;
      const deg = getAngle(event);
      const { value, angle } = snapFromAngle(deg);
      setLiveAngle(angle);
      if (mode === "hour") onHourChange(value);
      else onMinuteChange(value);
    },
    [getAngle, mode, onHourChange, onMinuteChange, snapFromAngle]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const deg = getAngle(event);
      const { value } = snapFromAngle(deg);
      setLiveAngle(null);
      if (mode === "hour") {
        onHourChange(value);
        window.setTimeout(onModeSwitch, 180);
      } else {
        onMinuteChange(value);
      }
    },
    [getAngle, mode, onHourChange, onMinuteChange, onModeSwitch, snapFromAngle]
  );

  useEffect(() => () => {
    draggingRef.current = false;
  }, []);

  return (
    <svg
      ref={svgRef}
      width={CX * 2}
      height={CY * 2}
      className={styles.clockSvg}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (!draggingRef.current) setHoverValue(null);
      }}
      style={{ touchAction: "none" }}
    >
      <circle cx={CX} cy={CY} r={R_OUTER + 10} fill="#eff6ff" />
      <circle cx={CX} cy={CY} r={R_OUTER + 5} fill="#ffffff" />

      {mode === "minute" &&
        MIN_TICKS.map((tick) => {
          const isMajor = tick % 5 === 0;
          const p1 = polar(CX, CY, R_OUTER - 3, tick * 6);
          const p2 = polar(CX, CY, R_OUTER + 2, tick * 6);
          return (
            <line
              key={tick}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={isMajor ? "#93c5fd" : "#dbeafe"}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}

      <line
        x1={CX}
        y1={CY}
        x2={handTip.x}
        y2={handTip.y}
        stroke="#2563eb"
        strokeWidth={2.5}
        strokeLinecap="round"
        style={
          liveAngle === null
            ? { transition: "x2 0.18s cubic-bezier(.4,0,.2,1), y2 0.18s cubic-bezier(.4,0,.2,1)" }
            : undefined
        }
      />

      <circle cx={CX} cy={CY} r={5} fill="#2563eb" />

      <circle
        cx={handTip.x}
        cy={handTip.y}
        r={16}
        fill="#2563eb"
        style={
          liveAngle === null
            ? { transition: "cx 0.18s cubic-bezier(.4,0,.2,1), cy 0.18s cubic-bezier(.4,0,.2,1)" }
            : undefined
        }
      />

      {mode === "hour"
        ? HOUR_NUMS.map((n) => {
            const pos = polar(CX, CY, R_NUM, n * 30);
            const active = n === (hour % 12 || 12);
            const hover = hoverValue === n;
            return (
              <g
                key={n}
                onPointerEnter={() => setHoverValue(n)}
                onPointerLeave={() => setHoverValue(null)}
                onClick={() => {
                  onHourChange(n);
                  window.setTimeout(onModeSwitch, 120);
                }}
                style={{ cursor: "pointer" }}
              >
                {hover && !active ? <circle cx={pos.x} cy={pos.y} r={16} fill="#eff6ff" /> : null}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={14}
                  fontWeight={active || hover ? 700 : 500}
                  fill={active ? "#ffffff" : hover ? "#1d4ed8" : "#334155"}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {n}
                </text>
              </g>
            );
          })
        : MIN_LABELS.map((n) => {
            const pos = polar(CX, CY, R_NUM, n * 6);
            const active = n === minute;
            const hover = hoverValue === n;
            return (
              <g
                key={n}
                onPointerEnter={() => setHoverValue(n)}
                onPointerLeave={() => setHoverValue(null)}
                onClick={() => onMinuteChange(n)}
                style={{ cursor: "pointer" }}
              >
                {hover && !active ? <circle cx={pos.x} cy={pos.y} r={14} fill="#eff6ff" /> : null}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  fontWeight={active || hover ? 700 : 500}
                  fill={active ? "#ffffff" : hover ? "#1d4ed8" : "#334155"}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {pad(n)}
                </text>
              </g>
            );
          })}
    </svg>
  );
}

export default function TimePicker({
  value,
  onChange,
  className = "",
  placeholder = "Select time",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("hour");
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const openPicker = () => {
    const parsed = parse24(value);
    setHour(parsed.h);
    setMinute(parsed.m);
    setAmpm(parsed.ap);
    setMode("hour");
    setClosing(false);
    setOpen(true);
  };

  const closePicker = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 160);
  }, []);

  const handleOk = () => {
    closePicker();
  };

  useEffect(() => {
    if (!open) return;
    const nextValue = to24(hour, minute, ampm);
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }, [ampm, hour, minute, onChange, open, value]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) closePicker();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closePicker, open]);

  return (
    <div ref={wrapRef} className={`${styles.wrapper}${className ? ` ${className}` : ""}`}>
      <button type="button" className={styles.trigger} onClick={openPicker}>
        <span className={`${styles.triggerText}${!value ? ` ${styles.placeholder}` : ""}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Clock3 className={styles.clockIcon} size={16} />
      </button>

      {open ? (
        <div className={`${styles.popover}${closing ? ` ${styles.popoverOut}` : ""}`}>
          <div className={styles.header}>
            <div className={styles.timeRow}>
              <div className={styles.timeLeft}>
                <button
                  type="button"
                  className={`${styles.seg}${mode === "hour" ? ` ${styles.segActive}` : ""}`}
                  onClick={() => setMode("hour")}
                >
                  {pad(hour)}
                </button>
                <span className={styles.colon}>:</span>
                <button
                  type="button"
                  className={`${styles.seg}${mode === "minute" ? ` ${styles.segActive}` : ""}`}
                  onClick={() => setMode("minute")}
                >
                  {pad(minute)}
                </button>
              </div>

              <div className={styles.ampm}>
                <button
                  type="button"
                  className={`${styles.ampmBtn}${ampm === "AM" ? ` ${styles.ampmBtnActive}` : ""}`}
                  onClick={() => setAmpm("AM")}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`${styles.ampmBtn}${ampm === "PM" ? ` ${styles.ampmBtnActive}` : ""}`}
                  onClick={() => setAmpm("PM")}
                >
                  PM
                </button>
              </div>
            </div>

            <div className={styles.modeLabel}>{mode === "hour" ? "Select Hour" : "Select Minute"}</div>
          </div>

          <div className={styles.clockArea}>
            <ClockFace
              mode={mode}
              hour={hour}
              minute={minute}
              onHourChange={setHour}
              onMinuteChange={setMinute}
              onModeSwitch={() => setMode("minute")}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={closePicker}>
              CANCEL
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnOk}`} onClick={handleOk}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
