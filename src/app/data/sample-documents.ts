import { WorkCenterDocument, WorkOrderDocument } from '../types/docs';

export const workCenters: WorkCenterDocument[] = [
  { docId: 'wc-01', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
  { docId: 'wc-02', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
  { docId: 'wc-03', docType: 'workCenter', data: { name: 'Assembly Station' } },
  { docId: 'wc-04', docType: 'workCenter', data: { name: 'Quality Control' } },
  { docId: 'wc-05', docType: 'workCenter', data: { name: 'Packaging Line' } }
];

export const workOrders: WorkOrderDocument[] = [
  {
    docId: 'wo-1001',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-01',
      name: 'Aluminum Die Run',
      status: 'complete',
      startDate: '2026-02-20',
      endDate: '2026-02-27'
    }
  },
  {
    docId: 'wo-1002',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-01',
      name: 'Tube Profile Batch',
      status: 'open',
      startDate: '2026-03-04',
      endDate: '2026-03-11'
    }
  },
  {
    docId: 'wo-1003',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-02',
      name: 'Rotor Housing Finish',
      status: 'in-progress',
      startDate: '2026-03-01',
      endDate: '2026-03-08'
    }
  },
  {
    docId: 'wo-1004',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-02',
      name: 'Spindle Plate Rework',
      status: 'blocked',
      startDate: '2026-03-14',
      endDate: '2026-03-19'
    }
  },
  {
    docId: 'wo-1005',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Control Box Assembly',
      status: 'in-progress',
      startDate: '2026-02-26',
      endDate: '2026-03-06'
    }
  },
  {
    docId: 'wo-1006',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Harness Install Group B',
      status: 'open',
      startDate: '2026-03-09',
      endDate: '2026-03-16'
    }
  },
  {
    docId: 'wo-1007',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-04',
      name: 'Pressure Verification',
      status: 'blocked',
      startDate: '2026-03-03',
      endDate: '2026-03-07'
    }
  },
  {
    docId: 'wo-1008',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-05',
      name: 'Final Pack Run 22A',
      status: 'complete',
      startDate: '2026-02-24',
      endDate: '2026-03-02'
    }
  },
  {
    docId: 'wo-1009',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-05',
      name: 'Labeling Wave 3',
      status: 'open',
      startDate: '2026-03-10',
      endDate: '2026-03-15'
    }
  }
];
