import { Direction } from "./GameCanvas";

interface MobileControlsProps {
  onDirectionChange: (dir: Direction) => void;
}

export function MobileControls({ onDirectionChange }: MobileControlsProps) {
  return (
    <div className="mt-4 flex justify-center md:hidden">
      <div className="grid grid-cols-3 grid-rows-3 gap-2 text-slate-100">
        <div />
        <button
          type="button"
          aria-label="Move up"
          className="h-12 w-12 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center active:scale-95"
          onClick={() => onDirectionChange("up")}
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          aria-label="Move left"
          className="h-12 w-12 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center active:scale-95"
          onClick={() => onDirectionChange("left")}
        >
          ◀
        </button>
        <div />
        <button
          type="button"
          aria-label="Move right"
          className="h-12 w-12 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center active:scale-95"
          onClick={() => onDirectionChange("right")}
        >
          ▶
        </button>
        <div />
        <button
          type="button"
          aria-label="Move down"
          className="h-12 w-12 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center active:scale-95"
          onClick={() => onDirectionChange("down")}
        >
          ▼
        </button>
        <div />
      </div>
    </div>
  );
}
