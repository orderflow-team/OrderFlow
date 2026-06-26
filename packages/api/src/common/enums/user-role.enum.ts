export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALESMAN = 'salesman',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  KITCHEN_STAFF = 'kitchen_staff',
  DELIVERY_PERSON = 'delivery_person',
  ACCOUNTANT = 'accountant',
}

export const ALL_ROLES = Object.values(UserRole);
