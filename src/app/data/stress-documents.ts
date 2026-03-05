import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../types/docs';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_SEED = 0x9e3779b9;
const STATUS_POOL: WorkOrderStatus[] = ['open', 'in-progress', 'complete', 'blocked'];

function createSeededRng(seed = DEFAULT_SEED): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoToUtcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function utcDayToIso(utcDay: number): string {
  const d = new Date(utcDay * MS_PER_DAY);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function randintInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function generateWorkCenters(count: number): WorkCenterDocument[] {
  const normalizedCount = Math.max(0, Math.floor(count));
  return Array.from({ length: normalizedCount }, (_, i) => ({
    docId: `wc-${String(i + 1).padStart(3, '0')}`,
    docType: 'workCenter',
    data: {
      name: `Work Center ${String(i + 1).padStart(3, '0')}`
    }
  }));
}

export function generateWorkOrders(
  count: number,
  centers: WorkCenterDocument[],
  startIso: string,
  endIso: string
): WorkOrderDocument[] {
  const normalizedCount = Math.max(0, Math.floor(count));
  const usableCenters = centers.filter((center) => Boolean(center.docId));
  if (normalizedCount === 0 || usableCenters.length === 0) {
    return [];
  }

  const rng = createSeededRng();
  const minUtcDay = isoToUtcDay(startIso);
  const maxUtcDay = isoToUtcDay(endIso);
  const rangeStartUtcDay = Math.min(minUtcDay, maxUtcDay);
  const rangeEndUtcDay = Math.max(minUtcDay, maxUtcDay);
  const rangeSpanDays = Math.max(1, rangeEndUtcDay - rangeStartUtcDay + 1);

  const nextAvailableByCenter: Record<string, number> = {};
  const workOrders: WorkOrderDocument[] = [];

  for (let i = 0; i < normalizedCount; i += 1) {
    const center = usableCenters[i % usableCenters.length];
    const centerId = center.docId;

    const durationDays = randintInclusive(rng, 1, 14);
    const status = STATUS_POOL[Math.floor(rng() * STATUS_POOL.length)];

    const baseOffset = Math.floor((i / normalizedCount) * rangeSpanDays);
    const jitter = randintInclusive(rng, -5, 5);
    const proposedStart = Math.min(
      rangeEndUtcDay,
      Math.max(rangeStartUtcDay, rangeStartUtcDay + baseOffset + jitter)
    );

    const previousNextAvailable = nextAvailableByCenter[centerId] ?? rangeStartUtcDay;
    const shouldOverlap = rng() < 0.18;

    let startUtcDay = shouldOverlap
      ? Math.max(rangeStartUtcDay, Math.min(previousNextAvailable, proposedStart))
      : Math.max(previousNextAvailable, proposedStart);

    if (startUtcDay > rangeEndUtcDay) {
      startUtcDay = rangeEndUtcDay;
    }

    let endUtcDay = Math.min(rangeEndUtcDay, startUtcDay + durationDays - 1);
    if (endUtcDay < startUtcDay) {
      endUtcDay = startUtcDay;
    }

    const gapDays = randintInclusive(rng, 0, 2);
    nextAvailableByCenter[centerId] = endUtcDay + 1 + gapDays;

    workOrders.push({
      docId: `wo-${String(i + 1).padStart(5, '0')}`,
      docType: 'workOrder',
      data: {
        workCenterId: centerId,
        name: `Work Order ${String(i + 1).padStart(5, '0')}`,
        status,
        startDate: utcDayToIso(startUtcDay),
        endDate: utcDayToIso(endUtcDay)
      }
    });
  }

  return workOrders;
}
