export type WorkType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type WorkStyle = 'Remote' | 'On-site' | 'Hybrid';
export type ExperienceLevel = 'Junior' | 'Mid-level' | 'Senior' | 'Lead';
export type AppStatus = 'Applied' | 'Under Review' | 'Interview' | 'Offer' | 'Rejected';
export type PipelineStage = 'New' | 'Review' | 'Interview' | 'Offer' | 'Hired';

export interface Company {
  id: string;
  name: string;
  logo: string;
  logoImage?: string;
  industry: string;
  size: string;
  location: string;
  description: string;
  openRoles: number;
  verified: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: Company;
  location: string;
  workType: WorkType;
  workStyle: WorkStyle;
  level: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  salaryLabel?: string;
  postedLabel?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  benefits: string[];
  postedDays: number;
  applicants: number;
  category: string;
  match?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
}

export interface Candidate {
  jobId?: string;
  id: string;
  name: string;
  avatar: string;
  role: string;
  location: string;
  experience: number;
  skills: string[];
  education: string;
  match: number;
  matchedSkills: string[];
  missingSkills: string[];
  status: PipelineStage;
  appliedDate: string;
  about: string;
}

export interface Application {
  id: string;
  job: Job;
  appliedDate: string;
  status: AppStatus;
  steps: AppStatus[];
  interview?: string;
}

export const companies: Company[] = [
  {
    id: 'c1',
    name: 'Axon Technologies',
    logo: 'AT',
    industry: 'Software',
    size: '500–2,000',
    location: 'Hà Nội',
    description: 'Building developer tools and cloud infrastructure for modern engineering teams.',
    openRoles: 14,
    verified: true,
  },
  {
    id: 'c2',
    name: 'Meridian Health',
    logo: 'MH',
    industry: 'Healthcare',
    size: '1,000–5,000',
    location: 'Hồ Chí Minh',
    description: 'Transforming patient care through technology and data-driven insights.',
    openRoles: 8,
    verified: true,
  },
  {
    id: 'c3',
    name: 'Vela Commerce',
    logo: 'VC',
    industry: 'E-commerce',
    size: '200–500',
    location: 'Đà Nẵng',
    description: 'Empowering Southeast Asian merchants with smart commerce solutions.',
    openRoles: 11,
    verified: true,
  },
  {
    id: 'c4',
    name: 'Nomad Studio',
    logo: 'NS',
    industry: 'Design',
    size: '50–200',
    location: 'Hồ Chí Minh',
    description: 'Crafting digital products and brand identities for global startups.',
    openRoles: 5,
    verified: false,
  },
  {
    id: 'c5',
    name: 'Quantum Finance',
    logo: 'QF',
    industry: 'Fintech',
    size: '200–1,000',
    location: 'Hà Nội',
    description: 'Next-generation banking and investment infrastructure for emerging markets.',
    openRoles: 9,
    verified: true,
  },
  {
    id: 'c6',
    name: 'Skyline Edu',
    logo: 'SE',
    industry: 'EdTech',
    size: '100–500',
    location: 'Đà Nẵng',
    description: 'Making quality education accessible across Vietnam and Southeast Asia.',
    openRoles: 6,
    verified: true,
  },
];

export const jobs: Job[] = [
  {
    id: 'j1',
    title: 'Senior Backend Developer',
    company: companies[0],
    location: 'Hà Nội',
    workType: 'Full-time',
    workStyle: 'Hybrid',
    level: 'Senior',
    salaryMin: 2500,
    salaryMax: 4000,
    currency: 'USD',
    description: 'Join our core platform team building scalable APIs and microservices that power millions of users. You will design and implement critical backend systems, collaborate with cross-functional teams, and contribute to architectural decisions.',
    responsibilities: [
      'Design and build high-performance REST and GraphQL APIs',
      'Architect scalable microservices and distributed systems',
      'Collaborate with product and frontend teams on feature delivery',
      'Mentor junior engineers and lead technical design reviews',
      'Drive improvements in reliability, performance, and observability',
    ],
    requirements: [
      '5+ years of backend development experience',
      'Strong proficiency in Python or Go',
      'Experience with PostgreSQL, Redis, and message queues',
      'Solid understanding of distributed systems and cloud services',
      'Excellent communication skills and team-player mindset',
    ],
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API', 'Redis', 'Kubernetes'],
    benefits: ['Competitive salary', '100% remote option', 'Annual learning budget', 'Health insurance', '20 days paid leave'],
    postedDays: 4,
    applicants: 48,
    category: 'Engineering',
    match: 92,
    matchedSkills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API'],
    missingSkills: ['Kubernetes'],
  },
  {
    id: 'j2',
    title: 'Product Designer',
    company: companies[3],
    location: 'Hồ Chí Minh',
    workType: 'Full-time',
    workStyle: 'Remote',
    level: 'Mid-level',
    salaryMin: 1800,
    salaryMax: 3000,
    currency: 'USD',
    description: 'Shape the visual identity and user experience for cutting-edge digital products. Work closely with product managers and developers in a collaborative, design-forward culture.',
    responsibilities: [
      'Lead end-to-end product design from discovery to delivery',
      'Create wireframes, prototypes, and high-fidelity designs',
      'Conduct user research and usability testing',
      'Build and maintain a scalable design system',
    ],
    requirements: [
      '3+ years of product or UX design experience',
      'Proficiency in Figma',
      'Portfolio demonstrating strong visual and interaction design',
      'Experience working in agile product teams',
    ],
    skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Usability Testing'],
    benefits: ['Fully remote', 'Equipment allowance', 'Flexible hours', 'Monthly team retreats'],
    postedDays: 2,
    applicants: 31,
    category: 'Design',
    match: 78,
    matchedSkills: ['Figma', 'Prototyping', 'Design Systems'],
    missingSkills: ['User Research', 'Usability Testing'],
  },
  {
    id: 'j3',
    title: 'Frontend Engineer',
    company: companies[2],
    location: 'Đà Nẵng',
    workType: 'Full-time',
    workStyle: 'On-site',
    level: 'Mid-level',
    salaryMin: 1500,
    salaryMax: 2500,
    currency: 'USD',
    description: 'Build fast, accessible, and beautiful user interfaces for a high-traffic e-commerce platform serving millions of customers across Southeast Asia.',
    responsibilities: [
      'Build and maintain React-based frontend applications',
      'Optimize performance and core web vitals',
      'Collaborate with design and backend teams',
      'Write clean, well-tested TypeScript code',
    ],
    requirements: [
      '2+ years of frontend development',
      'Strong React and TypeScript skills',
      'Experience with modern tooling (Vite, Webpack)',
      'Eye for detail and commitment to quality',
    ],
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'REST API'],
    benefits: ['Performance bonus', 'Lunch provided', 'Team building', 'Health insurance'],
    postedDays: 7,
    applicants: 62,
    category: 'Engineering',
    match: 85,
    matchedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'REST API'],
    missingSkills: ['Vite'],
  },
  {
    id: 'j4',
    title: 'Data Analyst',
    company: companies[4],
    location: 'Hà Nội',
    workType: 'Full-time',
    workStyle: 'Hybrid',
    level: 'Junior',
    salaryMin: 1000,
    salaryMax: 1800,
    currency: 'USD',
    description: 'Turn complex financial data into actionable insights that drive business decisions. Work with large datasets and present findings to stakeholders across the organization.',
    responsibilities: [
      'Collect, clean, and analyze large financial datasets',
      'Build dashboards and reports using BI tools',
      'Work with data engineering to improve pipelines',
      'Present insights to non-technical stakeholders',
    ],
    requirements: [
      '1–2 years of data analysis experience',
      'Proficiency in SQL and Excel',
      'Experience with Power BI or Tableau',
      'Strong analytical thinking',
    ],
    skills: ['SQL', 'Python', 'Power BI', 'Excel', 'Statistics'],
    benefits: ['Learning budget', 'Health insurance', 'Hybrid schedule', 'Stock options'],
    postedDays: 1,
    applicants: 23,
    category: 'Data',
    match: 70,
    matchedSkills: ['SQL', 'Python', 'Excel'],
    missingSkills: ['Power BI', 'Statistics'],
  },
  {
    id: 'j5',
    title: 'DevOps Engineer',
    company: companies[0],
    location: 'Remote',
    workType: 'Full-time',
    workStyle: 'Remote',
    level: 'Senior',
    salaryMin: 3000,
    salaryMax: 5000,
    currency: 'USD',
    description: 'Own the infrastructure and CI/CD systems that power our platform. Help the team ship faster and more reliably by building and maintaining world-class DevOps practices.',
    responsibilities: [
      'Design and maintain Kubernetes clusters and cloud infrastructure',
      'Build and improve CI/CD pipelines',
      'Monitor system health and lead incident response',
      'Implement security best practices across infrastructure',
    ],
    requirements: [
      '4+ years of DevOps or SRE experience',
      'Kubernetes, Terraform, and AWS expertise',
      'Strong scripting skills (Bash, Python)',
      'Experience with observability tools',
    ],
    skills: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'CI/CD', 'Python'],
    benefits: ['100% remote', 'Top-tier salary', 'Equipment budget', 'Conference talks'],
    postedDays: 5,
    applicants: 19,
    category: 'Engineering',
    match: 68,
    matchedSkills: ['Docker', 'Python', 'AWS'],
    missingSkills: ['Kubernetes', 'Terraform', 'CI/CD'],
  },
  {
    id: 'j6',
    title: 'Marketing Manager',
    company: companies[5],
    location: 'Đà Nẵng',
    workType: 'Full-time',
    workStyle: 'Hybrid',
    level: 'Mid-level',
    salaryMin: 1200,
    salaryMax: 2000,
    currency: 'USD',
    description: 'Lead marketing efforts for a fast-growing EdTech startup shaping education across Southeast Asia. Create compelling campaigns and build brand awareness.',
    responsibilities: [
      'Develop and execute digital marketing campaigns',
      'Manage social media channels and content calendar',
      'Analyze campaign performance and optimize ROI',
      'Coordinate with design and content teams',
    ],
    requirements: [
      '3+ years of digital marketing experience',
      'Experience with SEO, SEM, and paid social',
      'Strong written communication skills',
      'Data-driven mindset',
    ],
    skills: ['Digital Marketing', 'SEO', 'SEM', 'Content Strategy', 'Analytics'],
    benefits: ['Flexible schedule', 'Annual retreat', 'Health insurance', 'Growth opportunities'],
    postedDays: 3,
    applicants: 37,
    category: 'Marketing',
    match: 55,
    matchedSkills: ['Digital Marketing', 'SEO'],
    missingSkills: ['SEM', 'Content Strategy', 'Analytics'],
  },
];

export const candidates: Candidate[] = [
  {
    id: 'ca1',
    name: 'Nguyễn Minh Tuấn',
    avatar: 'MT',
    role: 'Backend Developer',
    location: 'Hà Nội',
    experience: 5,
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API', 'Redis'],
    education: "B.Sc. Computer Science — Hanoi University of Science",
    match: 94,
    matchedSkills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API'],
    missingSkills: ['Kubernetes'],
    status: 'Interview',
    appliedDate: '2024-01-15',
    about: 'Passionate backend developer with 5 years of experience building scalable systems. Loves clean code, open-source, and mentoring junior engineers.',
  },
  {
    id: 'ca2',
    name: 'Trần Thị Lan Anh',
    avatar: 'LA',
    role: 'Full-stack Engineer',
    location: 'Hồ Chí Minh',
    experience: 3,
    skills: ['Python', 'React', 'PostgreSQL', 'Docker', 'TypeScript'],
    education: 'B.Sc. Software Engineering — HCMUT',
    match: 87,
    matchedSkills: ['Python', 'PostgreSQL', 'Docker'],
    missingSkills: ['REST API', 'Redis'],
    status: 'Review',
    appliedDate: '2024-01-18',
    about: 'Full-stack engineer comfortable across the entire stack. Enjoys shipping products that users love.',
  },
  {
    id: 'ca3',
    name: 'Lê Đức Khải',
    avatar: 'DK',
    role: 'Backend Engineer',
    location: 'Đà Nẵng',
    experience: 4,
    skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Docker', 'gRPC', 'REST API'],
    education: 'B.Sc. Computer Science — Da Nang University',
    match: 81,
    matchedSkills: ['PostgreSQL', 'Docker', 'REST API'],
    missingSkills: ['Python', 'Django'],
    status: 'New',
    appliedDate: '2024-01-20',
    about: 'Go enthusiast with a strong systems background. Interested in distributed systems and cloud-native architecture.',
  },
  {
    id: 'ca4',
    name: 'Phạm Thu Hương',
    avatar: 'TH',
    role: 'Software Engineer',
    location: 'Hà Nội',
    experience: 6,
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API', 'Redis', 'Kubernetes'],
    education: 'M.Sc. Computer Science — VNU Hanoi',
    match: 98,
    matchedSkills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'REST API', 'Kubernetes'],
    missingSkills: [],
    status: 'Offer',
    appliedDate: '2024-01-10',
    about: 'Senior engineer with a track record of leading platform migrations and building reliable distributed systems.',
  },
  {
    id: 'ca5',
    name: 'Võ Hoàng Nam',
    avatar: 'HN',
    role: 'Backend Developer',
    location: 'Hồ Chí Minh',
    experience: 2,
    skills: ['Python', 'FastAPI', 'MySQL', 'Docker', 'REST API'],
    education: 'B.Sc. Computer Science — UEH',
    match: 74,
    matchedSkills: ['Python', 'Docker', 'REST API'],
    missingSkills: ['Django', 'PostgreSQL', 'Kubernetes'],
    status: 'New',
    appliedDate: '2024-01-22',
    about: 'Junior-to-mid developer with a passion for building APIs. Currently leveling up in system design.',
  },
];

export const pipelineCandidate: Candidate = {
  id: 'extra1',
  name: 'Bùi Thành Long',
  avatar: 'TL',
  role: 'Backend Engineer',
  location: 'Đà Nẵng',
  experience: 3,
  skills: ['Python', 'FastAPI', 'Docker'],
  education: 'B.Sc. IT — Da Nang',
  match: 79,
  matchedSkills: ['Python', 'Docker'],
  missingSkills: ['Django', 'PostgreSQL'],
  status: 'Hired',
  appliedDate: '2024-01-05',
  about: '',
};

export const applications: Application[] = [
  {
    id: 'app1',
    job: jobs[0],
    appliedDate: '2024-01-15',
    status: 'Interview',
    steps: ['Applied', 'Under Review', 'Interview'],
    interview: 'Jan 28, 2024 at 2:00 PM',
  },
  {
    id: 'app2',
    job: jobs[2],
    appliedDate: '2024-01-18',
    status: 'Under Review',
    steps: ['Applied', 'Under Review'],
  },
  {
    id: 'app3',
    job: jobs[1],
    appliedDate: '2024-01-10',
    status: 'Rejected',
    steps: ['Applied', 'Under Review', 'Rejected'],
  },
  {
    id: 'app4',
    job: jobs[3],
    appliedDate: '2024-01-22',
    status: 'Applied',
    steps: ['Applied'],
  },
];

export const categories = [
  { name: 'Engineering', count: 342, icon: 'code' },
  { name: 'Design', count: 128, icon: 'pen-tool' },
  { name: 'Marketing', count: 96, icon: 'megaphone' },
  { name: 'Data', count: 87, icon: 'chart' },
  { name: 'Product', count: 74, icon: 'boxes' },
  { name: 'Sales', count: 65, icon: 'briefcase' },
  { name: 'Finance', count: 53, icon: 'wallet' },
  { name: 'Operations', count: 41, icon: 'settings' },
];
