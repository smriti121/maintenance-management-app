export type UserRole = 'user' | 'maintenance_staff' | 'admin';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type PhotoType = 'issue' | 'before' | 'after' | 'completion';

export type WarrantyStatus = 'under_warranty' | 'out_of_warranty' | 'not_applicable';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at?: string;
}

export interface RequestPhoto {
  id: string;
  request_id: string;
  storage_path: string;
  photo_type: PhotoType;
  uploaded_by?: string | null;
  created_at: string;
  url?: string; // Resolved public / signed URL
}

export interface TimelineLog {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: string;
  status: RequestStatus | null;
  notes: string | null;
  created_at: string;
  actor?: Profile;
}

export interface TimeLog {
  id: string;
  request_id: string;
  staff_id: string;
  duration_minutes: number;
  description: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at: string;
  staff?: Profile;
}

export interface MaintenanceRequest {
  id: string;
  requester_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: RequestStatus;
  estimated_cost: number | null;
  actual_cost: number | null;
  warranty_status: WarrantyStatus | null;
  purchase_date: string | null;
  replacement_details: string | null;
  completion_summary: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  requester?: Profile;
  assignee?: Profile;
  photos?: RequestPhoto[];
  timeline_logs?: TimelineLog[];
  time_logs?: TimeLog[];
}
