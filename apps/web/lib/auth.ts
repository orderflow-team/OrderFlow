export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  businessId: string | null;
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: CurrentUser) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function hasRole(...roles: string[]): boolean {
  const user = getCurrentUser();
  if (!user?.role) return false;
  return roles.includes(user.role);
}

/**
 * Restricted-role users (staff logins) log into the SAME business as the
 * owner and never pick between businesses they own — skip /select-business
 * and land straight on the one page they're allowed to see.
 */
export function getPostLoginPath(role: string | null | undefined): string {
  if (role === 'salesman') return '/dashboard';
  if (role === 'kitchen_staff') return '/restaurant';
  if (role === 'manager') return '/dashboard';
  if (role === 'cashier') return '/billing';
  if (role === 'waiter') return '/restaurant';
  if (role === 'accountant') return '/reports';
  if (role === 'delivery_person') return '/orders';
  return '/select-business';
}

/**
 * Caches the business category locally (keyed by businessId) so the nav
 * doesn't need to refetch it on every page load. Cleared automatically
 * whenever the cached businessId no longer matches.
 */
export function getCachedBusinessCategory(businessId: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('business_category');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { businessId: string; category: string | null };
    return parsed.businessId === businessId ? parsed.category : null;
  } catch {
    return null;
  }
}

export function setCachedBusinessCategory(businessId: string, category: string | null) {
  localStorage.setItem('business_category', JSON.stringify({ businessId, category }));
}

/** Same businessId-keyed caching as the category above, for the independent inventory-module toggle. */
export function getCachedInventoryEnabled(businessId: string): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('business_inventory_enabled');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { businessId: string; inventoryEnabled: boolean };
    return parsed.businessId === businessId ? parsed.inventoryEnabled : null;
  } catch {
    return null;
  }
}

export function setCachedInventoryEnabled(businessId: string, inventoryEnabled: boolean) {
  localStorage.setItem('business_inventory_enabled', JSON.stringify({ businessId, inventoryEnabled }));
}

/** Same businessId-keyed caching for the independent AI chat assistant toggle. */
export function getCachedChatEnabled(businessId: string): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('business_chat_enabled');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { businessId: string; chatEnabled: boolean };
    return parsed.businessId === businessId ? parsed.chatEnabled : null;
  } catch {
    return null;
  }
}

export function setCachedChatEnabled(businessId: string, chatEnabled: boolean) {
  localStorage.setItem('business_chat_enabled', JSON.stringify({ businessId, chatEnabled }));
}
