import { supabase } from '../../../lib/supabase';
import type { Tables, TablesInsert } from '../types/database.types';

export type PortalEvent = Tables<'portal_telemetry_events'>;
export type NewPortalEvent = TablesInsert<'portal_telemetry_events'>;

/**
 * Fetch telemetry events from Supabase (placeholder for MVP portal telemetry)
 */
export async function getPortalTelemetryEvents(limit: number = 50): Promise<PortalEvent[]> {
  const { data, error } = await supabase
    .from('portal_telemetry_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Record a telemetry event into Supabase
 */
export async function logPortalTelemetryEvent(event: NewPortalEvent): Promise<PortalEvent | null> {
  const { data, error } = await supabase
    .from('portal_telemetry_events')
    .insert(event)
    .select();

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? (data[0] as PortalEvent) : null;
}

export * from './posts';
export * from './comments';
