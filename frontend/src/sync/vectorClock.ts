export type VClock = Record<string, number>;

export function vcTick(clock: VClock, deviceId: string): VClock {
  return { ...clock, [deviceId]: (clock[deviceId] ?? 0) + 1 };
}

export function vcMerge(a: VClock, b: VClock): VClock {
  const result: VClock = { ...a };
  for (const [k, v] of Object.entries(b)) {
    result[k] = Math.max(result[k] ?? 0, v);
  }
  return result;
}

// Returns true if a happened strictly after b (a dominates b)
export function vcAfter(a: VClock, b: VClock): boolean {
  const aGeB = Object.keys({ ...a, ...b }).every(k => (a[k] ?? 0) >= (b[k] ?? 0));
  const strictly = Object.keys({ ...a, ...b }).some(k => (a[k] ?? 0) > (b[k] ?? 0));
  return aGeB && strictly;
}

export function vcConcurrent(a: VClock, b: VClock): boolean {
  return !vcAfter(a, b) && !vcAfter(b, a) && JSON.stringify(a) !== JSON.stringify(b);
}
