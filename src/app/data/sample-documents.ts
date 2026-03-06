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
      name: 'Resin Batch 48A',
      status: 'complete',
      startDate: '2024-08-02',
      endDate: '2024-09-05'
    }
  },
  {
    docId: 'wo-1002',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-01',
      name: 'Extrusion Run 49B',
      status: 'in-progress',
      startDate: '2024-10-01',
      endDate: '2024-11-18'
    }
  },
  {
    docId: 'wo-1003',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-02',
      name: 'CNC Housing Lot 882',
      status: 'open',
      startDate: '2024-09-12',
      endDate: '2024-10-03'
    }
  },
  {
    docId: 'wo-1004',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-02',
      name: 'Bracket Rework 27',
      status: 'blocked',
      startDate: '2024-12-04',
      endDate: '2025-01-15'
    }
  },
  {
    docId: 'wo-1005',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Assembly Pilot A',
      status: 'in-progress',
      startDate: '2024-08-20',
      endDate: '2024-09-30'
    }
  },
  {
    docId: 'wo-1006',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Assembly Pilot B',
      status: 'complete',
      startDate: '2024-10-10',
      endDate: '2024-11-26'
    }
  },
  {
    docId: 'wo-1007',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Assembly Ramp C',
      status: 'open',
      startDate: '2025-01-06',
      endDate: '2025-02-14'
    }
  },
  {
    docId: 'wo-1008',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-04',
      name: 'QC Final Audit 19',
      status: 'blocked',
      startDate: '2024-11-01',
      endDate: '2024-12-12'
    }
  },
  {
    docId: 'wo-1009',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-05',
      name: 'Packaging Holiday Push',
      status: 'complete',
      startDate: '2024-12-15',
      endDate: '2025-02-28'
    }
  }
];
