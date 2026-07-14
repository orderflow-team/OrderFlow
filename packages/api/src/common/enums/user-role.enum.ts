export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALESMAN = 'salesman',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  KITCHEN_STAFF = 'kitchen_staff',
  DELIVERY_PERSON = 'delivery_person',
  ACCOUNTANT = 'accountant',
  /** Anonymous self-service customer (table QR / takeaway link) — never assigned to a real login. */
  GUEST = 'guest',
}

export const ALL_ROLES = Object.values(UserRole);
