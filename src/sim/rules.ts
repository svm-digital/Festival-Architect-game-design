// Alle spelregels op één plek. Waarden zijn per spelminuut tenzij anders vermeld.
// Komt één-op-één overeen met GAME_DESIGN.md §5–§7.

export const RULES = {
  start: {
    hunger: [0, 35] as const,
    thirst: [0, 30] as const,
    toilet: [0, 30] as const,
    energy: [60, 100] as const,
    satisfaction: 50,
  },
  rates: {
    hunger: 0.35,
    thirst: 0.6,
    toilet: 0.45,
    energyWalking: -0.35,
    energyWatching: -0.25,
    energyQueuing: -0.15,
    energySeated: 4,
    energyStandingRest: 0.5,
  },
  thresholds: {
    hunger: 65,
    thirst: 55,
    toilet: 70,
    energy: 30,
  },
  critical: {
    hunger: 90,
    thirst: 90,
    toilet: 90,
    energy: 10,
  },
  satisfaction: {
    watchMatchPerPopularity: 0.035,
    watchOtherPerPopularity: 0.012,
    queuing: -0.25,
    criticalHunger: -0.4,
    criticalThirst: -0.4,
    criticalToilet: -0.5,
    criticalEnergy: -0.3,
    noReachableGoal: -0.3,
    seated: 0.1,
    servedFood: 6,
    servedDrink: 3,
    servedToilet: 3,
    boughtMerch: 4,
    abandonQueue: -8,
    seatingFull: -3,
    leaveEarlyBelow: 15,
  },
  movement: {
    /** Tegels per spelminuut */
    pathSpeed: 3,
    grassSpeed: 2,
    staffSpeed: 4,
  },
  choice: {
    otherGenreFactor: 0.4,
    noise: 0.25,
    distancePenalty: 0.004,
    /** Kijkers blijven staan als binnen zoveel minuten een nieuwe act begint. */
    upcomingWithinMinutes: 10,
    wanderPathPreference: 0.7,
    wanderRestMinutes: [3, 8] as const,
    /** Kans op een merchandiseaankoop bij een vrij beslismoment (één keer per bezoeker). */
    merchChance: 0.35,
    merchMinSatisfaction: 55,
  },
  queue: {
    maxWaitMinutes: 20,
    avoidMinutes: 15,
  },
  seating: {
    restUntilEnergy: 85,
    maxRestMinutes: 20,
  },
  /**
   * Incidenten zijn een fictieve spelmechaniek. Kansen per bezoeker per spelminuut.
   * Ze zeggen niets over echte evenementen.
   */
  incidents: {
    medical: { base: 0.0003, lowEnergy: 0.002, lowEnergyBelow: 15, highThirst: 0.001, highThirstAbove: 90 },
    conflict: { base: 0.0002, lowSatisfaction: 0.0015, lowSatisfactionBelow: 30, longQueue: 0.001, longQueueMinutes: 10 },
    wellbeing: { base: 0.0003, lowEnergy: 0.0006, lowEnergyBelow: 25, lowSatisfaction: 0.0006, lowSatisfactionBelow: 35 },
    handlingMinutes: { medical: 6, conflict: 4, wellbeing: 8 },
    /** Zonder bereikbare post lost een incident na deze tijd vanzelf op, als 'niet geholpen'. */
    noPostGiveUpMinutes: 10,
    /** Met posten maar zonder vrije medewerker: opgegeven na deze wachttijd. */
    maxWaitMinutes: 20,
    satisfaction: { fastWithin: 5, fast: 2, okWithin: 10, ok: -3, slow: -8, unhandled: -15 },
    medicalEnergyAfter: 50,
  },
} as const;
