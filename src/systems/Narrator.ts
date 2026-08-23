const ROAST_LINES = {
  intro: [
    "Right then. Let's see what fresh hell the previous tenants left. Spoiler: it's not good.",
    "Ah, another 'fixer-upper.' Estate agent speak for 'biohazard with a mortgage.'",
    "You bought this? Willingly? With *money*? Bless your optimistic heart.",
    "Look at the state of it. And they said the housing market was competitive.",
    "Right. Roll your sleeves up. This isn't going to clean itself, unfortunately.",
  ],
  stainFound: [
    "Oh *lovely*. What even *is* that? Don't answer. I don't want to know.",
    "Right. That's... that's concerning. That's a concerning stain.",
    "I've seen crime scenes with less biological evidence.",
    "That's not a stain, that's a *lifestyle choice*.",
    "Great. Just great. You've found the 'mystery residue' collection.",
  ],
  trashFound: [
    "A pizza box from 'Tony's Authentic Italian' — mate, Tony's a lie, the box is the most authentic thing here.",
    "Beer cans. Classy. Very 'university halls, second year, giving up on dreams.'",
    "A takeaway bag. 'Golden Dragon.' The only thing golden about this place is the layer of grease on everything.",
    "Oh, *that* wrapper. Right. Moving on. Quickly. Before I lose my lunch.",
    "Tissues. So many tissues. What were they *doing* in here? Don't tell me.",
    "A magazine from 2019. 'Heatwave Special.' The only thing hot in this house was the damp.",
    "A single sock. Just the one. The eternal mystery. Where's its mate? Probably smarter, left early.",
  ],
  cleaningWell: [
    "Alright, alright. You're actually *doing* it. Colour me surprised.",
    "Look at that. Elbow grease. Who knew you had it in you?",
    "Not terrible. Not terrible at all. Don't let it go to your head.",
    "Right, that bit's clean. Only... *gestures vaguely* ...all the rest of it to go.",
    "Steady progress. Like watching paint dry, but with more satisfaction.",
  ],
  cleaningPoorly: [
    "You've missed a bit. There. And there. And... oh for fuck's sake, *there*.",
    "My nan cleans better than this. She's been dead since '98.",
    "You're just pushing the dirt around, aren't you? You're *smearing* it. That's worse.",
    "Right, stop. Put the mop down. Let a professional... no, wait, there *is* no professional. It's just you.",
    "You call that clean? I've seen cleaner floors in a butcher's freezer.",
  ],
  jobComplete: {
    perfect: [
      "Right. *That* is clean. Proper clean. You could perform surgery on that floor.",
      "One hundred percent. Flawless. I'm genuinely impressed. Don't tell anyone I said that.",
      "Spotless. Immaculate. The previous tenants' sins have been *erased*.",
      "Look at it. Gleaming. You've done a proper job there. Proper.",
    ],
    good: [
      "Not bad. Not bad at all. Few smudges here and there but... solid effort.",
      "Respectable. Your mum would be proud. Or at least not disappointed.",
      "Good job. Could eat your dinner off that floor. *Please don't*.",
      "Solid eight out of ten. The two points lost are for that bit you missed behind the door. I saw it.",
    ],
    average: [
      "Right. It's... *fine*. It's fine. 'Adequate.' That's the word. Adequate.",
      "You've done the bare minimum. The absolute bare minimum. Gold star for participation.",
      "Look, it's better than it *was*. That's the bar we're clearing today. 'Better than before.'",
      "Acceptable. In the same way a lukewarm pint is 'acceptable.' You drink it, but you're not happy.",
    ],
    poor: [
      "Oh *come on*. You've made a right pig's ear of that, haven't you?",
      "Congratulations. You've turned 'biohazard' into 'moderately concerning.' Have a biscuit.",
      "Right. So you've *technically* cleaned. In the same way a toddler 'technically' helps.",
      "I've seen more thorough cleaning from a Roomba with a flat battery.",
      "That's it? That's the effort? Right. Well. The budget reflects it. Don't say I didn't warn you.",
    ],
  },
  shop: {
    enter: [
      "Right then. Shop's open. Spend wisely. Or don't, it's your money you half-arsed for.",
      "Welcome to the showroom. Try not to get fingerprints on everything. *You just cleaned.*",
      "Alright, have a browse. Remember: taste is subjective, but *budget* is very objective.",
    ],
    cantAfford: [
      "Nice taste. Shame about the wallet. Come back when you've actually scrubbed a toilet.",
      "Can't afford it? Funny how that works. Almost like cleaning *better* pays *better*.",
      "Eyes bigger than your budget, mate. Happens to the best of us. Usually the ones who missed the skirting boards.",
    ],
    purchase: [
      "Excellent choice. That'll look *mint* in the corner. Assuming you place it straight.",
      "Solid pick. Your nan would approve. *This* nan. The alive one with standards.",
      "Good eye. That's a proper piece of kit. Don't scratch it moving it in.",
      "Lovely. Now go on, find a spot for it. And for god's sake use a tape measure.",
    ],
  },
  furniture: {
    place: [
      "Right there? Bold choice. *Bold.* I respect the confidence.",
      "Placed. Looks... intentional. That's the word. *Intentional.*",
      "There. Done. Stand back. Admire your handiwork. *You did that.*",
      "Nailed it. Literally, if you bought the shelf. Which you should. Use the wall plugs.",
    ],
    rotate: [
      "Bit to the left... bit to the right... *there*. Feng shui'd it.",
      "Turn it round. Yeah. That's the angle. The *money* angle.",
    ],
  },
  idle: [
    "Going to stand there all day? The dust isn't going to hoover itself.",
    "Clock's ticking. Every second you stand there, another cobweb forms.",
    "Right. Hands on hips, tutting at the wall isn't a cleaning technique.",
    "You know the mop works better when it *touches the floor*, yeah?",
  ],

  // ============================================
  // NEW CATEGORIES - DRIVING
  // ============================================
  driving: {
    general: [
      "Right then. Indicators are not optional. They're the little stalk by the wheel. USE IT.",
      "Lovely driving. My nan drives better. She's been dead since '98.",
      "You're weaving like a pub crawl. Pick a lane. Stay in it.",
      "Roundabout coming up. Mirror, signal, manoeuvre. Not 'close eyes and hope'.",
      "That's the brake pedal. Left one. *Left*. The other one makes you go faster. You don't want that right now.",
      "Smooth. Smooth is fast. Fast and smooth is... actually that's just dangerous. Be smooth.",
      "You're riding the clutch. Stop it. That's how you buy me a new clutch. With *your* money.",
      "Hand on the wheel. Both hands. Not one hand, not your knee, not the gearstick. THE WHEEL.",
      "That corner had a speed advisory for a reason. The reason is physics. Physics always wins.",
      "Lovely late apex. Shame about the oncoming traffic. And the hedge. And the bin.",
    ],
    speeding: [
      "Easy there, Hamilton. This is a housing estate, not Silverstone.",
      "Thirty means thirty. Not 'thirty-ish if nobody's looking.'",
      "Speed camera. *Flash*. There goes your profit margin for the week.",
      "You're doing forty in a thirty past a school. During pickup. *During pickup.*",
      "National limit doesn't mean 'flat out.' It means 'don't be a weapon.'",
    ],
    cornering: [
      "Brake *before* the corner. Not in it. Not after it. BEFORE.",
      "Trail braking. Heard of it? No? Brake. Turn. Accelerate. In that order.",
      "You've got more lean than a Tower of Pisa tribute act.",
      "Understeer. The car's saying 'no.' Listen to it.",
      "Oversteer. The back's stepping out. Counter-steer. *Now.* Good. Lucky.",
    ],
    parking: [
      "Parallel park. One move. Go on. Everyone's watching. *Everyone.*",
      "That's... that's two spaces. You've parked in two spaces. In a car park. With spaces.",
      "Reversing in. Sensors beeping. That's the car begging you to stop.",
      "Parked. Eventually. Three-point turn? More like seventeen-point pirouette.",
    ],
    gearChanges: [
      "Change gear. The engine's screaming. It's not a jet turbine.",
      "Short-shifting. Fuel economy. Your wallet thanks you.",
      "Money shift. *Money shift.* You nearly bought a new engine. With your face.",
      "Block change. Fifth to second. Smooth. *That's* how you do it.",
    ],
  },

  // ============================================
  // NEW CATEGORIES - CAR REPAIR
  // ============================================
  carRepair: {
    general: [
      "Right. Engine's making a noise like a dying badger. That's not normal.",
      "You've got the mechanical sympathy of a brick. Gentle. GENTLE.",
      "Oil light's on. Has been for three jobs. *Three.*",
      "Brakes squealing. That's the sound of 'I can't afford new pads.' Get them done.",
      "Right then. Bonnet up. Let's see what fresh hell we're dealing with.",
      "That's not a rattle. That's a cry for help. From the car. Which you're ignoring.",
      "Blue smoke. Burning oil. Your rings are gone, mate. Or the turbo. Either way: money.",
      "White smoke. Sweet smell. Head gasket. *Head gasket.* That's a grand minimum.",
      "Black smoke. Running rich. Injector stuck open. Or map sensor. Or you've messed with the tune.",
      "Knocking from the bottom end. Big ends. That's engine-out time. Sorry.",
      "Tappety top end. Valve clearances. Or worn cam. Or you've not changed oil in... ever.",
      "Whistle on boost. Turbo seals. Or boost leak. Spray soapy water, watch for bubbles.",
      "Clutch biting point at the top. Slipping. Smells like a burning hair salon in here.",
      "Gearbox whine. Lay shaft bearings. Or diff. Drain the oil, look for glitter. *Glitter is bad.*",
      "Steering vague. Rack wear. Or track rods. Or you've hit a kerb. *Recently.*",
      "Suspension knock. Drop links. ARB bushes. Wishbones. Ball joints. Pick one. Or all of them.",
      "Pulling left. Alignment. Or stuck caliper. Or knackered tyre. Or bent subframe. Good luck.",
      "Vibration at speed. Wheels balanced? Driveshaft? CV joint? Warped disc? *All of the above?*",
    ],
    diagnosis: [
      "OBD scanner. Plug it in. Read the codes. *Read them.* Don't just clear them.",
      "P0300. Random misfire. Could be anything. Coils, plugs, injectors, compression, vacuum leak...",
      "P0420. Cat efficiency. Usually the cat. Sometimes the rear O2. Sometimes you've decatted it.",
      "P0171. Lean. Vacuum leak. MAF. Fuel pressure. Injectors. *Start cheap.*",
      "P0172. Rich. MAF. Injector leaking. Fuel pressure regulator. Map sensor.",
      "P0500. Speed sensor. ABS ring. Wiring. Gearbox output sensor.",
      "P0700. Gearbox fault. Could be anything. Solenoids. Valve body. TCU. *Expensive.*",
      "Live data. Watch the numbers. Fuel trims. O2 switching. MAF grams per second. *Think.*",
      "Fuel trim +25%. Massive vacuum leak. Or MAF lying. Or exhaust leak before sensor.",
      "Long term fuel trim negative. Engine's learning it's rich. Why? Find it.",
      "O2 sensor flatlining. Dead sensor. Or cat's dead. Or you've got a leak.",
      "Boost pressure: requested 1.2 bar, actual 0.6. Wastegate stuck. Or actuator. Or pipe split.",
      "Injection duration at idle: 2.5ms. Normal's 1.8. Something's making it rich.",
      "Rail pressure: 400 bar requested, 280 actual. High pressure pump. Or injector leak-off.",
      "Compression test. 150, 155, 145, 30. *Thirty.* Cylinder four's had it. Valve? Ring? Hole in piston?",
      "Leak down test. Air from exhaust? Exhaust valve. Intake? Inlet valve. Sump? Rings. Radiator? Head gasket.",
      "Borescope time. Look in the cylinders. Scoring? Pitting? Carbon? *Mayonnaise on the piston crown?*",
    ],
    repair: [
      "Right. Torque wrench. *Use it.* 'Good and tight' is not a torque setting.",
      "That bolt's stripped. Helicoil time. Or timesert. Or new block. *New block.*",
      "Penetrating oil. Heat. Shock. Wait. Repeat. *Patience.* Force snaps bolts.",
      "Spring compressors. Screw type. Not the claw things. Your face depends on this.",
      "Ball joint separator. Scissor type. Hammer on the *arm*, not the joint. *Not the joint.*",
      "Brake caliper. Wind back the piston. *Wind.* Don't push. You'll knacker the seals.",
      "Brake bleed. Pressure bleeder. One man. Clean fluid. *Clean fluid.* Old fluid is water.",
      "Oil filter. Strap wrench. Cap wrench. Don't crush the can. Pre-fill it. *Pre-fill it.*",
      "Sump plug. New washer. Copper or fibre. Torque to spec. *Torque to spec.*",
      "Timing belt. Lock the cams. Lock the crank. *Check the marks.* Turn twice. Check again.",
      "Water pump. Driven by timing belt? *Change the belt.* False economy otherwise.",
      "Clutch. Alignment tool. *Use it.* Grease the splines. *Lightly.* Don't get it on the friction plate.",
      "Gearbox oil. Correct grade. Correct amount. *Correct amount.* Overfill = seals blow.",
      "Diff oil. LSD? Friction modifier. *Friction modifier.* Otherwise it chatters.",
      "Coolant. Fifty-fifty mix. Distilled water. *Distilled.* Burp the system. *Burp it.*",
      "Exhaust. New gaskets. Copper slip on the bolts. *Copper slip.* Otherwise they weld.",
      "Tyres. Correct pressure. *Cold.* Check the spare. *Check the spare.* Tread depth. Legal limit's 1.6. *Change at 3.*",
    ],
    quality: [
      "Bodged it. You've bodged it. That'll last... until it doesn't. Probably on the motorway.",
      "Right. That's *proper* fixed. Clean surfaces. New bolts. Torqued. Sealed. *Tested.*",
      "Gaffer tape. On a brake line. *On a brake line.* I'm calling the police.",
      "Jubilee clip on a fuel hose. *Jubilee clip.* High pressure. Petrol. *Petrol.*",
      "Self-tapper into plastic. *Self-tapper into plastic.* That'll hold. For about three miles.",
      "RTV everywhere. *Everywhere.* It's sealant, not adhesive. Thin bead. *Thin bead.*",
      "Cross-threaded the spark plug. *Cross-threaded.* Helicoil. Now. Before you strip the head.",
      "Forgot the O-ring. *Forgot the O-ring.* It's leaking already. I can hear it dripping.",
      "Reused the stretch bolt. *Reused the stretch bolt.* It's yielded. It'll snap. *It'll snap.*",
      "Didn't clean the mating face. *Didn't clean.* Gasket won't seal. Do it again. *Properly.*",
    ],
  },

  // ============================================
  // NEW CATEGORIES - BREAKDOWN
  // ============================================
  breakdown: {
    general: [
      "And there she goes. Steam everywhere. Right. Who do we call?",
      "Broken down. Again. Maybe walk next time? Builds character.",
      "Recovery truck's coming. Forty minutes. Sit tight. Don't touch anything.",
      "Right. Hazards on. Triangle out. *Behind* the car. Not on the roof.",
      "Engine's stopped. Just... stopped. No warning. No noise. Just... silence.",
      "Temperature gauge buried. Steam from the bonnet. *Don't open the cap.*",
      "Oil light came on, you ignored it, now the bottom end's singing. *Singing loudly.*",
      "Alternator's gone. Battery's flat. You've got... twenty minutes of electrics. *Max.*",
      "Fuel pump's died. Silent killer. No warning. Just cuts out. *Restart? No.*",
      "Cambelt's snapped. Interference engine. *Valves meet pistons.* That's a head off job.",
      "Turbo's grenaded. Oil smoke like a fog machine. *Don't restart it.* You'll hydrolock it.",
      "Driveshaft's let go. Bang. Clunk. Free-wheeling. *Recovery truck time.*",
      "Brake line's burst. Pedal to the floor. Handbrake. *Handbrake now.* Downshift. *Engine brake.*",
      "Ball joint separated. Wheel's folded under. *Don't drive it.* Recovery. Now.",
      "Electrical fire. Smell burning plastic. *Pull over. Get out. Call 999.*",
    ],
    roadside: [
      "Roadside repair. You've got what's in the boot. Jack. Wheel brace. *Maybe* a socket set.",
      "Changing a tyre in the rain. On the hard shoulder. *Lovely.* Hi-vis on. *On.*",
      "Jump leads. Red to red. Black to *earth point.* Not the battery. *Earth point.*",
      "Temporary tyre weld. Gets you home. *Ruins the tyre.* And the sensor. And the TPMS.",
      "Bodge the hose with tape. *Duct tape.* Coolant pressure. *It'll hold. For a bit.*",
      "Push start. Downhill. Second gear. Clutch out. *Pray.* Petrol only. *Diesel won't.*",
      "Recovery driver's here. He's seen it all. He's judging you. *He's definitely judging you.*",
      "Hard shoulder. Trucks thundering past. *Wind rock.* Keep the door shut. *Stay belted.*",
      "Smart motorway. No hard shoulder. *Emergency refuge area.* Three miles back. *Three miles.*",
      "Middle lane. Broken down. *Hazards. Out the passenger side. Up the bank. *Now.*",
    ],
    recovery: [
      "Flatbed or spec lift? *Flatbed.* Four wheels off. Safer. Especially if it's four-wheel drive.",
      "Tow rope. *Tow rope.* Three metres. Someone in the broken car. *On the brakes.*",
      "Dolly. Front wheels up. Rear on the ground. *Handbrake off. In neutral.*",
      "Recovery truck driver: 'Right mate, where to?' You: 'The garage.' Him: 'Which one?' You: *\"Uhh...\"*",
      "Cost. Base rate. Per mile. Wait time. *VAT.* You didn't ask. You never ask.",
      "Car's at the garage. They'll look at it Monday. *It's Friday.* Bank holiday weekend.",
      "Courtesy car. 1.0 litre. Three cylinders. *Sounds like a washing machine.* No radio.",
      "Insurance recovery. Free. *Excess applies.* Premium goes up. *Next year.*",
      "Manufacturer recovery. Warranty. *If it's covered.* 'Wear and tear' isn't covered. *Ever.*",
    ],
  },

  // ============================================
  // NEW CATEGORIES - NAVIGATION
  // ============================================
  navigation: {
    general: [
      "Sat nav says 'turn around when possible.' It's been saying that for ten miles.",
      "Right. House number 247. Looks like every other house. Good luck.",
      "You're in the posh bit now. Don't scratch the gate posts.",
      "Sat nav rerouting. *Again.* You missed the turn. *Three miles ago.*",
      "Road closed. Diversion. *Unsigned diversion.* Welcome to the back of beyond.",
      "Single track road. Passing places. *Use them.* Don't stop in the gateways.",
      "Ford. *Ford.* Water depth? Unknown. Current? Unknown. *Walk it first.*",
      "Gravel. Loose. Washboard. *Slow down.* Unless you like replacing windscreens.",
      "Mud. Deep mud. *Ground clearance.* You haven't got any. Not in that.",
      "Dead end. 'No through road.' Sat nav said 'shortcut.' *Sat nav lied.*",
      "Low bridge. Height limit. *You're in a van.* With a roof rack. *Measure it.*",
      "Weight limit. 7.5 tonnes. *You're over.* They weigh you. *They fine you.*",
      "Congestion. M25. *Parking lot.* Should've left earlier. *Should've taken the train.*",
      "Roadworks. Temp lights. *Red.* Three minutes. *Three minutes of your life.*",
      "Pothole. *Crater.* Dodged it. *Missed the next one.* Suspension's gone. *Alignment's gone.*",
      "Roundabout. Wrong lane. *Indicate left, go right.* Everyone hates you. *Everyone.*",
      "Mini roundabout. *Paint on the road.* Treat it like a big one. *Don't cut it.*",
      "Box junction. *Don't enter unless your exit's clear.* Camera. *Flash. Ticket. Points.*",
      "Bus lane. *Operational hours.* You're in it. *Camera. Ticket. Sixty quid.*",
      "Cycle lane. *Solid white line.* Don't cross it. *Don't park in it.* Cyclist's helmet cam. *You're on YouTube.*",
    ],
    jobNavigation: [
      "Job's in... *checks notes* ...Little Snoring. Norfolk. *Lovely name. Long drive.*",
      "Client said 'easy to find.' *They lied.* Down an unmarked track. Behind a farm.",
      "Postcode takes you to the farm. House is *half a mile* up the drive. *Half a mile.*",
      "New build estate. *Every house looks identical.* Number 42. *Or is it 24?*",
      "Block of flats. *No buzzer. No intercom.* Client's not answering. *Ring the neighbours.*",
      "Rural. No signal. *Sat nav needs data.* Download offline maps. *Before you leave.*",
      "City centre. *One way system. Bus gates. Clean air zone.* Pay the charge. *Pay the charge.*",
      "Industrial estate. *Unit 7. Or is it Unit 17?* They all look the same. *Grey boxes.*",
      "Country lane. *Hedges both sides.* Tractor coming. *Reverse. Half a mile. *Find a gateway.*",
      "Motorway services. *Expensive fuel. Expensive food. *Fill up before you leave.*",
    ],
  },

  // ============================================
  // NEW CATEGORIES - FUEL
  // ============================================
  fuel: {
    general: [
      "Fuel light. Again. How many times? Fill it up when you *see* the station.",
      "Ten miles left. Petrol station... there. No, gone. Next one... fifteen miles. *Brilliant.*",
      "Quarter tank. *That's not 'plenty.'* That's 'start looking.'",
      "You're doing forty to the gallon. *Driving like that.* Try fifty. *Light right foot.*",
      "Premium unleaded. In a 1.2 Corsa. *Waste of money.* Unless it's mapped. *Is it mapped?*",
      "Diesel. *Black pump.* Don't put petrol in it. *Don't.* Fifteen grand for a new pump.",
      "Petrol in a diesel. *Don't start it.* Don't turn the key. *Recovery. Drain. Flush. *Expensive.*",
      "E10. Your classic hates it. *Ethanol eats seals. Eats carbs. Eats fuel lines.* Super unleaded. *Super.*",
      "Fuel filter. *When did you change it?* Never? *Change it.* Before it blocks. *On the motorway.*",
      "Fuel pump. In the tank. *Runs cool in fuel.* Run it low? *Pump overheats. Dies. *Tank out job.*",
      "Injectors. Dirty. *Additive helps. Sometimes.* Ultrasonic clean. *Or replace. *Expensive.*",
      "MPG. Track it. *Trip computer lies.* Brim to brim. *Maths. Do the maths.*",
      "Range. 'Fifty miles.' *Fifty motorway miles.* Thirty town. *Twenty hooning.*",
      "Reserve. *There is no reserve.* The light *is* the reserve. *Fill up.*",
      "Jerry can. *In the boot.* Petrol fumes. *Ventilation. Metal can. *UN approved.*",
      "Wrong fuel. *Again.* Colour code. *Green petrol. Black diesel. *Look at the nozzle.*",
    ],
    stations: [
      "Motorway services. *£1.65 a litre. *Fill up before you join.*",
      "Supermarket. *Cheapest. *But queues. *And the pump's slow.*",
      "Independent. *Cash only. *Card machine 'broken.' *Cash.*",
      "24 hour. *Automated. *Card only. *Receipt? *Print it yourself.*",
      "Rural garage. *Pumps from the eighties. *Cash. *Chat to the owner. *Local gossip.*",
      "Electric charger. *Broken. *Occupied. *Wrong plug. *App won't work. *Phone signal?*",
      "Hydrogen. *One station. *M25. *Toyota Mirai only. *£80 a kilo.*",
      "LPG. *Autogas. *Half price. *Half mpg. *Tank takes boot space. *MOT includes tank test.*",
    ],
  },
}

export type NarratorCategory =
  | 'intro' | 'stainFound' | 'trashFound' | 'cleaningWell' | 'cleaningPoorly'
  | 'jobComplete' | 'shop' | 'furniture' | 'idle'
  | 'driving' | 'carRepair' | 'breakdown' | 'navigation' | 'fuel'

export type DrivingSubcategory = 'general' | 'speeding' | 'cornering' | 'parking' | 'gearChanges'
export type CarRepairSubcategory = 'general' | 'diagnosis' | 'repair' | 'quality'
export type BreakdownSubcategory = 'general' | 'roadside' | 'recovery'
export type NavigationSubcategory = 'general' | 'jobNavigation'
export type FuelSubcategory = 'general' | 'stations'

export interface NarratorContext {
  // Vehicle state
  vehicleHealth?: number // 0-100 overall
  subsystemHealth?: Record<string, number>
  fuelLevel?: number // 0-1
  fuelCapacity?: number
  speed?: number // m/s
  speedLimit?: number
  gear?: number
  rpm?: number
  redline?: number
  isCornering?: boolean
  lateralG?: number
  isParking?: boolean
  warningLights?: string[]

  // Location
  position?: { x: number; z: number }
  nearestTown?: string
  roadType?: 'motorway' | 'a_road' | 'b_road' | 'country_lane' | 'residential' | 'dirt'
  speedLimitZone?: number

  // Job
  hasActiveJob?: boolean
  jobDistance?: number
  jobDirection?: number // degrees from forward

  // Repair
  isInGarage?: boolean
  currentRepairTask?: string
  repairQuality?: number // 0-1

  // Breakdown
  hasBreakdown?: boolean
  breakdownSeverity?: 'minor' | 'major' | 'critical'
  breakdownSubsystem?: string
  recoveryETA?: number // minutes

  // Time
  timeOfDay?: number // 0-24
  weather?: 'clear' | 'rain' | 'fog' | 'snow'
}

export class Narrator {
  public onLine?: (line: string, category: string) => void

  private lastSpoken = 0
  private speakInterval = 12000 // ms between idle lines (longer when driving)
  private usedLines = new Map<string, Set<string>>()
  private lastCategory = ''
  private lineCooldowns = new Map<string, number>()

  // Context tracking
  private context: NarratorContext = {}
  private previousContext: NarratorContext = {}

  constructor() {
    // Initialize usedLines for all categories
    for (const key of Object.keys(ROAST_LINES)) {
      this.usedLines.set(key, new Set())
    }
  }

  update(delta: number, context?: Partial<NarratorContext>): void {
    // Update context
    if (context) {
      this.previousContext = { ...this.context }
      this.context = { ...this.context, ...context }
    }

    const now = performance.now()

    // Check for context-triggered lines
    this.checkContextTriggers()

    // Periodic idle chatter (less frequent when driving)
    const interval = this.context.speed && this.context.speed > 5 ? this.speakInterval * 2 : this.speakInterval
    if (now - this.lastSpoken > interval) {
      this.sayIdle()
      this.lastSpoken = now
    }
  }

  private checkContextTriggers(): void {
    const ctx = this.context
    const prev = this.previousContext

    // FUEL WARNINGS
    if (ctx.fuelLevel !== undefined && prev.fuelLevel !== undefined) {
      if (ctx.fuelLevel < 0.15 && prev.fuelLevel >= 0.15) {
        this.say('fuel', 'general')
      }
      if (ctx.fuelLevel < 0.05 && prev.fuelLevel >= 0.05) {
        this.say('fuel', 'general')
      }
    }

    // SPEEDING
    if (ctx.speed !== undefined && ctx.speedLimit !== undefined) {
      const speedMph = ctx.speed * 2.237
      if (speedMph > ctx.speedLimit * 1.15 && (!prev.speed || prev.speed * 2.237 <= ctx.speedLimit * 1.15)) {
        this.say('driving', 'speeding')
      }
    }

    // REDLINE / OVERREV
    if (ctx.rpm !== undefined && ctx.redline !== undefined) {
      if (ctx.rpm > ctx.redline * 0.95 && (!prev.rpm || prev.rpm <= ctx.redline * 0.95)) {
        this.say('driving', 'gearChanges')
      }
    }

    // HARD CORNERING
    if (ctx.lateralG !== undefined && ctx.lateralG > 0.8 && (!prev.lateralG || prev.lateralG <= 0.8)) {
      this.say('driving', 'cornering')
    }

    // WARNING LIGHTS
    if (ctx.warningLights && ctx.warningLights.length > 0) {
      const newLights = ctx.warningLights.filter(l => !prev.warningLights?.includes(l))
      if (newLights.length > 0) {
        this.say('carRepair', 'general')
      }
    }

    // VEHICLE HEALTH DETERIORATION
    if (ctx.vehicleHealth !== undefined && prev.vehicleHealth !== undefined) {
      if (ctx.vehicleHealth < 50 && prev.vehicleHealth >= 50) {
        this.say('carRepair', 'general')
      }
      if (ctx.vehicleHealth < 20 && prev.vehicleHealth >= 20) {
        this.say('breakdown', 'general')
      }
    }

    // BREAKDOWN
    if (ctx.hasBreakdown && !prev.hasBreakdown) {
      if (ctx.breakdownSeverity === 'critical') {
        this.say('breakdown', 'general')
      } else {
        this.say('breakdown', 'roadside')
      }
    }

    // RECOVERY ARRIVING
    if (ctx.recoveryETA !== undefined && prev.recoveryETA !== undefined) {
      if (ctx.recoveryETA <= 5 && prev.recoveryETA > 5) {
        this.say('breakdown', 'recovery')
      }
    }

    // ENTERING GARAGE
    if (ctx.isInGarage && !prev.isInGarage) {
      this.say('carRepair', 'general')
    }

    // REPAIR QUALITY
    if (ctx.repairQuality !== undefined && prev.repairQuality !== undefined) {
      if (ctx.repairQuality < 0.5 && prev.repairQuality >= 0.5) {
        this.say('carRepair', 'quality')
      } else if (ctx.repairQuality > 0.9 && prev.repairQuality <= 0.9) {
        this.say('carRepair', 'repair')
      }
    }

    // JOB NAVIGATION
    if (ctx.hasActiveJob && ctx.jobDistance !== undefined) {
      if (ctx.jobDistance < 500 && (!prev.jobDistance || prev.jobDistance >= 500)) {
        this.say('navigation', 'jobNavigation')
      }
    }

    // WRONG TURN / REROUTE
    // Would need navigation system integration
  }

  private say(category: string, subcategory: string): void {
    const cooldownKey = `${category}.${subcategory}`
    const now = performance.now()
    const lastTime = this.lineCooldowns.get(cooldownKey) || 0

    // Cooldown per subcategory (5 seconds)
    if (now - lastTime < 5000) return

    const lines = (ROAST_LINES as any)[category]?.[subcategory]
    if (!lines || !Array.isArray(lines)) return

    const line = this.getRandomLine(category, subcategory, lines)
    this.speak(line, `${category}.${subcategory}`)
    this.lineCooldowns.set(cooldownKey, now)
    this.lastCategory = category
  }

  private getRandomLine(category: string, subcategory: string, lines: string[]): string {
    const key = `${category}.${subcategory}`
    const used = this.usedLines.get(key) || new Set()
    const available = lines.filter(l => !used.has(l))
    const pool = available.length > 0 ? available : lines
    const line = pool[Math.floor(Math.random() * pool.length)]
    used.add(line)
    if (used.size > lines.length * 0.7) {
      used.clear()
    }
    this.usedLines.set(key, used)
    return line
  }

  private speak(line: string, category: string): void {
    this.onLine?.(line, category)
    this.lastSpoken = performance.now()
  }

  // ============================================
  // PUBLIC API - Original cleaning methods
  // ============================================
  sayIntro(): void { this.speak(this.getRandomLine('intro', '', ROAST_LINES.intro), 'intro') }
  sayStainFound(): void { this.speak(this.getRandomLine('stainFound', '', ROAST_LINES.stainFound), 'stainFound') }
  sayTrashFound(): void { this.speak(this.getRandomLine('trashFound', '', ROAST_LINES.trashFound), 'trashFound') }
  sayCleaningWell(): void { this.speak(this.getRandomLine('cleaningWell', '', ROAST_LINES.cleaningWell), 'cleaningWell') }
  sayCleaningPoorly(): void { this.speak(this.getRandomLine('cleaningPoorly', '', ROAST_LINES.cleaningPoorly), 'cleaningPoorly') }

  onJobComplete(score: number): void {
    let lines: string[]
    if (score >= 95) lines = ROAST_LINES.jobComplete.perfect
    else if (score >= 80) lines = ROAST_LINES.jobComplete.good
    else if (score >= 60) lines = ROAST_LINES.jobComplete.average
    else lines = ROAST_LINES.jobComplete.poor
    this.speak(this.getRandomLine('jobComplete', '', lines), 'jobComplete')
  }

  sayShopEnter(): void { this.speak(this.getRandomLine('shop', 'enter', ROAST_LINES.shop.enter), 'shop.enter') }
  sayCantAfford(): void { this.speak(this.getRandomLine('shop', 'cantAfford', ROAST_LINES.shop.cantAfford), 'shop.cantAfford') }
  sayPurchase(): void { this.speak(this.getRandomLine('shop', 'purchase', ROAST_LINES.shop.purchase), 'shop.purchase') }
  sayFurniturePlace(): void { this.speak(this.getRandomLine('furniture', 'place', ROAST_LINES.furniture.place), 'furniture.place') }
  sayFurnitureRotate(): void { this.speak(this.getRandomLine('furniture', 'rotate', ROAST_LINES.furniture.rotate), 'furniture.rotate') }

  sayIdle(): void {
    if (Math.random() < 0.25) {
      // Pick appropriate idle category based on context
      if (this.context.speed && this.context.speed > 5) {
        this.say('driving', 'general')
      } else if (this.context.isInGarage) {
        this.say('carRepair', 'general')
      } else if (this.context.hasBreakdown) {
        this.say('breakdown', 'general')
      } else if (this.context.fuelLevel !== undefined && this.context.fuelLevel < 0.2) {
        this.say('fuel', 'general')
      } else {
        this.speak(this.getRandomLine('idle', '', ROAST_LINES.idle), 'idle')
      }
    }
  }

  onStainCleaned(): void { if (Math.random() < 0.4) this.sayCleaningWell() }
  onTrashCollected(): void { if (Math.random() < 0.3) this.sayTrashFound() }
  onMissedSpot(): void { if (Math.random() < 0.5) this.sayCleaningPoorly() }

  sayJobStart(job: any): void {
    const lines = [
      `Right then. ${job.clientName} wants the ${job.title.toLowerCase()} done. ${job.flavorText}`,
      `New job. ${job.clientName}. ${job.type.replace('_', ' ')}. ${job.description}`,
      `Job accepted. ${job.targetRooms.length} rooms. ${job.flavorText}`,
      `Alright, ${job.clientName}'s place. ${job.description} Don't make me regret believing in you.`,
    ]
    this.speak(lines[Math.floor(Math.random() * lines.length)], 'jobStart')
  }

  sayJobFail(job: any): void {
    const lines = [
      `Failed. ${job.clientName} won't be calling again. Neither will anyone else, at this rate.`,
      `Job failed. Right. That's... that's embarrassing, actually.`,
      `You've let ${job.clientName} down. And yourself. Mostly yourself.`,
      `Right. Pack it in. Go home. This clearly isn't for you.`,
    ]
    this.speak(lines[Math.floor(Math.random() * lines.length)], 'jobFail')
  }

  sayReputationUp(level: number): void {
    const lines = [
      `Reputation up. Level ${level} now. People are actually *talking* about your work.`,
      `Level ${level}! Look at you, climbing the ladder. Rung by grubby rung.`,
      `Proper reputation that. Level ${level}. Clients request you by name now.`,
      `Level ${level} cleaner. Has a ring to it, doesn't it? Keep it up.`,
    ]
    this.speak(lines[Math.floor(Math.random() * lines.length)], 'reputationUp')
  }

  // ============================================
  // PUBLIC API - New driving methods
  // ============================================
  onEnterVehicle(): void { this.say('driving', 'general') }
  onExitVehicle(): void { this.say('driving', 'general') }
  onSpeeding(): void { this.say('driving', 'speeding') }
  onHardCornering(): void { this.say('driving', 'cornering') }
  onParking(): void { this.say('driving', 'parking') }
  onGoodGearChange(): void { this.say('driving', 'gearChanges') }
  onBadGearChange(): void { this.say('driving', 'gearChanges') }
  onRedline(): void { this.say('driving', 'gearChanges') }
  onRidingClutch(): void { this.say('driving', 'general') }

  // ============================================
  // PUBLIC API - New car repair methods
  // ============================================
  onEnterGarage(): void { this.say('carRepair', 'general') }
  onDiagnosisStart(): void { this.say('carRepair', 'diagnosis') }
  onFaultCodeRead(code: string): void {
    this.speak(`Code ${code}. Right. Let's see what that means.`, 'carRepair.diagnosis')
  }
  onLiveDataAnomaly(reading: string): void {
    this.speak(`${reading}? That's not right. Not right at all.`, 'carRepair.diagnosis')
  }
  onTestResult(passed: boolean): void {
    this.speak(passed ? 'Test passes. Good. Next.' : 'Test fails. Right. That narrows it.', 'carRepair.diagnosis')
  }
  onDiagnosisComplete(correct: boolean): void {
    this.speak(correct ? 'Nailed it. Root cause found. Now fix it.' : 'Wrong. That\'s not it. Back to the scanner.', 'carRepair.diagnosis')
  }
  onPartFitted(correct: boolean): void {
    this.speak(correct ? 'Fitted. Torqued. *Next.*' : 'Wrong part. Or wrong way round. *Check it.*', 'carRepair.repair')
  }
  onTorqueWrenchUsed(used: boolean): void {
    if (!used) this.say('carRepair', 'quality')
  }
  onBodgeDetected(): void { this.say('carRepair', 'quality') }
  onRepairComplete(success: boolean): void {
    this.speak(success ? 'Right. That\'s fixed. Proper fixed. Test drive.' : 'Still not right. What did you miss?', 'carRepair.repair')
  }

  // ============================================
  // PUBLIC API - New breakdown methods
  // ============================================
  onBreakdown(severity: 'minor' | 'major' | 'critical'): void {
    if (severity === 'critical') this.say('breakdown', 'general')
    else this.say('breakdown', 'roadside')
  }
  onRecoveryCalled(): void { this.say('breakdown', 'recovery') }
  onRecoveryArrived(): void { this.say('breakdown', 'recovery') }
  onRoadsideRepairAttempt(): void { this.say('breakdown', 'roadside') }
  onRoadsideRepairSuccess(): void { this.speak('Miracle. It runs. *Drive gently.*', 'breakdown.roadside') }
  onRoadsideRepairFail(): void { this.speak('No joy. Recovery it is. *Wait in the car.*', 'breakdown.roadside') }

  // ============================================
  // PUBLIC API - New navigation methods
  // ============================================
  onJobAccepted(distance: number): void {
    this.speak(`Job's ${Math.round(distance / 1000)} miles away. *${Math.round(distance / 1000 * 2)} minutes if you behave.*`, 'navigation.jobNavigation')
  }
  onWrongTurn(): void { this.say('navigation', 'general') }
  onReroute(): void { this.say('navigation', 'general') }
  onArriveAtJob(): void { this.say('navigation', 'jobNavigation') }
  onRoadClosed(): void { this.say('navigation', 'general') }
  onSingleTrackRoad(): void { this.say('navigation', 'general') }
  onLowBridge(): void { this.say('navigation', 'general') }
  onCongestion(): void { this.say('navigation', 'general') }

  // ============================================
  // PUBLIC API - New fuel methods
  // ============================================
  onFuelLow(): void { this.say('fuel', 'general') }
  onFuelCritical(): void { this.say('fuel', 'general') }
  onRefuelStart(): void { this.say('fuel', 'stations') }
  onRefuelComplete(): void { this.speak('Full tank. *Range restored.* Now don\'t let it get that low again.', 'fuel.general') }
  onWrongFuel(): void { this.say('fuel', 'general') }

  // ============================================
  // UTILITY
  // ============================================
  setContext(context: Partial<NarratorContext>): void {
    this.previousContext = { ...this.context }
    this.context = { ...this.context, ...context }
  }

  getContext(): NarratorContext {
    return { ...this.context }
  }

  setSpeakInterval(ms: number): void {
    this.speakInterval = ms
  }
}