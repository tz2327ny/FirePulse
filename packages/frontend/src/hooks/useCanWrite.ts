import { useAuth } from '../context/AuthContext.js';

/**
 * Role-based permission hook.
 *
 * Medical: read-only on Sessions, Participants, Classes, Devices, Receivers.
 *          Full access to Rehab.
 * Instructor: full CRUD on Sessions, Participants, Classes, Devices, Receivers.
 *             Can send to rehab, but cannot access the Rehab management page.
 * Admin: full access to everything.
 */
export function useCanWrite() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    /** Can create/edit/delete sessions, change session state */
    canWriteSessions: role === 'admin' || role === 'instructor',
    /** Can create/edit/archive participants */
    canWriteParticipants: role === 'admin' || role === 'instructor',
    /** Can create/edit/archive classes and manage rosters */
    canWriteClasses: role === 'admin' || role === 'instructor',
    /** Can assign/unassign/ignore/archive devices */
    canWriteDevices: role === 'admin' || role === 'instructor',
    /** Can update receiver name/location */
    canWriteReceivers: role === 'admin' || role === 'instructor',
    /** Can access the Rehab management page (view/checkpoints/close visits) */
    canAccessRehab: role === 'admin' || role === 'medical',
    /** Can send participants to rehab (create visit — all roles) */
    canSendToRehab: role === 'admin' || role === 'instructor' || role === 'medical',
    /** Is admin */
    isAdmin: role === 'admin',
  };
}
