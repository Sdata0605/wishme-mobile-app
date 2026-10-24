import type { CouncilEngine } from './engine';

/**
 * The room being set up or running. The setup screen builds the engine and the room screen takes it over, so a plan with
 * its live connections never has to travel through route params. Opening a new room closes the old one.
 */
let current: CouncilEngine | null = null;

export function setCurrentCouncil(engine: CouncilEngine | null) {
  if (current && current !== engine) current.stop();
  current = engine;
}

export function getCurrentCouncil(): CouncilEngine | null {
  return current;
}
