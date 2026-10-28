// Alle spelregels op één plek. Waarden zijn per spelminuut tenzij anders vermeld.
// Komt één-op-één overeen met GAME_DESIGN.md §5.

export const RULES = {
  start: {
    hunger: [0, 35] as const,
    toilet: [0, 30] as const,
    energy: [60, 100] as const,
    satisfaction: 50,
  },
  rates: {
    hunger: 0.35,
    toilet: 0.45,
    energyWalking: -0.35,
    energyWatching: -0.25,
    energyQueuing: -0.15,
    energySeated: 4,
    energyStandingRest: 0.5,
  },
  thresholds: {
    hunger: 65,
    toilet: 70,
    energy: 30,
  },
  critical: {
    hunger: 90,
    toilet: 90,
    energy: 10,
  },
  satisfaction: {
    watchMatchPerPopularity: 0.035,
    watchOtherPerPopularity: 0.012,
    queuing: -0.25,
    criticalHunger: -0.4,
    criticalToilet: -0.5,
    criticalEnergy: -0.3,
    noReachableGoal: -0.3,
    seated: 0.1,
    servedFood: 6,
    servedToilet: 3,
    abandonQueue: -8,
    seatingFull: -3,
    leaveEarlyBelow: 15,
  },
  movement: {
    /** Tegels per spelminuut */
    pathSpeed: 3,
    grassSpeed: 2,
  },
  choice: {
    otherGenreFactor: 0.4,
    noise: 0.25,
    distancePenalty: 0.004,
    /** Kijkers blijven staan als binnen zoveel minuten een nieuwe act begint. */
    upcomingWithinMinutes: 10,
    wanderPathPreference: 0.7,
    wanderRestMinutes: [3, 8] as const,
  },
  queue: {
    maxWaitMinutes: 20,
    avoidMinutes: 15,
  },
  seating: {
    restUntilEnergy: 85,
    maxRestMinutes: 20,
  },
} as const;
