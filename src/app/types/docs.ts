export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';

export interface WorkCenterDocument {
  docId: string;
  docType: 'workCenter';
  data: {
    name: string;
  };
}

export interface WorkOrderDocument {
  docId: string;
  docType: 'workOrder';
  data: {
    name: string;
    workCenterId: string;
    status: WorkOrderStatus;
    startDate: string;
    endDate: string;
  };
}

export type Document = WorkCenterDocument | WorkOrderDocument;
