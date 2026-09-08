export type PublishingStatus =
  | 'live'
  | 'correction'
  | 'production'
  | 'editorial'
  | 'planned'
  | 'hold';

export type PublishingProject = {
  id: string;
  franchise: string;
  title: string;
  volume?: number;
  targetDate?: string;
  status: PublishingStatus;
  formats: string[];
  nextAction: string;
  blocker?: string;
  commercial: boolean;
};

export const publishingProjects: PublishingProject[] = [
  {
    id: 'shatterzone-1',
    franchise: 'Shatterzone Saga',
    title: 'SHATTERZONE: The Unremembered',
    volume: 1,
    targetDate: '2026-09-15',
    status: 'correction',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Approve the corrected 199-page hardcover and unify retailer metadata.',
    blocker: 'Remove every remaining “The Unforgotten” title conflict before wide distribution.',
    commercial: true,
  },
  {
    id: 'the-bleed-1',
    franchise: 'The Bleed',
    title: 'Open Late',
    volume: 1,
    targetDate: '2026-10-13',
    status: 'correction',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Complete the corrected wide-distribution edition and retail QA.',
    commercial: true,
  },
  {
    id: 'kai-jax-1',
    franchise: 'Legends of Kai-Jax',
    title: 'Bloodward',
    volume: 1,
    targetDate: '2026-11-17',
    status: 'production',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Approve paperback and hardcover interiors, covers, and barcode proofs.',
    commercial: true,
  },
  {
    id: 'quantina-1',
    franchise: 'Quantina Cottage',
    title: 'Quantina Cottage',
    volume: 1,
    targetDate: '2026-12-15',
    status: 'correction',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Publish corrected print editions and preserve the canonical Quantina spelling.',
    blocker: 'Wide ebook distribution waits until KDP Select exclusivity is cleared.',
    commercial: true,
  },
  {
    id: 'kai-jax-2',
    franchise: 'Legends of Kai-Jax',
    title: 'Storm Ronin',
    volume: 2,
    targetDate: '2027-03-16',
    status: 'editorial',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Finish the final editorial, continuity, interior, and cover-production pass.',
    commercial: true,
  },
  {
    id: 'kai-jax-3',
    franchise: 'Legends of Kai-Jax',
    title: 'Fracture',
    volume: 3,
    targetDate: '2027-06-15',
    status: 'editorial',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Complete final continuity verification and production proofing.',
    commercial: true,
  },
  {
    id: 'kai-jax-4',
    franchise: 'Legends of Kai-Jax',
    title: 'Forgotten Roads',
    volume: 4,
    targetDate: '2027-09-14',
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Lock the manuscript blueprint after Fracture continuity is final.',
    commercial: true,
  },
  {
    id: 'kai-jax-5',
    franchise: 'Legends of Kai-Jax',
    title: 'Hollow Fangs',
    volume: 5,
    targetDate: '2027-12-14',
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Preserve the seven-volume saga map and prepare the production blueprint.',
    commercial: true,
  },
  {
    id: 'kai-jax-6',
    franchise: 'Legends of Kai-Jax',
    title: 'Stormfall',
    volume: 6,
    targetDate: '2028-03-14',
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Hold until Volumes IV-V continuity is locked.',
    commercial: true,
  },
  {
    id: 'kai-jax-7',
    franchise: 'Legends of Kai-Jax',
    title: 'Memory King',
    volume: 7,
    targetDate: '2028-06-13',
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Preserve as the seven-volume saga finale.',
    commercial: true,
  },
  {
    id: 'ashfall-1',
    franchise: 'Ashfall Chronicles',
    title: 'Rise of the Void Law',
    volume: 1,
    status: 'editorial',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Complete the full prose repair and manuscript QA before assigning a release date.',
    blocker: 'Developmental rewrite is not complete.',
    commercial: true,
  },
  {
    id: 'world-order-1',
    franchise: 'World Order',
    title: 'Before the First Lie',
    volume: 1,
    status: 'hold',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Audit manuscript completion, metadata, and production assets.',
    commercial: true,
  },
  {
    id: 'zero-code-1',
    franchise: 'Zero Code',
    title: 'Bloodline Racers',
    volume: 1,
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Establish the manuscript and production baseline before scheduling.',
    commercial: true,
  },
  {
    id: 'chronobreakers-1',
    franchise: 'Chronobreakers',
    title: 'The War Beyond Endings',
    volume: 1,
    status: 'planned',
    formats: ['Kindle', 'Paperback', 'Hardcover'],
    nextAction: 'Establish the manuscript and production baseline before scheduling.',
    commercial: true,
  },
  {
    id: 'ssgs-1',
    franchise: 'Super Smash Grand Saga',
    title: 'Convergence',
    volume: 1,
    status: 'hold',
    formats: ['Noncommercial fan-fiction package'],
    nextAction: 'Continue the comic adaptation separately from the commercial original-IP slate.',
    blocker: 'Do not place on the commercial calendar without rights clearance.',
    commercial: false,
  },
];

