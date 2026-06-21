"use client";
import type { GameControl, ControlValues } from "@/lib/gameSpec";

interface Props {
  controls: GameControl[];
  values: ControlValues;
  onChange: (values: ControlValues) => void;
}

export default function ControlPanel({ controls, values, onChange }: Props) {
  const update = (id: string, value: number | boolean | string) => {
    onChange({ ...values, [id]: value });
  };

  if (controls.length === 0) return null;

  return (
    <div className="card p-3 space-y-3">
      {controls.map((ctrl) => {
        switch (ctrl.type) {
          case "slider": {
            const val = Number(values[ctrl.id] ?? ctrl.default);
            return (
              <div key={ctrl.id}>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>{ctrl.label}</span>
                  <span className="text-accent2">
                    {val}{ctrl.unit || ""}
                  </span>
                </div>
                <input
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={val}
                  onChange={(e) => update(ctrl.id, Number(e.target.value))}
                  className="w-full"
                />
              </div>
            );
          }
          case "toggle": {
            const val = Boolean(values[ctrl.id] ?? ctrl.default);
            return (
              <button
                key={ctrl.id}
                className="flex w-full items-center justify-between rounded-md border border-edge bg-panel/70 px-3 py-2 text-sm"
                onClick={() => update(ctrl.id, !val)}
              >
                <span className="text-gray-300">{ctrl.label}</span>
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${val ? "bg-good" : "bg-gray-700"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${val ? "translate-x-4" : ""}`} />
                </span>
              </button>
            );
          }
          case "selector": {
            const val = String(values[ctrl.id] ?? ctrl.default);
            return (
              <div key={ctrl.id}>
                <div className="text-sm text-gray-300 mb-1">{ctrl.label}</div>
                <div className="flex gap-1">
                  {ctrl.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update(ctrl.id, opt.value)}
                      className={
                        "flex-1 rounded border px-2 py-1.5 text-xs transition " +
                        (val === opt.value
                          ? "bg-accent/30 border-accent text-white"
                          : "border-edge text-gray-400 hover:bg-edge/50")
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
