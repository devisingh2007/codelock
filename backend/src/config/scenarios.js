"use strict";

/**
 * @module scenarios
 * Rich location-hint strings for each game scenario theme.
 * These are injected into the Ollama prompt as `locationHints`,
 * giving the AI a vivid, cinematic setting brief to work from.
 */

const SCENARIOS = {
  /**
   * Classic Mansion
   * A crumbling Victorian estate on a storm-lashed moor.
   */
  mansion: `The setting is Blackwood Hall, a sprawling 19th-century Victorian mansion perched on a fog-drenched moor in the English countryside. 
The manor's vast corridors are lined with oil portraits of disapproving ancestors, dusty weaponry collections, and locked trophy rooms smelling of pipe tobacco. 
A fierce thunderstorm has cut all telephone lines and washed out the bridge — nobody can leave until morning. 
The victim was the mansion's eccentric billionaire owner who summoned a select circle of old friends, estranged relatives, and business rivals for what he cryptically called "a reckoning weekend." 
Key rooms include: the oak-panelled Study where the will was about to be read, the Conservatory with its hidden passage behind the orchid wall, the Cellar housing a priceless wine collection — and a poison cabinet, the Billiards Room where the body was discovered face-down at midnight, and the Servants' Quarters rumoured to hold blackmail letters. 
Suspects should include people with strong financial or personal motives — a disinherited nephew, a scheming solicitor, a wronged business partner, a jealous second wife, a butler who knows every secret of the house, and a visiting celebrity author researching "the perfect crime."`,

  /**
   * Luxury Cruise
   * A murder at sea aboard a mega-yacht.
   */
  cruise: `The setting is the MV Obsidian Star, a 300-metre ultra-luxury ocean liner sailing a 7-day Mediterranean route from Monaco to Istanbul. 
The ship carries 48 ultra-wealthy passengers across 12 opulent decks featuring a casino, a Michelin-starred restaurant, a private art gallery with priceless works on loan, a rooftop helipad, and a vault storing guests' jewellery and classified documents. 
The victim is a globally notorious hedge-fund titan who has ruined fortunes and careers across three continents — and whose USB drive containing damning financial evidence was found clutched in his dead hand when his body was discovered floating in the indoor pool at 2 a.m. 
There is nowhere to run: the nearest port is six hours away, the satellite phones are jammed, and the ship's AI security system has been hacked to delete footage between 11 p.m. and 2 a.m. 
Key locations: the Vault (where classified documents were accessed), the Casino (where a heated argument erupted at 10 p.m.), the Engine Room (where a mysterious second key was found), the Art Gallery (where a priceless Klimt was quietly swapped for a forgery), and the Captain's Bridge (where the ship's log was tampered with). 
Suspects should include: a disgraced former senator seeking leverage, a celebrated art forger, an Interpol agent travelling undercover, the hedge-fund's own CFO about to be framed for embezzlement, the victim's trophy spouse with a hidden past, and a charismatic casino dealer who wins every hand.`,

  /**
   * Space Station
   * Zero-gravity murder on an orbital research platform.
   */
  space: `The setting is Helix Station Omega, a multinational deep-space research platform orbiting Earth at 450 km altitude, staffed by 8 elite specialists on a 90-day isolation mission. 
The station consists of six pressurised modules: the Command Hub with the only working comms array, the BioLab where classified genetic experiments are conducted, the Propulsion Bay containing the evacuation shuttle (now mysteriously sabotaged), the Cryogenic Storage Vault (access log wiped), the Observation Deck with panoramic Earth views — and the Airlock Chamber where the victim's body was found, partially depressurised and still in a pressure suit. 
The victim is the station's lead scientist who had just encrypted a file titled "COVER-UP_FINAL" before dying. 
Mission Control is 4.7 seconds signal-delayed and has declared a communications blackout pending "an internal security review." 
The murder weapon had to be something available on the station — a lethal dose from the pharmaceutical cabinet, a reprogrammed oxygen regulator, or a deliberately overheated thermal tile. 
Suspects: a corporate spy embedded as an engineer, a cosmonaut with a classified military directive, an AI systems technician who can rewrite the station's logs, a biologist whose research was plagiarised by the victim, a mission psychologist with access to every crew member's deepest secrets, and the station commander torn between duty and self-preservation.`,

  /**
   * Ancient Palace
   * Intrigue and murder in a royal court of antiquity.
   */
  palace: `The setting is the Grand Palace of Ashvapura, seat of a mighty dynasty in an ancient empire at the crossroads of the Silk Road — a sprawling complex of marble halls, terraced gardens, underground aqueducts, and hidden idol chambers. 
The victim is the court's beloved High Astronomer and Royal Adviser, found dead in the Celestial Chamber at dawn with a bronze ceremonial dagger through his star chart — and the Emperor's own seal-ring missing. 
The palace is sealed: the Emperor has proclaimed that until the murderer confesses, no one enters or leaves. Accusations could mean execution, so every courtier lies. 
Key locations include: the Throne Room (where a succession dispute erupted the previous night), the Poison Garden tended by the Royal Herbalist, the Treasury (showing signs of a quiet break-in), the Harem Quarters (containing a coded letter in an unknown cipher), the Weapons Forge (where a dagger matching the murder weapon was hastily recast), and the Tunnel of Ancestors — a secret passage only the High Astronomer knew about. 
Suspects: a power-hungry Grand Vizier coveting the Adviser's influence, a foreign ambassador seeking the stolen seal to forge a treaty, the Emperor's eldest son who feared the Adviser's prophecy, a rebellious court concubine who was secretly the Adviser's informant, the Royal Herbalist who supplies both medicine and poison, and a disgraced general seeking reinstatement through blackmail.`,

  /**
   * Cyber Crime
   * A tech-world murder inside a global hacker collective's nerve centre.
   */
  cyber: `The setting is the Glass Citadel — the ultra-secure headquarters of Nexus Corp, the world's most powerful technology conglomerate buried 40 floors below San Francisco, accessible only through biometric airlocks and a Faraday cage that blocks all wireless signals. 
The Citadel houses: Server Farm Zero (the world's most classified AI in active training), the Red Room (a SCIF where classified cyber-weapons are developed), the Boardroom (where a 4-billion-dollar acquisition was about to close), the Data Vault (now breached — 140 terabytes of data exfiltrated overnight), the Security Operations Centre (whose AI monitoring system reported "no anomalies"), and the Rooftop Lab (where the victim's encrypted laptop was found wiped, but with a hidden partition). 
The victim is Nexus Corp's legendary CTO and ethical hacker, found dead in Server Farm Zero with a brain aneurysm that toxicology later reveals was chemically induced — a nano-agent deliverable only via the coffee machine's water supply, which requires an executive keycard. 
The killer is someone inside the building during the 11 p.m. lockdown. All exits are sealed, all keycards logged. 
Suspects: a ruthless CEO who stands to gain 2 billion from the acquisition, a rogue government intelligence asset embedded in the security team, a whistleblower journalist who smuggled in a recording device, a competing tech founder whose algorithm was stolen by the victim, the Head of Legal who discovered the victim was about to expose the board, and a gifted programmer-for-hire with no verified identity.`,

  /**
   * Hotel Murder
   * A glittering death at the world's most exclusive hotel.
   */
  hotel: `The setting is The Obsidian Grand — the world's most exclusive and secretive private hotel, buried inside a heritage skyscraper in central Paris. 
It has only 12 suites, no public listing, no walk-in guests, and a strict no-photography policy enforced by staff under NDA. Every guest is powerful, famous, or dangerous — often all three. 
The victim is found in Suite 7 — the so-called "Ghost Suite" where no cameras operate and the walls are soundproofed — strangled at 3 a.m. 
The victim is a world-famous criminal defence attorney whose client list includes arms dealers, heads of state, and one sitting Supreme Court justice. 
His briefcase is missing. His private phone was destroyed. And the hotel's legendary concierge swears nothing unusual happened. 
Key locations: the Jazz Bar (where the victim had a 30-minute argument with an unknown figure at midnight), the Kitchen (where a second victim — a chef — was found unconscious), the Penthouse Atelier (rented by a reclusive artist whose paintings depict impossible future crimes), the Loading Dock (where a mysterious black van idled from 1 a.m. to 4 a.m.), and the famous Red Corridor (the hotel's private gallery connecting all suites, where a bloody handprint points toward Suite 12). 
Suspects: a rival attorney with access to the client list, a former client seeking to silence testimony, an off-duty detective staying in Suite 3 for reasons she won't reveal, the hotel's stoic Head of Security with a military intelligence background, a socialite heiress who was the last person seen with the victim, and the night-shift concierge who has worked every shift for 30 years and knows every secret the hotel holds.`,
};

/**
 * Returns the full location-hints string for a given scenario key.
 * Falls back to a generic mansion setting if the key is unknown.
 *
 * @param {string} scenarioKey - One of: mansion, cruise, space, palace, cyber, hotel
 * @returns {string}
 */
function getLocationHints(scenarioKey) {
  return SCENARIOS[scenarioKey] || SCENARIOS.mansion;
}

module.exports = { SCENARIOS, getLocationHints };
