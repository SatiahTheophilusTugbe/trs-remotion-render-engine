export const COUNT_UP_SECONDS = 1.2;

export const countUpValue = (
  frame: number,
  fps: number,
  target: number,
  seconds: number = COUNT_UP_SECONDS,
): number => {
  const totalFrames = Math.max(1, Math.round(seconds * fps));
  const t = Math.min(1, Math.max(0, frame / totalFrames));
  if (t >= 1) return target;
  return target * (1 - Math.pow(1 - t, 3));
};

export const formatStat = (value: number, decimals = 0, prefix = '', suffix = ''): string =>
  `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;

// ---- Odometer helpers (pure; consumed by compositions/OdometerStat.tsx and swept in tests) ----

// Current odometer value in the smallest displayed unit (e.g. tenths for decimals=1).
// progress in [0,1]; progress === 1 yields the exact integer target (no float drift).
export const odometerUnits = (target: number, decimals: number, progress: number): number =>
  Math.round(Math.abs(target) * 10 ** decimals) * progress;

// Wheel position (0..10) of the digit at decimal `place` (0 = smallest unit). The smallest wheel
// spins continuously; every higher wheel sits on its integer digit and only turns while the wheel
// directly below is rolling from 9 to 0 (carry = how far that wheel is past 9). Settled values
// therefore always give exact integers.
export const wheelPos = (units: number, place: number): number => {
  const u = Math.max(0, units);
  if (place === 0) return u % 10;
  const digit = Math.floor(u / 10 ** place) % 10;
  return digit + Math.max(0, wheelPos(u, place - 1) - 9);
};

// Which template characters are visible at the current value. Leading zero columns are hidden
// (never "03.3" / "0,034") but keep reserving their width, so the readout never changes size and
// the final value is exactly centred. The ones column and everything right of it always show.
export const columnVisibility = (template: string, units: number, decimals: number): boolean[] => {
  const digitCount = template.replace(/[^0-9]/g, '').length;
  let idx = 0;
  let anyDigitVisible = false;
  return template.split('').map((ch) => {
    if (ch >= '0' && ch <= '9') {
      const place = digitCount - 1 - idx;
      idx += 1;
      const visible = place <= decimals || Math.floor(units / 10 ** place) >= 1;
      if (visible) anyDigitVisible = true;
      return visible;
    }
    if (ch === ',') return anyDigitVisible;
    return true; // '.', '-', anything else
  });
};

// The settled readout string at a given value (visible columns only, digits floored).
export const odometerText = (target: number, decimals: number, units: number): string => {
  const template = formatStat(target, decimals);
  const digitCount = template.replace(/[^0-9]/g, '').length;
  const vis = columnVisibility(template, units, decimals);
  let idx = 0;
  return template
    .split('')
    .map((ch, i) => {
      let out = ch;
      if (ch >= '0' && ch <= '9') {
        const place = digitCount - 1 - idx;
        idx += 1;
        out = String(Math.floor(wheelPos(units, place)) % 10);
      }
      return vis[i] ? out : '';
    })
    .join('');
};
