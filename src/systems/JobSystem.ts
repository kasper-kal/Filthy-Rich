import * as THREE from 'three';
import { FurnitureItem } from './EconomySystem.js';
import type { RoomData } from './HouseLayout.js';
import { HOUSE_LAYOUT } from './HouseLayout.js';

export type JobType =
  | 'standard'
  | 'deep_clean'
  | 'hoarder'
  | 'post_party'
  | 'move_in'
  | 'move_out'
  | 'renovation_prep'
  | 'emergency';
export type JobDifficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type JobStatus = 'available' | 'active' | 'completed' | 'failed' | 'expired';

export interface Job {
  id: string;
  type: JobType;
  difficulty: JobDifficulty;
  title: string;
  description: string;
  clientName: string;
  clientPersonality: ClientPersonality;

  // Target rooms
  targetRooms: string[];
  roomDetails: RoomJobDetail[];

  // Requirements
  requiredCleanliness: number; // 0-100 per room
  requiredTrashCollected: number; // percentage
  specialRequirements: SpecialRequirement[];

  // Rewards
  basePay: number;
  bonusPay: number; // for exceeding requirements
  reputationReward: number;

  // Time
  timeLimit: number; // minutes, 0 = no limit
  expiresAt: number; // timestamp

  // State
  status: JobStatus;
  startedAt: number | null;
  completedAt: number | null;
  currentProgress: Record<string, { cleanliness: number; trash: number }>;

  // Flavor
  flavorText: string;
  clientNotes: string;
}

export interface RoomJobDetail {
  roomName: string;
  stainCount: number;
  trashCount: number;
  dustLevel: number; // 0-1
  greaseLevel: number; // 0-1
  moldLevel: number; // 0-1
  clutterLevel: number; // 0-1
  specialStains: SpecialStain[];
}

export interface SpecialStain {
  type: 'grease' | 'wine' | 'blood' | 'ink' | 'paint' | 'mold' | 'rust' | 'pet';
  position: THREE.Vector3;
  surface: 'floor' | 'wall' | 'ceiling' | 'furniture';
  difficulty: number; // 1-3
  requiredTool: 'spray' | 'mop' | 'vacuum' | 'any';
}

export interface SpecialRequirement {
  type:
    | 'no_chemicals'
    | 'vacuum_only'
    | 'speed_run'
    | 'perfect_score'
    | 'specific_tool'
    | 'quiet_hours';
  description: string;
  bonusMultiplier: number;
  penaltyMultiplier: number;
}

export type ClientPersonality =
  | 'picky'
  | 'laid_back'
  | 'demanding'
  | 'grateful'
  | 'suspicious'
  | 'wealthy'
  | 'budget'
  | 'eccentric';

interface ClientPersonalityData {
  name: string;
  personalities: ClientPersonality[];
  payMultiplier: number;
  patienceMultiplier: number;
  tipChance: number;
  tipMultiplier: number;
  specialDialogue: string[];
}

const CLIENT_PERSONALITIES: Record<ClientPersonality, ClientPersonalityData> = {
  picky: {
    name: 'Picky',
    personalities: ['picky'],
    payMultiplier: 1.1,
    patienceMultiplier: 0.7,
    tipChance: 0.15,
    tipMultiplier: 1.5,
    specialDialogue: [
      "I'll know if you missed a spot. I always know.",
      'My mother could eat off these floors. Can yours?',
      "Don't think I won't check behind the toilet.",
    ],
  },
  laid_back: {
    name: 'Laid Back',
    personalities: ['laid_back'],
    payMultiplier: 0.9,
    patienceMultiplier: 1.5,
    tipChance: 0.3,
    tipMultiplier: 1.2,
    specialDialogue: [
      'Yeah, just... make it livable, you know?',
      'No rush, man. The dust has been there for years.',
      'Whatever you think is clean is probably fine.',
    ],
  },
  demanding: {
    name: 'Demanding',
    personalities: ['demanding'],
    payMultiplier: 1.3,
    patienceMultiplier: 0.5,
    tipChance: 0.05,
    tipMultiplier: 2.0,
    specialDialogue: [
      "I'm paying for perfection. Nothing less.",
      "If I see one streak, I'm deducting from your pay.",
      "My time is valuable. Don't waste it.",
    ],
  },
  grateful: {
    name: 'Grateful',
    personalities: ['grateful'],
    payMultiplier: 1.0,
    patienceMultiplier: 1.3,
    tipChance: 0.5,
    tipMultiplier: 1.3,
    specialDialogue: [
      "Oh thank you, thank you! I don't know what I'd do without you.",
      "You're a lifesaver. Really.",
      'Let me make you some tea after. Or coffee. Or whatever.',
    ],
  },
  suspicious: {
    name: 'Suspicious',
    personalities: ['suspicious'],
    payMultiplier: 1.05,
    patienceMultiplier: 0.8,
    tipChance: 0.1,
    tipMultiplier: 1.0,
    specialDialogue: [
      "I'll be watching. On the cameras. All of them.",
      "Don't touch my things. Just clean.",
      "I've had cleaners steal before. Just saying.",
    ],
  },
  wealthy: {
    name: 'Wealthy',
    personalities: ['wealthy'],
    payMultiplier: 1.5,
    patienceMultiplier: 1.0,
    tipChance: 0.4,
    tipMultiplier: 2.5,
    specialDialogue: [
      "Money's no object. Just make it pristine.",
      'Charge whatever you think is fair. Triple it.',
      'The help entrance is around back. Kidding! Use the front.',
    ],
  },
  budget: {
    name: 'Budget Conscious',
    personalities: ['budget'],
    payMultiplier: 0.7,
    patienceMultiplier: 1.2,
    tipChance: 0.05,
    tipMultiplier: 1.0,
    specialDialogue: [
      "The listing said 'affordable.' Was that a lie?",
      "Can you... use less cleaner? It's expensive.",
      "My cousin said he'd do it for half. But he's 'busy.'",
    ],
  },
  eccentric: {
    name: 'Eccentric',
    personalities: ['eccentric'],
    payMultiplier: 1.2,
    patienceMultiplier: 1.1,
    tipChance: 0.25,
    tipMultiplier: 1.8,
    specialDialogue: [
      'The spirits in the north wall prefer lemon scent. Remember that.',
      "Don't vacuum the corner by the bookshelf. The dust bunnies have tenure.",
      'Clean clockwise. The energy flows better that way.',
    ],
  },
};

const JOB_TEMPLATES: Record<
  JobType,
  {
    basePay: number;
    baseTime: number;
    stainMultiplier: number;
    trashMultiplier: number;
    specialRequirementChance: number;
    descriptionTemplates: string[];
  }
> = {
  standard: {
    basePay: 800,
    baseTime: 0,
    stainMultiplier: 1.0,
    trashMultiplier: 1.0,
    specialRequirementChance: 0.1,
    descriptionTemplates: [
      'Regular cleaning job. Nothing too crazy.',
      'Just a standard tidy-up. Floors, surfaces, trash.',
      'Weekly maintenance clean. In and out.',
    ],
  },
  deep_clean: {
    basePay: 1500,
    baseTime: 60,
    stainMultiplier: 1.5,
    trashMultiplier: 1.2,
    specialRequirementChance: 0.3,
    descriptionTemplates: [
      'Deep clean needed. Everything. Inside appliances, under furniture, the works.',
      "Haven't cleaned in months. Need someone thorough.",
      'Spring cleaning in [season]. Top to bottom.',
    ],
  },
  hoarder: {
    basePay: 3000,
    baseTime: 120,
    stainMultiplier: 2.0,
    trashMultiplier: 3.0,
    specialRequirementChance: 0.5,
    descriptionTemplates: [
      "Situation's... delicate. Lots of stuff. Be respectful.",
      'Family member passed. House is full. Need compassion AND efficiency.',
      'Level 4 hoard. Structural concerns. Hazmat recommended.',
    ],
  },
  post_party: {
    basePay: 1200,
    baseTime: 45,
    stainMultiplier: 1.3,
    trashMultiplier: 2.5,
    specialRequirementChance: 0.2,
    descriptionTemplates: [
      'Rager last night. Cups everywhere. Mystery stains. Parents coming home in 2 hours.',
      "Wedding afterparty. Confetti in places confetti shouldn't be.",
      'Housewarming gone wild. Red wine on beige carpet. Why beige?',
    ],
  },
  move_in: {
    basePay: 1000,
    baseTime: 60,
    stainMultiplier: 1.2,
    trashMultiplier: 0.8,
    specialRequirementChance: 0.15,
    descriptionTemplates: [
      'New place, old dirt. Previous owners left it... lived in.',
      'Move-in ready? Not even close. Need it spotless before boxes arrive.',
      'First home! Want it perfect. Previous owners had cats. Many cats.',
    ],
  },
  move_out: {
    basePay: 1100,
    baseTime: 60,
    stainMultiplier: 1.1,
    trashMultiplier: 1.5,
    specialRequirementChance: 0.2,
    descriptionTemplates: [
      'Deposit on the line. Landlord inspection tomorrow.',
      'Moving out. Need it cleaner than when I moved in.',
      "End of lease. If I lose my deposit I'm coming for you. Kidding. Mostly.",
    ],
  },
  renovation_prep: {
    basePay: 2000,
    baseTime: 90,
    stainMultiplier: 0.8,
    trashMultiplier: 1.0,
    specialRequirementChance: 0.4,
    descriptionTemplates: [
      'Demo starts Monday. Need dust-free for contractors.',
      'Renovating the kitchen. Clear everything, wipe everything.',
      'Adding a bathroom. Construction dust is evil. Get ahead of it.',
    ],
  },
  emergency: {
    basePay: 2500,
    baseTime: 30,
    stainMultiplier: 1.5,
    trashMultiplier: 1.5,
    specialRequirementChance: 0.6,
    descriptionTemplates: [
      'PIPE BURST. WATER EVERYWHERE. MOLD GROWING AS WE SPEAK.',
      'Fire damage. Smoke everywhere. Insurance adjuster coming at noon.',
      'Toddler + permanent marker + every wall. Help.',
    ],
  },
};

const JOB_DIFFICULTIES: Record<
  JobDifficulty,
  {
    payMultiplier: number;
    timeMultiplier: number;
    stainMultiplier: number;
    trashMultiplier: number;
    requiredCleanliness: number;
    name: string;
  }
> = {
  easy: {
    payMultiplier: 0.8,
    timeMultiplier: 1.2,
    stainMultiplier: 0.7,
    trashMultiplier: 0.7,
    requiredCleanliness: 70,
    name: 'Easy',
  },
  normal: {
    payMultiplier: 1.0,
    timeMultiplier: 1.0,
    stainMultiplier: 1.0,
    trashMultiplier: 1.0,
    requiredCleanliness: 85,
    name: 'Normal',
  },
  hard: {
    payMultiplier: 1.4,
    timeMultiplier: 0.8,
    stainMultiplier: 1.4,
    trashMultiplier: 1.3,
    requiredCleanliness: 95,
    name: 'Hard',
  },
  extreme: {
    payMultiplier: 2.0,
    timeMultiplier: 0.6,
    stainMultiplier: 2.0,
    trashMultiplier: 1.8,
    requiredCleanliness: 100,
    name: 'Extreme',
  },
};

const ROOM_NAMES = HOUSE_LAYOUT.map(r => r.name);

export class JobSystem {
  private jobs = new Map<string, Job>();
  private activeJobId: string | null = null;
  private completedJobs: Job[] = [];
  private reputation = 0;
  private reputationLevel = 1;
  private totalEarned = 0;
  private jobsCompleted = 0;

  // Callbacks
  onJobCreated?: (job: Job) => void;
  onJobStarted?: (job: Job) => void;
  onJobCompleted?: (job: Job, finalPay: number, reputationGained: number) => void;
  onJobFailed?: (job: Job) => void;
  onReputationChanged?: (level: number, reputation: number) => void;

  constructor() {
    this.loadProgress();
  }

  // === JOB GENERATION ===

  generateJobs(count = 5): Job[] {
    const newJobs: Job[] = [];

    for (let i = 0; i < count; i++) {
      const job = this.createRandomJob();
      this.jobs.set(job.id, job);
      newJobs.push(job);
      this.onJobCreated?.(job);
    }

    return newJobs;
  }

  private createRandomJob(): Job {
    // Weighted random job type based on reputation
    const availableTypes = this.getAvailableJobTypes();
    const type = this.weightedRandom(availableTypes);
    const difficulty = this.pickDifficulty();
    const template = JOB_TEMPLATES[type];
    const diff = JOB_DIFFICULTIES[difficulty];

    // Pick client personality
    const personality = this.pickClientPersonality();
    const clientData = CLIENT_PERSONALITIES[personality];

    // Pick target rooms (1-4 rooms based on difficulty)
    const roomCount = this.getRoomCountForDifficulty(difficulty);
    const targetRooms = this.pickRandomRooms(roomCount);

    // Generate room details
    const roomDetails = this.generateRoomDetails(targetRooms, type, difficulty);

    // Calculate counts
    const totalStains = roomDetails.reduce((sum, r) => sum + r.stainCount, 0);
    const totalTrash = roomDetails.reduce((sum, r) => sum + r.trashCount, 0);

    // Calculate pay
    const basePay = Math.round(
      template.basePay *
        diff.payMultiplier *
        clientData.payMultiplier *
        (1 + (this.reputationLevel - 1) * 0.1)
    );

    const timeLimit =
      template.baseTime > 0
        ? Math.round((template.baseTime * diff.timeMultiplier) / clientData.patienceMultiplier)
        : 0;

    // Special requirements
    const specialRequirements = this.generateSpecialRequirements(type, difficulty, personality);

    // Generate client name
    const clientName = this.generateClientName();

    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      difficulty,
      title: `${diff.name} ${type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
      description: this.pickRandom(template.descriptionTemplates),
      clientName,
      clientPersonality: personality,
      targetRooms,
      roomDetails,
      requiredCleanliness: diff.requiredCleanliness,
      requiredTrashCollected: diff.requiredCleanliness,
      specialRequirements,
      basePay,
      bonusPay: Math.round(basePay * 0.3),
      reputationReward: Math.round(10 * diff.payMultiplier * clientData.payMultiplier),
      timeLimit,
      expiresAt: Date.now() + (timeLimit > 0 ? timeLimit * 60 * 1000 : 24 * 60 * 60 * 1000), // 24hr default
      status: 'available',
      startedAt: null,
      completedAt: null,
      currentProgress: {},
      flavorText: this.pickRandom(clientData.specialDialogue),
      clientNotes: this.generateClientNotes(personality, type),
    };

    // Initialize progress tracking
    targetRooms.forEach(room => {
      job.currentProgress[room] = { cleanliness: 0, trash: 0 };
    });

    return job;
  }

  private getAvailableJobTypes(): JobType[] {
    const allTypes: JobType[] = [
      'standard',
      'deep_clean',
      'hoarder',
      'post_party',
      'move_in',
      'move_out',
      'renovation_prep',
      'emergency',
    ];
    // Unlock more types as reputation increases
    if (this.reputationLevel < 3) return ['standard', 'deep_clean', 'move_in', 'move_out'];
    if (this.reputationLevel < 5)
      return ['standard', 'deep_clean', 'post_party', 'move_in', 'move_out', 'renovation_prep'];
    return allTypes;
  }

  private pickDifficulty(): JobDifficulty {
    const weights =
      this.reputationLevel < 3
        ? [0.5, 0.4, 0.1, 0] // Easy, Normal, Hard, Extreme
        : this.reputationLevel < 5
          ? [0.2, 0.5, 0.25, 0.05]
          : [0.1, 0.3, 0.4, 0.2];

    const rand = Math.random();
    let sum = 0;
    const difficulties: JobDifficulty[] = ['easy', 'normal', 'hard', 'extreme'];
    for (let i = 0; i < difficulties.length; i++) {
      sum += weights[i];
      if (rand < sum) return difficulties[i];
    }
    return 'normal';
  }

  private pickClientPersonality(): ClientPersonality {
    const personalities: ClientPersonality[] = Object.keys(
      CLIENT_PERSONALITIES
    ) as ClientPersonality[];
    return this.pickRandom(personalities);
  }

  private getRoomCountForDifficulty(difficulty: JobDifficulty): number {
    const counts: Record<JobDifficulty, [number, number]> = {
      easy: [1, 2],
      normal: [1, 3],
      hard: [2, 4],
      extreme: [3, 5],
    };
    const [min, max] = counts[difficulty];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private pickRandomRooms(count: number): string[] {
    const shuffled = [...ROOM_NAMES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private generateRoomDetails(
    rooms: string[],
    type: JobType,
    difficulty: JobDifficulty
  ): RoomJobDetail[] {
    const template = JOB_TEMPLATES[type];
    const diff = JOB_DIFFICULTIES[difficulty];

    return rooms.map(roomName => {
      const room = HOUSE_LAYOUT.find(r => r.name === roomName)!;
      const area = room.size.x * room.size.z;

      // Base counts scaled by room area and difficulty
      const baseStains = Math.round(area * 0.8 * template.stainMultiplier * diff.stainMultiplier);
      const baseTrash = Math.round(area * 0.4 * template.trashMultiplier * diff.trashMultiplier);

      // Dust/grease/mold levels based on job type
      let dustLevel = 0.3;
      let greaseLevel = 0.1;
      let moldLevel = 0.05;
      let clutterLevel = 0.2;

      switch (type) {
        case 'deep_clean':
          dustLevel = 0.8;
          greaseLevel = 0.5;
          moldLevel = 0.3;
          clutterLevel = 0.4;
          break;
        case 'hoarder':
          dustLevel = 0.9;
          greaseLevel = 0.4;
          moldLevel = 0.2;
          clutterLevel = 1.0;
          break;
        case 'post_party':
          dustLevel = 0.4;
          greaseLevel = 0.3;
          moldLevel = 0.1;
          clutterLevel = 0.8;
          break;
        case 'renovation_prep':
          dustLevel = 1.0;
          greaseLevel = 0.2;
          moldLevel = 0.1;
          clutterLevel = 0.3;
          break;
        case 'emergency':
          dustLevel = 0.6;
          greaseLevel = 0.6;
          moldLevel = 0.8;
          clutterLevel = 0.5;
          break;
      }

      // Special stains for variety
      const specialStains = this.generateSpecialStains(room, type, difficulty);

      return {
        roomName,
        stainCount: baseStains + specialStains.length,
        trashCount: baseTrash,
        dustLevel: Math.min(1, dustLevel * (0.8 + Math.random() * 0.4)),
        greaseLevel: Math.min(1, greaseLevel * (0.8 + Math.random() * 0.4)),
        moldLevel: Math.min(1, moldLevel * (0.8 + Math.random() * 0.4)),
        clutterLevel: Math.min(1, clutterLevel * (0.8 + Math.random() * 0.4)),
        specialStains,
      };
    });
  }

  private generateSpecialStains(
    room: RoomData,
    type: JobType,
    difficulty: JobDifficulty
  ): SpecialStain[] {
    const specials: SpecialStain[] = [];
    const count = difficulty === 'extreme' ? 3 : difficulty === 'hard' ? 2 : 1;

    const stainTypes: SpecialStain['type'][] = [
      'grease',
      'wine',
      'blood',
      'ink',
      'paint',
      'mold',
      'rust',
      'pet',
    ];
    const surfaces: SpecialStain['surface'][] = ['floor', 'wall', 'ceiling', 'furniture'];

    for (let i = 0; i < count; i++) {
      const stainType = this.pickRandom(stainTypes);
      const surface = this.pickRandom(surfaces);

      // Position within room bounds
      const halfW = room.size.x / 2;
      const halfD = room.size.z / 2;
      const cx = room.position.x;
      const cz = room.position.z;

      let position: THREE.Vector3;
      if (surface === 'floor') {
        position = new THREE.Vector3(
          cx + (Math.random() - 0.5) * halfW * 0.8,
          room.position.y - room.size.y / 2 + 0.02,
          cz + (Math.random() - 0.5) * halfD * 0.8
        );
      } else if (surface === 'wall') {
        const wall = this.pickRandom(['north', 'south', 'east', 'west']);
        const height = room.position.y - room.size.y / 2 + 0.5 + Math.random() * (room.size.y - 1);
        switch (wall) {
          case 'north':
            position = new THREE.Vector3(
              cx + (Math.random() - 0.5) * halfW * 0.8,
              height,
              cz - halfD + 0.02
            );
            break;
          case 'south':
            position = new THREE.Vector3(
              cx + (Math.random() - 0.5) * halfW * 0.8,
              height,
              cz + halfD - 0.02
            );
            break;
          case 'east':
            position = new THREE.Vector3(
              cx + halfW - 0.02,
              height,
              cz + (Math.random() - 0.5) * halfD * 0.8
            );
            break;
          default:
            position = new THREE.Vector3(
              cx - halfW + 0.02,
              height,
              cz + (Math.random() - 0.5) * halfD * 0.8
            );
        }
      } else {
        position = new THREE.Vector3(
          cx + (Math.random() - 0.5) * halfW * 0.5,
          room.position.y + room.size.y / 2 - 0.02,
          cz + (Math.random() - 0.5) * halfD * 0.5
        );
      }

      specials.push({
        type: stainType,
        position,
        surface,
        difficulty: 1 + Math.floor(Math.random() * 3),
        requiredTool: this.getRequiredToolForStain(stainType),
      });
    }

    return specials;
  }

  private getRequiredToolForStain(type: SpecialStain['type']): SpecialStain['requiredTool'] {
    const toolMap: Record<SpecialStain['type'], SpecialStain['requiredTool']> = {
      grease: 'spray',
      wine: 'spray',
      blood: 'spray',
      ink: 'spray',
      paint: 'mop',
      mold: 'spray',
      rust: 'spray',
      pet: 'vacuum',
    };
    return toolMap[type] || 'any';
  }

  private generateSpecialRequirements(
    type: JobType,
    difficulty: JobDifficulty,
    personality: ClientPersonality
  ): SpecialRequirement[] {
    const template = JOB_TEMPLATES[type];
    const requirements: SpecialRequirement[] = [];

    if (Math.random() > template.specialRequirementChance) return requirements;

    const possibleRequirements: SpecialRequirement[] = [
      {
        type: 'no_chemicals',
        description: 'Client has allergies. No spray cleaner allowed.',
        bonusMultiplier: 1.2,
        penaltyMultiplier: 0.5,
      },
      {
        type: 'vacuum_only',
        description: 'Delicate surfaces. Vacuum only, no mopping.',
        bonusMultiplier: 1.15,
        penaltyMultiplier: 0.6,
      },
      {
        type: 'speed_run',
        description: 'Client needs it done FAST. Half the usual time.',
        bonusMultiplier: 1.5,
        penaltyMultiplier: 0.0,
      },
      {
        type: 'perfect_score',
        description: 'Perfectionist client. 100% or no pay.',
        bonusMultiplier: 2.0,
        penaltyMultiplier: 0.0,
      },
      {
        type: 'specific_tool',
        description: 'Client insists on eco-friendly tools only.',
        bonusMultiplier: 1.1,
        penaltyMultiplier: 0.7,
      },
      {
        type: 'quiet_hours',
        description: 'Baby sleeping. No loud tools (vacuum) after 8pm.',
        bonusMultiplier: 1.2,
        penaltyMultiplier: 0.5,
      },
    ];

    // Personality influences requirements
    if (personality === 'picky' || personality === 'demanding') {
      possibleRequirements.push({
        type: 'perfect_score',
        description: 'Everything spotless. I will check.',
        bonusMultiplier: 1.5,
        penaltyMultiplier: 0.3,
      });
    }
    if (personality === 'wealthy') {
      possibleRequirements.push({
        type: 'speed_run',
        description: 'I have a gala tonight. Two hours.',
        bonusMultiplier: 2.0,
        penaltyMultiplier: 0.0,
      });
    }
    if (personality === 'eccentric') {
      possibleRequirements.push({
        type: 'specific_tool',
        description: 'Only natural cleaners. The spirits prefer vinegar.',
        bonusMultiplier: 1.3,
        penaltyMultiplier: 0.4,
      });
    }

    const count = Math.min(2, possibleRequirements.length);
    const shuffled = [...possibleRequirements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private generateClientName(): string {
    const firstNames = [
      'Margaret',
      'Robert',
      'Jennifer',
      'Michael',
      'Elizabeth',
      'David',
      'Susan',
      'James',
      'Jessica',
      'Christopher',
      'Sarah',
      'Matthew',
      'Karen',
      'Daniel',
      'Nancy',
      'Anthony',
      'Lisa',
      'Mark',
      'Betty',
      'Donald',
      'Dorothy',
      'Steven',
      'Sandra',
      'Paul',
      'Ashley',
      'Andrew',
      'Kimberly',
      'Kenneth',
      'Donna',
      'Joshua',
      'Emily',
      'Kevin',
      'Priscilla',
      'Bartholomew',
      'Cordelia',
      'Percival',
      'Gwendolyn',
      'Reginald',
      'Seraphina',
      'Thaddeus',
    ];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
      'Hernandez',
      'Lopez',
      'Gonzalez',
      'Wilson',
      'Anderson',
      'Thomas',
      'Taylor',
      'Moore',
      'Jackson',
      'Martin',
      'Lee',
      'Perez',
      'Thompson',
      'White',
      'Harrington',
      'Montgomery',
      'Sinclair',
      'Pembroke',
      'Wellington',
      'Kensington',
      'Ashford',
      'Blackwood',
    ];
    return `${this.pickRandom(firstNames)} ${this.pickRandom(lastNames)}`;
  }

  private generateClientNotes(personality: ClientPersonality, type: JobType): string {
    const notes = [
      `Client is ${CLIENT_PERSONALITIES[personality].name.toLowerCase()}. `,
      `This is a ${type.replace('_', ' ')} job. `,
    ];

    if (personality === 'picky') notes.push('Expect thorough inspection. ');
    if (personality === 'demanding') notes.push('Time is critical. ');
    if (personality === 'grateful') notes.push('Likely to tip well. ');
    if (personality === 'wealthy') notes.push('Budget is not a concern. ');
    if (personality === 'suspicious') notes.push('Do not touch personal items. ');
    if (personality === 'eccentric') notes.push('Unusual requests possible. ');

    return notes.join('');
  }

  // === JOB MANAGEMENT ===

  getAvailableJobs(): Job[] {
    const now = Date.now();
    return Array.from(this.jobs.values())
      .filter(j => j.status === 'available' && j.expiresAt > now)
      .sort((a, b) => a.expiresAt - b.expiresAt);
  }

  getActiveJob(): Job | null {
    if (!this.activeJobId) return null;
    return this.jobs.get(this.activeJobId) || null;
  }

  getJob(id: string): Job | null {
    return this.jobs.get(id) || null;
  }

  startJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'available') return false;

    job.status = 'active';
    job.startedAt = Date.now();
    this.activeJobId = jobId;
    this.onJobStarted?.(job);
    return true;
  }

  /**
   * Start a job for a specific house (used when entering a house from the world map)
   * Creates a job tailored to that house's layout
   */
  startJobForHouse(houseId: string): Job | null {
    // Create a job specifically for this house
    const job = this.createJobForHouse(houseId);
    this.jobs.set(job.id, job);
    job.status = 'active';
    job.startedAt = Date.now();
    this.activeJobId = job.id;
    this.onJobStarted?.(job);
    this.onJobCreated?.(job);
    return job;
  }

  private createJobForHouse(houseId: string): Job {
    // Use house ID as seed for deterministic job generation
    const seed = this.hash(houseId);

    // Pick job type and difficulty based on reputation
    const availableTypes = this.getAvailableJobTypes();
    const type = availableTypes[seed % availableTypes.length];
    const difficulties: JobDifficulty[] = ['easy', 'normal', 'hard', 'extreme'];
    const diffWeights =
      this.reputationLevel < 3
        ? [0.5, 0.4, 0.1, 0]
        : this.reputationLevel < 5
          ? [0.2, 0.5, 0.25, 0.05]
          : [0.1, 0.3, 0.4, 0.2];
    let sum = 0;
    const rand = ((seed * 7) % 100) / 100;
    let difficulty: JobDifficulty = 'normal';
    for (let i = 0; i < difficulties.length; i++) {
      sum += diffWeights[i];
      if (rand < sum) {
        difficulty = difficulties[i];
        break;
      }
    }

    const template = JOB_TEMPLATES[type];
    const diff = JOB_DIFFICULTIES[difficulty];

    // Pick client personality
    const personalities: ClientPersonality[] = Object.keys(
      CLIENT_PERSONALITIES
    ) as ClientPersonality[];
    const personality = personalities[(seed * 13) % personalities.length];
    const clientData = CLIENT_PERSONALITIES[personality];

    // Target rooms - use standard house layout
    const roomCount = this.getRoomCountForDifficulty(difficulty);
    const targetRooms = ['entrance', 'living', 'kitchen', 'bathroom', 'bedroom'].slice(
      0,
      roomCount
    );

    // Generate room details
    const roomDetails = this.generateRoomDetails(targetRooms, type, difficulty);

    // Calculate pay
    const basePay = Math.round(
      template.basePay *
        diff.payMultiplier *
        clientData.payMultiplier *
        (1 + (this.reputationLevel - 1) * 0.1)
    );

    const timeLimit =
      template.baseTime > 0
        ? Math.round((template.baseTime * diff.timeMultiplier) / clientData.patienceMultiplier)
        : 0;

    const specialRequirements = this.generateSpecialRequirements(type, difficulty, personality);
    const clientName = this.generateClientName();

    const job: Job = {
      id: `job_house_${houseId}`,
      type,
      difficulty,
      title: `${diff.name} ${type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
      description: this.pickRandom(template.descriptionTemplates),
      clientName,
      clientPersonality: personality,
      targetRooms,
      roomDetails,
      requiredCleanliness: diff.requiredCleanliness,
      requiredTrashCollected: diff.requiredCleanliness,
      specialRequirements,
      basePay,
      bonusPay: Math.round(basePay * 0.3),
      reputationReward: Math.round(10 * diff.payMultiplier * clientData.payMultiplier),
      timeLimit,
      expiresAt: Date.now() + (timeLimit > 0 ? timeLimit * 60 * 1000 : 24 * 60 * 60 * 1000),
      status: 'active',
      startedAt: Date.now(),
      completedAt: null,
      currentProgress: {},
      flavorText: this.pickRandom(clientData.specialDialogue),
      clientNotes: this.generateClientNotes(personality, type),
    };

    // Initialize progress tracking
    targetRooms.forEach(room => {
      job.currentProgress[room] = { cleanliness: 0, trash: 0 };
    });

    return job;
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  updateJobProgress(roomName: string, cleanliness: number, trash: number): void {
    const job = this.getActiveJob();
    if (!job) return;

    job.currentProgress[roomName] = { cleanliness, trash };
  }

  completeJob(): { success: boolean; finalPay: number; reputationGained: number; tip: number } {
    const job = this.getActiveJob();
    if (!job) return { success: false, finalPay: 0, reputationGained: 0, tip: 0 };

    // Calculate overall progress
    let totalCleanliness = 0;
    let totalTrash = 0;
    let roomCount = 0;

    for (const roomName of job.targetRooms) {
      const progress = job.currentProgress[roomName];
      if (progress) {
        totalCleanliness += progress.cleanliness;
        totalTrash += progress.trash;
        roomCount++;
      }
    }

    const avgCleanliness = roomCount > 0 ? totalCleanliness / roomCount : 0;
    const avgTrash = roomCount > 0 ? totalTrash / roomCount : 0;
    const overallScore = Math.round((avgCleanliness + avgTrash) / 2);

    // Check requirements
    const cleanlinessMet = avgCleanliness >= job.requiredCleanliness;
    const trashMet = avgTrash >= job.requiredTrashCollected;

    let success = cleanlinessMet && trashMet;
    let finalPay = 0;
    let reputationGained = 0;
    let tip = 0;

    if (success) {
      // Base pay
      finalPay = job.basePay;

      // Bonus for exceeding requirements
      const cleanlinessBonus = Math.max(
        0,
        (avgCleanliness - job.requiredCleanliness) / (100 - job.requiredCleanliness)
      );
      const trashBonus = Math.max(
        0,
        (avgTrash - job.requiredTrashCollected) / (100 - job.requiredTrashCollected)
      );
      finalPay += Math.round((job.bonusPay * (cleanlinessBonus + trashBonus)) / 2);

      // Special requirement bonuses/penalties
      for (const req of job.specialRequirements) {
        // In a real implementation, we'd check if requirements were met
        // For now, assume 50% chance of meeting them
        if (Math.random() < 0.5) {
          finalPay = Math.round(finalPay * req.bonusMultiplier);
        } else {
          finalPay = Math.round(finalPay * req.penaltyMultiplier);
          if (req.type === 'perfect_score' || req.type === 'speed_run') {
            success = false;
          }
        }
      }

      // Tip chance
      const clientData = CLIENT_PERSONALITIES[job.clientPersonality];
      if (Math.random() < clientData.tipChance) {
        tip = Math.round(finalPay * clientData.tipMultiplier * 0.1);
        finalPay += tip;
      }

      reputationGained = job.reputationReward;
      this.addReputation(reputationGained);
      this.totalEarned += finalPay;
      this.jobsCompleted++;

      job.status = 'completed';
      job.completedAt = Date.now();
      this.completedJobs.push(job);
      this.activeJobId = null;

      this.onJobCompleted?.(job, finalPay, reputationGained);
    } else {
      // Failed job
      job.status = 'failed';
      job.completedAt = Date.now();
      this.activeJobId = null;
      this.onJobFailed?.(job);
      // Small reputation loss
      this.addReputation(-5);
    }

    this.saveProgress();
    return { success, finalPay, reputationGained, tip };
  }

  // === REPUTATION SYSTEM ===

  private addReputation(amount: number): void {
    this.reputation += amount;
    const newLevel = Math.floor(this.reputation / 100) + 1;
    if (newLevel !== this.reputationLevel) {
      this.reputationLevel = newLevel;
      this.onReputationChanged?.(this.reputationLevel, this.reputation);
    }
  }

  getReputation(): { level: number; current: number; nextLevelAt: number } {
    return {
      level: this.reputationLevel,
      current: this.reputation,
      nextLevelAt: this.reputationLevel * 100,
    };
  }

  getStats(): { completed: number; totalEarned: number; reputation: number; level: number } {
    return {
      completed: this.jobsCompleted,
      totalEarned: this.totalEarned,
      reputation: this.reputation,
      level: this.reputationLevel,
    };
  }

  getCompletedJobs(): Job[] {
    return [...this.completedJobs].reverse();
  }

  // === UTILITY ===

  private weightedRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  // === PERSISTENCE ===

  private saveProgress(): void {
    try {
      const data = {
        reputation: this.reputation,
        reputationLevel: this.reputationLevel,
        totalEarned: this.totalEarned,
        jobsCompleted: this.jobsCompleted,
        completedJobs: this.completedJobs.slice(-50), // Keep last 50
      };
      localStorage.setItem('filthy-rich-jobs', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save job progress:', e);
    }
  }

  private loadProgress(): void {
    try {
      const data = localStorage.getItem('filthy-rich-jobs');
      if (data) {
        const parsed = JSON.parse(data);
        this.reputation = parsed.reputation || 0;
        this.reputationLevel = parsed.reputationLevel || 1;
        this.totalEarned = parsed.totalEarned || 0;
        this.jobsCompleted = parsed.jobsCompleted || 0;
        this.completedJobs = parsed.completedJobs || [];
      }
    } catch (e) {
      console.warn('Failed to load job progress:', e);
    }
  }

  // === CLEANUP ===

  clearExpiredJobs(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'available' && job.expiresAt < now) {
        this.jobs.delete(id);
      }
    }
  }

  refreshJobs(): Job[] {
    this.clearExpiredJobs();
    // Ensure minimum jobs available
    const available = this.getAvailableJobs();
    if (available.length < 3) {
      return this.generateJobs(5 - available.length);
    }
    return available;
  }

  cancelActiveJob(): void {
    if (this.activeJobId) {
      const job = this.jobs.get(this.activeJobId);
      if (job) {
        job.status = 'failed';
        this.onJobFailed?.(job);
      }
      this.activeJobId = null;
    }
  }
}
