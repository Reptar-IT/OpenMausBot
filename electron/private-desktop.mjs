export function remotePlaceAllowed(entry, managedServicesEnabled) {
  return managedServicesEnabled || !(entry?.cloud || entry?.team || entry?.home);
}

export function privateBootEnvironment(state, managedServicesEnabled, localId) {
  const active = state.environments.find(entry => entry.id === state.activeId);
  return remotePlaceAllowed(active, managedServicesEnabled) ? state : { ...state, activeId: localId };
}

export function privateCompanionRoutes(routes, managedServicesEnabled) {
  return managedServicesEnabled ? routes : routes.filter(route => route === "wifi");
}
