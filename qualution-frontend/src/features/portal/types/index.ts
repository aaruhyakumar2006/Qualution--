export * from './database.types';

export interface PortalTelemetryEvent {
  id: string;
  session_id: string | null;
  event_type: string;
  event_payload: Record<string, unknown>;
  created_at: string;
}
