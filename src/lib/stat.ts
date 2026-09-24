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
