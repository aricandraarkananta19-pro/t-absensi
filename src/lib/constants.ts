
// FR-01: Filter Role Wajib Absensi
// Global rule for roles that are required to clock in/out
export const ABSENSI_WAJIB_ROLE = ['karyawan', 'magang', 'pkwt'] as const;

// Users to exclude from reports and monitoring
export const EXCLUDED_USER_NAMES = ['Eko Winarni', 'Super Admin', 'Administrator', 'Admin', 'admin', 'Manager', 'manager'];
