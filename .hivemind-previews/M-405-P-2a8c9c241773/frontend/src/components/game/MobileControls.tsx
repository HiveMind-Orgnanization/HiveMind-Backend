import { useEffect } from 'react';

export function MobileControls() {
  useEffect(() => {
    const handle = (dir: 'up' | 'down' | 'left' | 'right') => {
      const keyMap: Record<string, string> = {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      };
      const event = new KeyboardEvent('keydown', { key: keyMap[dir] });
      window.dispatchEvent(event);
    };

    (window as any).__snakeMobileControl = handle;

    return () => {
      delete (window as any).__snakeMobileControl;
    };
  }, []);

  const trigger = (dir: 'up' | 'down' | 'left' | 'right') => {
    const handler = (window as any).__snakeMobileControl as ((d: typeof dir) => void) | undefined;
    if (handler) handler(dir);
  };

  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center md:hidden">
      <div className="grid grid-cols-3 grid-rows-2 gap-2 text-slate-50 text-xs select-none">
        <button
          type="button"
          className="col-start-2 row-start-1 h-10 w-10 rounded-full bg-slate-800/80 flex items-center justify-center active:bg-slate-700 focus-ring"
          onClick={() => trigger('up')}
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          className="col-start-1 row-start-2 h-10 w-10 rounded-full bg-slate-800/80 flex items-center justify-center active:bg-slate-700 focus-ring"
          onClick={() => trigger('left')}
          aria-label="Move left"
        >
          ◀
        </button>
        <button
          type="button"
          className="col-start-2 row-start-2 h-10 w-10 rounded-full bg-slate-800/80 flex items-center justify-center active:bg-slate-700 focus-ring"
          onClick={() => trigger('down')}
          aria-label="Move down"
        >
          ▼
        </button>
        <button
          type="button"
          className="col-start-3 row-start-2 h-10 w-10 rounded-full bg-slate-800/80 flex items-center justify-center active:bg-slate-700 focus-ring"
          onClick={() => trigger('right')}
          aria-label="Move right"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
