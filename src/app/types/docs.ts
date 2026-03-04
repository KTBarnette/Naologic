export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';

export interface WorkCenterDocument {
  id: string;
  name: string;
}

export interface WorkOrderDocument {
  id: string;
  workCenterId: string;
  name: string;
  status: WorkOrderStatus;
  startsAtIso: string;
  endsAtIso: string;
}

export type Document = WorkCenterDocument | WorkOrderDocument;
