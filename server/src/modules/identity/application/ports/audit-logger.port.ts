/**
 * Port for the shared AuditLogger service (Architecture Volume 03 §7.1).
 * Application-layer use cases call this explicitly at the point of a
 * business-significant state change (FR-ID-007) — never inferred
 * generically from ORM hooks.
 */
export interface AuditEvent {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  diff?: Record<string, unknown>;
  ipAddress: string | null;
}

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}

export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');
