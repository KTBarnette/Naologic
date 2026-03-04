import { WorkCenterDocument, WorkOrderDocument } from '../types/docs';

export const workCenters: WorkCenterDocument[] = [
  { id: 'wc-01', name: 'CNC Machining Cell A' },
  { id: 'wc-02', name: 'Laser Cutting Bay' },
  { id: 'wc-03', name: 'Heat Treat Furnace 2' },
  { id: 'wc-04', name: 'Assembly Line East' },
  { id: 'wc-05', name: 'Paint Booth North' },
  { id: 'wc-06', name: 'Final Inspection Bench' }
];

export const workOrders: WorkOrderDocument[] = [
  {
    id: 'wo-1001',
    workCenterId: 'wc-01',
    name: 'Pump Housing Run',
    status: 'open',
    startsAtIso: '2026-02-17',
    endsAtIso: '2026-02-19'
  },
  {
    id: 'wo-1002',
    workCenterId: 'wc-01',
    name: 'Valve Plate Batch',
    status: 'in-progress',
    startsAtIso: '2026-02-22',
    endsAtIso: '2026-02-25'
  },
  {
    id: 'wo-1003',
    workCenterId: 'wc-02',
    name: 'Bracket Profiles',
    status: 'complete',
    startsAtIso: '2026-02-18',
    endsAtIso: '2026-02-21'
  },
  {
    id: 'wo-1004',
    workCenterId: 'wc-02',
    name: 'Guard Panel Cut Set',
    status: 'blocked',
    startsAtIso: '2026-02-27',
    endsAtIso: '2026-03-03'
  },
  {
    id: 'wo-1005',
    workCenterId: 'wc-03',
    name: 'Shaft Hardening Lot',
    status: 'in-progress',
    startsAtIso: '2026-02-20',
    endsAtIso: '2026-02-24'
  },
  {
    id: 'wo-1006',
    workCenterId: 'wc-03',
    name: 'Bearing Race Temper',
    status: 'open',
    startsAtIso: '2026-03-05',
    endsAtIso: '2026-03-08'
  },
  {
    id: 'wo-1007',
    workCenterId: 'wc-04',
    name: 'Control Box Assembly',
    status: 'complete',
    startsAtIso: '2026-02-23',
    endsAtIso: '2026-02-28'
  },
  {
    id: 'wo-1008',
    workCenterId: 'wc-05',
    name: 'Frame Paint Prep',
    status: 'open',
    startsAtIso: '2026-03-01',
    endsAtIso: '2026-03-04'
  },
  {
    id: 'wo-1009',
    workCenterId: 'wc-05',
    name: 'Final Topcoat Cycle',
    status: 'blocked',
    startsAtIso: '2026-03-10',
    endsAtIso: '2026-03-13'
  },
  {
    id: 'wo-1010',
    workCenterId: 'wc-04',
    name: 'Wire Harness Kitting',
    status: 'in-progress',
    startsAtIso: '2026-03-03',
    endsAtIso: '2026-03-06'
  },
  {
    id: 'wo-1011',
    workCenterId: 'wc-06',
    name: 'Pressure Test Verification',
    status: 'blocked',
    startsAtIso: '2026-03-04',
    endsAtIso: '2026-03-05'
  },
  {
    id: 'wo-1012',
    workCenterId: 'wc-06',
    name: 'Final QA Signoff Batch',
    status: 'complete',
    startsAtIso: '2026-03-07',
    endsAtIso: '2026-03-10'
  }
];
