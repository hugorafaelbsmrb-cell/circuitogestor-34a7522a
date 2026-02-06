import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'permission_changed'
  | 'student_created'
  | 'student_updated'
  | 'student_deleted'
  | 'guardian_created'
  | 'guardian_updated'
  | 'guardian_deleted'
  | 'enrollment_created'
  | 'enrollment_updated'
  | 'enrollment_cancelled'
  | 'contract_created'
  | 'contract_signed'
  | 'payment_created'
  | 'payment_updated'
  | 'payment_deleted'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_converted'
  | 'lead_deleted'
  | 'settings_updated'
  | 'course_created'
  | 'course_updated'
  | 'course_deleted'
  | 'class_created'
  | 'class_updated'
  | 'class_deleted'
  | 'teacher_created'
  | 'teacher_updated'
  | 'teacher_deleted'
  | 'message_sent'
  | 'bulk_message_sent'
  | 'data_exported'
  | 'data_imported';

interface AuditLogParams {
  action: AuditAction;
  tableName?: string;
  recordId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to track sensitive actions
 * @param params Audit log parameters
 * @returns Promise with the log ID or null if failed
 */
export async function logAudit(params: AuditLogParams): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get client info
    const ipAddress = await getClientIP();
    const userAgent = navigator.userAgent;
    
    const { data, error } = await supabase.rpc('log_audit', {
      p_user_id: user?.id || null,
      p_action: params.action,
      p_table_name: params.tableName || null,
      p_record_id: params.recordId || null,
      p_old_data: params.oldData ? JSON.stringify(params.oldData) : null,
      p_new_data: params.newData ? JSON.stringify(params.newData) : null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
    });
    
    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }
    
    return data as string;
  } catch (error) {
    console.error('Audit logging error:', error);
    return null;
  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string | null> {
  try {
    // This is a best-effort approach - in production, 
    // IP should be captured server-side
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    });
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

/**
 * Log a login event
 */
export async function logLogin(email: string, success: boolean): Promise<void> {
  await logAudit({
    action: success ? 'login' : 'login_failed',
    metadata: { email },
  });
}

/**
 * Log a logout event
 */
export async function logLogout(): Promise<void> {
  await logAudit({
    action: 'logout',
  });
}

/**
 * Log a CRUD operation
 */
export async function logCRUD(
  action: 'created' | 'updated' | 'deleted',
  entityType: string,
  recordId: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>
): Promise<void> {
  const actionMap: Record<string, Record<string, AuditAction>> = {
    students: { created: 'student_created', updated: 'student_updated', deleted: 'student_deleted' },
    guardians: { created: 'guardian_created', updated: 'guardian_updated', deleted: 'guardian_deleted' },
    enrollments: { created: 'enrollment_created', updated: 'enrollment_updated', deleted: 'enrollment_cancelled' },
    payments: { created: 'payment_created', updated: 'payment_updated', deleted: 'payment_deleted' },
    leads: { created: 'lead_created', updated: 'lead_updated', deleted: 'lead_deleted' },
    courses: { created: 'course_created', updated: 'course_updated', deleted: 'course_deleted' },
    teachers: { created: 'teacher_created', updated: 'teacher_updated', deleted: 'teacher_deleted' },
  };
  
  const auditAction = actionMap[entityType]?.[action] || `${entityType}_${action}` as AuditAction;
  
  await logAudit({
    action: auditAction,
    tableName: entityType,
    recordId,
    oldData,
    newData,
  });
}

/**
 * Log settings change
 */
export async function logSettingsChange(
  settingKey: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  await logAudit({
    action: 'settings_updated',
    tableName: 'app_settings',
    metadata: { settingKey },
    oldData: { value: oldValue },
    newData: { value: newValue },
  });
}

/**
 * Log message sent
 */
export async function logMessageSent(
  recipientPhone: string,
  messageType: 'whatsapp' | 'email',
  isBulk: boolean = false
): Promise<void> {
  await logAudit({
    action: isBulk ? 'bulk_message_sent' : 'message_sent',
    metadata: { recipientPhone, messageType },
  });
}

/**
 * Log data export
 */
export async function logDataExport(
  tableName: string,
  recordCount: number,
  format: string
): Promise<void> {
  await logAudit({
    action: 'data_exported',
    tableName,
    metadata: { recordCount, format },
  });
}
