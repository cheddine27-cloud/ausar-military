import { useContext } from 'react';
import { PermissionContext } from './PermissionProvider';

/**
 * Custom hook to verify permissions for the currently authenticated admin.
 */
export default function usePermission() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
}
