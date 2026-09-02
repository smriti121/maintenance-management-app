import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Equipment } from '@/types/maintenance';

const STORAGE_EQUIPMENT_KEY = '@fixflow_local_equipment_cache';

export const SEED_EQUIPMENT: Equipment[] = [
  {
    id: 'eq-fan-204-01',
    product_id: 'FAN-204-01',
    name: 'Ceiling Fan',
    category: 'Electrical',
    location: 'Room 204',
    model: 'XYZ-500',
    serial_number: 'SN-FAN-88492',
    installation_date: '2024-03-15',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-ac-101-02',
    product_id: 'AC-101-02',
    name: 'Air Conditioner Inverter',
    category: 'HVAC',
    location: 'Living Room 101',
    model: 'DAIKIN-FTKM50',
    serial_number: 'SN-AC-10924',
    installation_date: '2023-08-20',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-light-305-01',
    product_id: 'LIGHT-305-01',
    name: 'LED Ceiling Fixture Light',
    category: 'Electrical',
    location: 'Bedroom 305',
    model: 'PHILIPS-PL-18W',
    serial_number: 'SN-LT-33019',
    installation_date: '2024-01-10',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-plumb-102-04',
    product_id: 'PLUMB-102-04',
    name: 'Mixer Tap & Pressure Valve',
    category: 'Plumbing',
    location: 'Kitchen 102',
    model: 'JAQUAR-FUS-102',
    serial_number: 'SN-PL-55102',
    installation_date: '2023-11-05',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-geyser-204-01',
    product_id: 'GEYSER-204-01',
    name: 'Instant Water Heater Geyser',
    category: 'Plumbing',
    location: 'Room 204 Bathroom',
    model: 'BAJAJ-CAL-15L',
    serial_number: 'SN-GY-20411',
    installation_date: '2024-02-14',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-mcb-204-01',
    product_id: 'MCB-204-01',
    name: 'Main Power Distribution MCB',
    category: 'Electrical',
    location: 'Room 204 Main Panel',
    model: 'SCHNEIDER-ACTI9',
    serial_number: 'SN-MCB-77204',
    installation_date: '2023-05-12',
    warranty_status: 'under_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'eq-ro-102-01',
    product_id: 'RO-102-01',
    name: 'Water Purifier RO Plant',
    category: 'General',
    location: 'Kitchen 102',
    model: 'KENT-GRAND-PLUS',
    serial_number: 'SN-RO-99102',
    installation_date: '2022-09-18',
    warranty_status: 'out_of_warranty',
    status: 'active',
    created_at: new Date().toISOString(),
  },
];

export class EquipmentService {
  /**
   * Helper: Extracts clean product_id from raw QR code string / URL / JSON
   */
  static parseQrCode(rawCode: string): string {
    if (!rawCode) return '';
    let clean = rawCode.trim();

    // 1. Check if JSON formatted
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.productId) return String(parsed.productId).trim().toUpperCase();
        if (parsed.product_id) return String(parsed.product_id).trim().toUpperCase();
        if (parsed.id) return String(parsed.id).trim().toUpperCase();
      } catch {
        // Not valid JSON, continue
      }
    }

    // 2. Check if URL with query parameter e.g. fixflow://asset?id=FAN-204-01 or https://fixflow.app/asset/FAN-204-01
    if (clean.includes('?id=')) {
      const match = clean.match(/[?&]id=([^&]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim().toUpperCase();
      }
    }

    if (clean.includes('/asset/') || clean.includes('/equipment/')) {
      const parts = clean.split('/');
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last).trim().toUpperCase();
    }

    // 3. Plain identifier (e.g. "FAN-204-01")
    return clean.toUpperCase();
  }

  /**
   * Retrieve equipment by its unique Product ID (e.g. 'FAN-204-01')
   * Dual-tier strategy: Supabase DB first -> Local Cache & Seed Equipment fallback
   */
  static async getEquipmentByProductId(productIdInput: string): Promise<Equipment | null> {
    const cleanId = this.parseQrCode(productIdInput);
    if (!cleanId) return null;

    // 1. Try querying Supabase database
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .ilike('product_id', cleanId)
        .maybeSingle();

      if (!error && data) {
        const eqRecord = data as Equipment;
        // Save into local cache for offline access
        this.cacheEquipmentLocally(eqRecord).catch(() => {});
        return eqRecord;
      }
    } catch (err) {
      console.warn('Supabase equipment query error, falling back to local seed:', err);
    }

    // 2. Check local AsyncStorage cache
    try {
      const cachedRaw = await AsyncStorage.getItem(STORAGE_EQUIPMENT_KEY);
      if (cachedRaw) {
        const cachedList: Equipment[] = JSON.parse(cachedRaw);
        const match = cachedList.find(
          (e) => e.product_id.toUpperCase() === cleanId.toUpperCase()
        );
        if (match) return match;
      }
    } catch {
      // ignore
    }

    // 3. Fallback to pre-configured Seed Equipment
    const seedMatch = SEED_EQUIPMENT.find(
      (e) => e.product_id.toUpperCase() === cleanId.toUpperCase()
    );

    return seedMatch || null;
  }

  /**
   * Fetch all equipment for facility inventory & printable asset sheet
   */
  static async getAllEquipment(): Promise<Equipment[]> {
    const combinedMap = new Map<string, Equipment>();

    // Add seeds first
    for (const seed of SEED_EQUIPMENT) {
      combinedMap.set(seed.product_id.toUpperCase(), seed);
    }

    // Add local cached equipment
    try {
      const cachedRaw = await AsyncStorage.getItem(STORAGE_EQUIPMENT_KEY);
      if (cachedRaw) {
        const cachedList: Equipment[] = JSON.parse(cachedRaw);
        for (const item of cachedList) {
          combinedMap.set(item.product_id.toUpperCase(), item);
        }
      }
    } catch {
      // ignore
    }

    // Query Supabase
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('product_id', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const item of data as Equipment[]) {
          combinedMap.set(item.product_id.toUpperCase(), item);
        }
      }
    } catch (err) {
      console.warn('Supabase equipment fetch notice:', err);
    }

    return Array.from(combinedMap.values());
  }

  /**
   * Helper: Caches equipment in local storage
   */
  private static async cacheEquipmentLocally(equipment: Equipment): Promise<void> {
    try {
      const cachedRaw = await AsyncStorage.getItem(STORAGE_EQUIPMENT_KEY);
      const list: Equipment[] = cachedRaw ? JSON.parse(cachedRaw) : [];
      const index = list.findIndex(
        (e) => e.product_id.toUpperCase() === equipment.product_id.toUpperCase()
      );
      if (index >= 0) {
        list[index] = equipment;
      } else {
        list.push(equipment);
      }
      await AsyncStorage.setItem(STORAGE_EQUIPMENT_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}
