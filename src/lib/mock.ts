import type { QualitativeOut } from "./llm";

// Used when no LLM key is set, so the report reads naturally during UI testing.
export function mockQualitative(suburb: string): QualitativeOut {
  return {
    ownerOccupierProsCons: {
      pros: [
        `Walkable to two stations and a shopping precinct in ${suburb}`,
        "Well-regarded schools within or adjacent to the catchment",
        "Period home on a regular, usable block",
      ],
      cons: [
        "A minor arterial road on the eastern boundary may add traffic noise",
        "Older dwelling — budget for maintenance and energy upgrades",
      ],
    },
    ownerOccupierNarrative:
      `For owner-occupiers, this is a livability-first option: strong school access, ` +
      `genuine walkability and good transport. The main trade-off is road noise on one ` +
      `boundary and the upkeep that comes with an older home — worth checking at inspection.`,
    investorNarrative:
      `As an investment, the appeal is the land component and a steady rental market rather ` +
      `than a standout yield. The suburb's median has compounded at a healthy rate, but ` +
      `holding costs at current rates mean it runs negatively geared in the early years.`,
    planningPlainEnglish:
      `Sits in a standard residential zone. An easement is flagged on title — confirm its ` +
      `location before assuming any extension or second-dwelling footprint, as you generally ` +
      `can't build over it without the asset owner's consent.`,
    secondDwellingSummary:
      `Land size suggests a second dwelling could be physically possible, but rules vary by ` +
      `state and council (setbacks, overlays, the easement above). Treat as a possibility to ` +
      `verify locally, not a given.`,
    crimeRateSummary:
      `Public data indicates broadly typical metropolitan rates for the area; no notable ` +
      `outliers surfaced in the research.`,
  };
}
