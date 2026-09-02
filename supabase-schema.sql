-- ==============================================================================
-- AI-POWERED MAINTENANCE MANAGEMENT SYSTEM - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. PROFILES TABLE (Stores role and user metadata linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'maintenance_staff', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MAINTENANCE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  estimated_cost NUMERIC(10, 2),
  actual_cost NUMERIC(10, 2),
  warranty_status TEXT DEFAULT 'not_applicable' CHECK (warranty_status IN ('under_warranty', 'out_of_warranty', 'not_applicable')),
  purchase_date TEXT,
  replacement_details TEXT,
  completion_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. MAINTENANCE REQUEST PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.maintenance_request_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'issue' CHECK (photo_type IN ('issue', 'before', 'after', 'completion')),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MAINTENANCE TIMELINE / AUDIT TRAIL LOGS
CREATE TABLE IF NOT EXISTS public.maintenance_timeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MAINTENANCE TIME LOGS
CREATE TABLE IF NOT EXISTS public.maintenance_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_requests_requester ON public.maintenance_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON public.maintenance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_photos_request ON public.maintenance_request_photos(request_id);
CREATE INDEX IF NOT EXISTS idx_timeline_request ON public.maintenance_timeline_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_request ON public.maintenance_time_logs(request_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_request_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_timeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_time_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read all profiles; users can update own profile
CREATE POLICY "Public profiles are readable by authenticated users" 
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert profile during registration" 
  ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Requests: Requesters can see their own requests; Maintenance staff can see all assigned/unassigned requests
CREATE POLICY "Users can view own requests" 
  ON public.maintenance_requests FOR SELECT TO authenticated 
  USING (
    requester_id = auth.uid() 
    OR assigned_to = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('maintenance_staff', 'admin'))
  );

CREATE POLICY "Users can create requests" 
  ON public.maintenance_requests FOR INSERT TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Users and Staff can update requests" 
  ON public.maintenance_requests FOR UPDATE TO authenticated 
  USING (
    requester_id = auth.uid() 
    OR assigned_to = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('maintenance_staff', 'admin'))
  );

-- Photos: Readable by authenticated, insertable by authenticated
CREATE POLICY "Photos viewable by authenticated users" 
  ON public.maintenance_request_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Photos insertable by authenticated users" 
  ON public.maintenance_request_photos FOR INSERT TO authenticated WITH CHECK (true);

-- Timeline Logs: Readable by authenticated, insertable by authenticated
CREATE POLICY "Timeline logs viewable by authenticated users" 
  ON public.maintenance_timeline_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Timeline logs insertable by authenticated users" 
  ON public.maintenance_timeline_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Time Logs: Readable by authenticated, insertable by authenticated
CREATE POLICY "Time logs viewable by authenticated users" 
  ON public.maintenance_time_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Time logs insertable by authenticated users" 
  ON public.maintenance_time_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ==============================================================================
-- 6. EQUIPMENT / ASSETS TABLE (For QR Code Identification)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT UNIQUE NOT NULL, -- e.g. 'FAN-204-01'
  name TEXT NOT NULL,              -- e.g. 'Ceiling Fan'
  category TEXT NOT NULL,          -- e.g. 'Electrical', 'HVAC', 'Plumbing', 'General'
  location TEXT NOT NULL,          -- e.g. 'Room 204'
  model TEXT,                      -- e.g. 'XYZ-500'
  serial_number TEXT,              -- e.g. 'SN-8849204'
  installation_date DATE,
  warranty_status TEXT DEFAULT 'under_warranty' CHECK (warranty_status IN ('under_warranty', 'out_of_warranty', 'not_applicable')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in_maintenance', 'decommissioned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rapid lookup by QR Code Product ID
CREATE INDEX IF NOT EXISTS idx_equipment_product_id ON public.equipment(product_id);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON public.equipment(location);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category);

-- Add optional equipment reference columns to maintenance_requests
ALTER TABLE public.maintenance_requests 
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id TEXT;

-- Row Level Security (RLS)
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipment is viewable by authenticated and anon users" 
  ON public.equipment FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Equipment is insertable by authenticated and anon users" 
  ON public.equipment FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Equipment is updatable by authenticated and anon users" 
  ON public.equipment FOR UPDATE TO anon, authenticated USING (true);

-- Seed Data: Pre-configured Facility Equipment
INSERT INTO public.equipment (product_id, name, category, location, model, serial_number, warranty_status, status)
VALUES 
  ('FAN-204-01', 'Ceiling Fan', 'Electrical', 'Room 204', 'XYZ-500', 'SN-FAN-88492', 'under_warranty', 'active'),
  ('AC-101-02', 'Air Conditioner Inverter', 'HVAC', 'Living Room 101', 'DAIKIN-FTKM50', 'SN-AC-10924', 'under_warranty', 'active'),
  ('LIGHT-305-01', 'LED Ceiling Fixture Light', 'Electrical', 'Bedroom 305', 'PHILIPS-PL-18W', 'SN-LT-33019', 'under_warranty', 'active'),
  ('PLUMB-102-04', 'Mixer Tap & Pressure Valve', 'Plumbing', 'Kitchen 102', 'JAQUAR-FUS-102', 'SN-PL-55102', 'under_warranty', 'active'),
  ('GEYSER-204-01', 'Instant Water Heater Geyser', 'Plumbing', 'Room 204 Bathroom', 'BAJAJ-CAL-15L', 'SN-GY-20411', 'under_warranty', 'active'),
  ('MCB-204-01', 'Main Power Distribution MCB', 'Electrical', 'Room 204 Main Panel', 'SCHNEIDER-ACTI9', 'SN-MCB-77204', 'under_warranty', 'active'),
  ('RO-102-01', 'Water Purifier RO Plant', 'General', 'Kitchen 102', 'KENT-GRAND-PLUS', 'SN-RO-99102', 'out_of_warranty', 'active')
ON CONFLICT (product_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  model = EXCLUDED.model,
  serial_number = EXCLUDED.serial_number,
  warranty_status = EXCLUDED.warranty_status,
  updated_at = NOW();

