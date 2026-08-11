export const PARENT_HOME_ROUTE = '/parent/home' as const;
export const TOY_LIBRARY_ROUTE = '/parent/toy-library' as const;
export const BULK_TOY_INTAKE_ROUTE = '/parent/add-toy?mode=bulk' as const;
export const LOCATIONS_ROUTE = '/parent/locations' as const;
export const SETTINGS_ROUTE = '/parent/settings' as const;
export const CHILDREN_ROUTE = '/parent/children' as const;
export const TOY_DETAIL_ROUTE = '/parent/toy-detail' as const;
export const ACCOUNT_ROUTE = '/parent/account' as const;

export const parentBackTargets = {
  toyLibrary: PARENT_HOME_ROUTE,
  addToy: TOY_LIBRARY_ROUTE,
  editToy: TOY_LIBRARY_ROUTE,
  locations: PARENT_HOME_ROUTE,
  addLocation: LOCATIONS_ROUTE,
  editLocation: LOCATIONS_ROUTE,
  settings: PARENT_HOME_ROUTE,
  children: SETTINGS_ROUTE,
  editChild: CHILDREN_ROUTE,
  account: PARENT_HOME_ROUTE,
} as const;

export type ParentBackTarget = typeof parentBackTargets[keyof typeof parentBackTargets];
