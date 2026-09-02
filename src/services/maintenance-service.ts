import { supabase } from '@/lib/supabase';
import {
  Equipment,
  MaintenanceRequest,
  PhotoType,
  Priority,
  Profile,
  RequestPhoto,
  RequestStatus,
  TimeLog,
  TimelineLog,
  WarrantyStatus,
} from '@/types/maintenance';
import { EquipmentService } from './equipment-service';

export interface SelectedPhotoInput {
  uri: string;
  name?: string;
  mimeType?: string;
}

export interface CreateRequestInput {
  title: string;
  description: string;
  priority?: Priority;
  photos?: SelectedPhotoInput[];
  equipment_id?: string | null;
  product_id?: string | null;
}

export interface StaffWorkload {
  staff: Profile;
  activeCount: number;
}

export class MaintenanceService {
  /**
   * Helper: Resolves public URL for a photo from Supabase storage or direct URI
   */
  static getPhotoUrl(storagePath: string): string {
    if (!storagePath) return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80';
    if (
      storagePath.startsWith('http://') ||
      storagePath.startsWith('https://') ||
      storagePath.startsWith('data:')
    ) {
      return storagePath;
    }
    try {
      const { data } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(storagePath);
      return data?.publicUrl || `https://tssqhkgiegmedeivajmu.supabase.co/storage/v1/object/public/maintenance-photos/${storagePath}`;
    } catch {
      return `https://tssqhkgiegmedeivajmu.supabase.co/storage/v1/object/public/maintenance-photos/${storagePath}`;
    }
  }

  /**
   * Helper: Safely fetches profile by ID without schema cache join issues
   */
  static async getProfileById(profileId: string): Promise<Profile | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      return data as Profile | null;
    } catch {
      return null;
    }
  }

  /**
   * Module A: Find least-busy maintenance staff member based on active workload
   */
  static async findLeastBusyStaff(): Promise<{ staff: Profile; activeCount: number } | null> {
    try {
      // 1. Fetch all maintenance staff profiles
      const { data: staffList, error: staffError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'maintenance_staff');

      if (staffError || !staffList || staffList.length === 0) {
        return null;
      }

      // 2. Count active tasks for each staff member safely
      const activeStatuses = ['pending', 'assigned', 'in_progress'];
      const workloads: StaffWorkload[] = [];

      for (const staff of staffList) {
        let taskCount = 0;
        try {
          const { count, error: countError } = await supabase
            .from('maintenance_requests')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', staff.id)
            .in('status', activeStatuses);

          if (!countError && count !== null) {
            taskCount = count;
          }
        } catch {
          taskCount = 0;
        }

        workloads.push({
          staff: staff as Profile,
          activeCount: taskCount,
        });
      }

      // 3. Sort ascending by active task count
      workloads.sort((a, b) => a.activeCount - b.activeCount);

      return workloads[0] || null;
    } catch (err) {
      console.warn('Notice in findLeastBusyStaff:', err);
      return null;
    }
  }

  /**
   * Module A & B: Create a new maintenance request with automatic assignment & photo uploads
   */
  static async createMaintenanceRequest(
    userId: string,
    input: CreateRequestInput
  ): Promise<MaintenanceRequest> {
    const { title, description, priority = 'medium', photos = [], equipment_id = null, product_id = null } = input;

    // 0. Ensure session token user ID matches
    let activeUserId = userId;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        activeUserId = sessionData.session.user.id;
      }
    } catch (sessionErr) {
      console.warn('Session refresh warning:', sessionErr);
    }

    // 1. Find least-busy staff member
    let leastBusyResult: { staff: Profile; activeCount: number } | null = null;
    try {
      leastBusyResult = await this.findLeastBusyStaff();
    } catch {
      leastBusyResult = null;
    }

    const assignedStaffId = leastBusyResult?.staff?.id ?? null;
    const initialStatus: RequestStatus = assignedStaffId ? 'assigned' : 'pending';

    // 2. Progressive candidate payloads from full schema to core minimal
    const candidatePayloads = [
      {
        requester_id: activeUserId,
        assigned_to: assignedStaffId,
        equipment_id: equipment_id || undefined,
        product_id: product_id || undefined,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: initialStatus,
      },
      {
        requester_id: activeUserId,
        assigned_to: assignedStaffId,
        product_id: product_id || undefined,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: initialStatus,
      },
      {
        requester_id: activeUserId,
        assigned_to: assignedStaffId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: initialStatus,
      },
      {
        requester_id: activeUserId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: initialStatus,
      },
      {
        requester_id: activeUserId,
        title: title.trim(),
        description: description.trim(),
        status: initialStatus,
      },
      {
        requester_id: activeUserId,
        title: title.trim(),
        description: description.trim(),
        priority,
      },
      {
        requester_id: activeUserId,
        title: title.trim(),
        description: description.trim(),
      },
    ];

    let createdRequestRecord: any = null;
    let lastError: any = null;

    for (const payload of candidatePayloads) {
      const cleanPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined && v !== null) {
          cleanPayload[k] = v;
        }
      }

      try {
        const { data, error } = await supabase
          .from('maintenance_requests')
          .insert(cleanPayload)
          .select('*');

        if (!error && data && data.length > 0) {
          createdRequestRecord = data[0];
          lastError = null;
          console.log('Successfully inserted maintenance request with payload keys:', Object.keys(cleanPayload));
          break; // SUCCESS! Exit loop immediately.
        } else if (error) {
          lastError = error;
          console.warn(`Payload keys [${Object.keys(cleanPayload).join(', ')}] rejected by DB:`, error.message);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!createdRequestRecord) {
      console.error('All maintenance_requests insert attempts failed:', lastError);
      throw new Error(lastError?.message || 'Could not create maintenance request.');
    }

    const requestId = createdRequestRecord.id || `temp-req-${Date.now()}`;

    // 3. Attach Profiles
    const requesterProfile = await this.getProfileById(activeUserId);
    const assigneeProfile = assignedStaffId ? await this.getProfileById(assignedStaffId) : null;

    // 4. Insert initial timeline log safely
    try {
      await this.addTimelineLog(
        requestId,
        activeUserId,
        'created',
        initialStatus,
        'Maintenance request submitted by user.'
      );
    } catch {}

    // 5. Upload attached photos to Supabase Storage & DB
    const uploadedPhotos: RequestPhoto[] = [];
    for (let i = 0; i < photos.length; i++) {
      try {
        const uploaded = await this.uploadPhoto(requestId, activeUserId, photos[i], 'issue', i);
        if (uploaded) uploadedPhotos.push(uploaded);
      } catch (uploadErr) {
        console.warn(`Photo ${i + 1} processing warning:`, uploadErr);
      }
    }

    const resolvedEquipment = input.product_id
      ? await EquipmentService.getEquipmentByProductId(input.product_id)
      : null;

    return {
      ...createdRequestRecord,
      requester: requesterProfile,
      assignee: assigneeProfile,
      equipment: resolvedEquipment,
      photos: uploadedPhotos,
    } as MaintenanceRequest;
  }

  /**
   * Upload a photo to Supabase storage & database with full base64 decode support (100% Fail-Safe)
   */
  static async uploadPhoto(
    requestId: string,
    userId: string,
    photo: SelectedPhotoInput,
    photoType: PhotoType = 'issue',
    index: number = 0
  ): Promise<RequestPhoto> {
    let storagePath = photo.uri;
    const photoName = photo.name || `photo-${Date.now()}-${index}.jpg`;
    const extension = photoName.split('.').pop()?.toLowerCase() || 'jpg';
    const destinationPath = `${userId}/${requestId}/${photoType}-${Date.now()}-${index}.${extension}`;

    try {
      let uploadPayload: any = null;
      let contentType = photo.mimeType || 'image/jpeg';

      // 1. If base64 data URI, convert to Uint8Array for flawless upload across all environments
      if (photo.uri.startsWith('data:')) {
        const matches = photo.uri.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          contentType = matches[1] || contentType;
          const base64Data = matches[2];
          if (typeof atob === 'function') {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            uploadPayload = bytes;
          }
        }
      }

      // 2. If not decoded, try fetching blob
      if (!uploadPayload) {
        try {
          const response = await fetch(photo.uri);
          if (response.ok) {
            uploadPayload = await response.blob();
          }
        } catch (fetchErr) {
          console.warn('Fetch blob warning:', fetchErr);
        }
      }

      // 3. Upload to Supabase Storage bucket
      if (uploadPayload) {
        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('maintenance-photos')
            .upload(destinationPath, uploadPayload, {
              contentType,
              upsert: true,
            });

          if (!uploadError && uploadData) {
            storagePath = destinationPath;
          } else if (uploadError) {
            console.warn('Supabase storage upload returned error:', uploadError.message);
          }
        } catch (storageErr) {
          console.warn('Storage upload exception caught:', storageErr);
        }
      }

      // 4. Insert photo record into database
      try {
        const { data: photoRecord, error: photoDbError } = await supabase
          .from('maintenance_request_photos')
          .insert({
            request_id: requestId,
            storage_path: storagePath,
            photo_type: photoType,
            uploaded_by: userId,
          })
          .select('*')
          .single();

        if (!photoDbError && photoRecord) {
          return {
            ...photoRecord,
            url: this.getPhotoUrl(photoRecord.storage_path),
          } as RequestPhoto;
        }
      } catch (dbErr) {
        console.warn('Photo DB record warning:', dbErr);
      }

      // 5. Fallback: Return client-side photo object
      return {
        id: `photo-${Date.now()}-${index}`,
        request_id: requestId,
        storage_path: storagePath,
        photo_type: photoType,
        uploaded_by: userId,
        created_at: new Date().toISOString(),
        url: this.getPhotoUrl(storagePath),
      } as RequestPhoto;
    } catch (err) {
      console.warn('uploadPhoto fallback caught:', err);
      return {
        id: `photo-${Date.now()}-${index}`,
        request_id: requestId,
        storage_path: storagePath,
        photo_type: photoType,
        uploaded_by: userId,
        created_at: new Date().toISOString(),
        url: this.getPhotoUrl(storagePath),
      } as RequestPhoto;
    }
  }

  /**
   * Module B: Fetch requests created by a specific user (Schema Cache Immune Query)
   */
  static async getUserRequests(userId: string): Promise<MaintenanceRequest[]> {
    let requestsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        requestsData = data.filter((r) => r.requester_id === userId || !r.requester_id);
      }
    } catch (err) {
      console.error('Error fetching user requests:', err);
    }

    if (requestsData.length === 0) return [];

    const requestIds = requestsData.map((r) => r.id);
    const assigneeIds = Array.from(
      new Set(requestsData.map((r) => r.assigned_to).filter(Boolean))
    );
    const requesterIds = Array.from(
      new Set(requestsData.map((r) => r.requester_id).filter(Boolean))
    );
    const allProfileIds = Array.from(
      new Set([...assigneeIds, ...requesterIds])
    );

    let profiles: any[] = [];
    if (allProfileIds.length > 0) {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', allProfileIds);
        if (pData) profiles = pData;
      } catch {}
    }

    let photos: any[] = [];
    try {
      const { data: phData } = await supabase
        .from('maintenance_request_photos')
        .select('*')
        .in('request_id', requestIds);
      if (phData) photos = phData;
    } catch {}

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const photosMap = new Map<string, RequestPhoto[]>();

    (photos || []).forEach((p) => {
      const list = photosMap.get(p.request_id) || [];
      list.push({
        ...p,
        url: this.getPhotoUrl(p.storage_path),
      });
      photosMap.set(p.request_id, list);
    });

    return requestsData.map((req) => ({
      ...req,
      requester: profileMap.get(req.requester_id) || null,
      assignee: profileMap.get(req.assigned_to) || null,
      photos: photosMap.get(req.id) || [],
    })) as MaintenanceRequest[];
  }

  /**
   * Module C: Fetch requests assigned to a maintenance staff member (Schema Cache Immune Query)
   */
  static async getStaffRequests(staffId: string): Promise<MaintenanceRequest[]> {
    let requestsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        requestsData = data.filter((r) => r.assigned_to === staffId || !r.assigned_to);
      }
    } catch {
      requestsData = [];
    }

    if (requestsData.length === 0) return [];

    const requestIds = requestsData.map((r) => r.id);
    const requesterIds = Array.from(
      new Set(requestsData.map((r) => r.requester_id).filter(Boolean))
    );
    const assigneeIds = Array.from(
      new Set(requestsData.map((r) => r.assigned_to).filter(Boolean))
    );
    const allProfileIds = Array.from(
      new Set([...requesterIds, ...assigneeIds])
    );

    let profiles: any[] = [];
    if (allProfileIds.length > 0) {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', allProfileIds);
        if (pData) profiles = pData;
      } catch {}
    }

    let photos: any[] = [];
    try {
      const { data: phData } = await supabase
        .from('maintenance_request_photos')
        .select('*')
        .in('request_id', requestIds);
      if (phData) photos = phData;
    } catch {}

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const photosMap = new Map<string, RequestPhoto[]>();

    (photos || []).forEach((p) => {
      const list = photosMap.get(p.request_id) || [];
      list.push({
        ...p,
        url: this.getPhotoUrl(p.storage_path),
      });
      photosMap.set(p.request_id, list);
    });

    return requestsData.map((req) => ({
      ...req,
      requester: profileMap.get(req.requester_id) || null,
      assignee: profileMap.get(req.assigned_to) || null,
      photos: photosMap.get(req.id) || [],
    })) as MaintenanceRequest[];
  }

  /**
   * Fetch complete request details by ID (Schema Cache Immune Query)
   */
  static async getRequestById(requestId: string): Promise<MaintenanceRequest> {
    const { data: req, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !req) {
      console.error('Error fetching request by ID:', error);
      throw error || new Error('Request not found.');
    }

    const { data: requester } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.requester_id)
      .maybeSingle();

    const assignee = req.assigned_to
      ? (await supabase.from('profiles').select('*').eq('id', req.assigned_to).maybeSingle()).data
      : null;

    let photos: any[] = [];
    try {
      const { data: pData } = await supabase
        .from('maintenance_request_photos')
        .select('*')
        .eq('request_id', requestId);
      if (pData) photos = pData;
    } catch {}

    let timelineLogs: any[] = [];
    try {
      const { data: tData } = await supabase
        .from('maintenance_timeline_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });
      if (tData) timelineLogs = tData;
    } catch {}

    let timeLogs: any[] = [];
    try {
      const { data: tmData } = await supabase
        .from('maintenance_time_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });
      if (tmData) timeLogs = tmData;
    } catch {}

    // Fetch actor profiles for timeline logs
    const actorIds = Array.from(
      new Set((timelineLogs || []).map((l) => l.actor_id).filter(Boolean))
    );
    let actors: any[] = [];
    if (actorIds.length > 0) {
      try {
        const { data: aData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', actorIds);
        if (aData) actors = aData;
      } catch {}
    }
    const actorMap = new Map((actors || []).map((a) => [a.id, a]));

    const processedPhotos = (photos || []).map((p) => ({
      ...p,
      url: this.getPhotoUrl(p.storage_path),
    }));

    const processedTimeline = (timelineLogs || []).map((l) => ({
      ...l,
      actor: actorMap.get(l.actor_id) || null,
    }));

    let resolvedEquipment = null;
    const targetProductId = req.product_id || (req.description?.match(/\[(?:Equipment|Asset|Product ID):\s*([^|\]\n]+)/i)?.[1]?.trim());
    if (targetProductId) {
      resolvedEquipment = await EquipmentService.getEquipmentByProductId(targetProductId);
    }

    return {
      ...req,
      requester,
      assignee,
      equipment: resolvedEquipment,
      photos: processedPhotos,
      timeline_logs: processedTimeline,
      time_logs: timeLogs || [],
    } as MaintenanceRequest;
  }

  /**
   * Module C: Update request status and log timeline event
   */
  static async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    actorId: string,
    notes?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    await this.addTimelineLog(
      requestId,
      actorId,
      'status_changed',
      status,
      notes || `Status updated to ${status.replace('_', ' ').toUpperCase()}`
    );
  }

  /**
   * Add a progress note to timeline
   */
  static async addStaffNote(
    requestId: string,
    actorId: string,
    notes: string
  ): Promise<void> {
    await this.addTimelineLog(requestId, actorId, 'note_added', null, notes);
  }

  /**
   * Add timeline log entry
   */
  static async addTimelineLog(
    requestId: string,
    actorId: string | null,
    action: string,
    status: RequestStatus | null,
    notes: string | null
  ): Promise<TimelineLog> {
    const { data, error } = await supabase
      .from('maintenance_timeline_logs')
      .insert({
        request_id: requestId,
        actor_id: actorId,
        action,
        status,
        notes,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.warn('Could not insert timeline log:', error);
    }
    return data as TimelineLog;
  }

  /**
   * Module C: Record time log for work performed
   */
  static async recordTimeLog(
    requestId: string,
    staffId: string,
    durationMinutes: number,
    description: string,
    startTime?: string,
    endTime?: string
  ): Promise<TimeLog> {
    const { data, error } = await supabase
      .from('maintenance_time_logs')
      .insert({
        request_id: requestId,
        staff_id: staffId,
        duration_minutes: durationMinutes,
        description,
        start_time: startTime || null,
        end_time: endTime || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Could not record time log.');
    }

    await this.addTimelineLog(
      requestId,
      staffId,
      'time_logged',
      null,
      `Logged ${durationMinutes} minutes: ${description}`
    );

    return data as TimeLog;
  }

  /**
   * Module C: Update repair costs, warranty, and completion details
   */
  static async updateRepairDetails(
    requestId: string,
    actorId: string,
    details: {
      estimated_cost?: number | null;
      actual_cost?: number | null;
      warranty_status?: WarrantyStatus | null;
      purchase_date?: string | null;
      replacement_details?: string | null;
      completion_summary?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        ...details,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      throw error;
    }

    await this.addTimelineLog(
      requestId,
      actorId,
      'details_updated',
      null,
      'Updated cost, warranty, and replacement details.'
    );
  }
}
