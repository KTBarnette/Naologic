import { WorkCenterDocument, WorkOrderDocument } from '../types/docs';

export const workCenters: WorkCenterDocument[] = [
  { docId: 'wc-01', docType: 'workCenter', data: { name: 'Genesis Hardware' } },
  { docId: 'wc-02', docType: 'workCenter', data: { name: 'Rodriques Electrics' } },
  { docId: 'wc-03', docType: 'workCenter', data: { name: 'Konsulting Inc' } },
  { docId: 'wc-04', docType: 'workCenter', data: { name: 'McMarrow Distribution' } },
  { docId: 'wc-05', docType: 'workCenter', data: { name: 'Spartan Manufacturing' } }
];

export const workOrders: WorkOrderDocument[] = [
  {
    docId: 'wo-1001',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-01',
      name: 'Marron Centrix Ltd',
      status: 'complete',
      startDate: '2024-07-20',
      endDate: '2024-10-05'
    }
  },
  {
    docId: 'wo-1002',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Konsulting Inc',
      status: 'in-progress',
      startDate: '2024-08-20',
      endDate: '2024-11-30'
    }
  },
  {
    docId: 'wo-1003',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-03',
      name: 'Compleks Systems',
      status: 'in-progress',
      startDate: '2024-11-25',
      endDate: '2025-02-20'
    }
  },
  {
    docId: 'wo-1004',
    docType: 'workOrder',
    data: {
      workCenterId: 'wc-04',
      name: 'McMarrow Distribution',
      status: 'blocked',
      startDate: '2024-09-20',
      endDate: '2025-01-10'
    }
  }
];
