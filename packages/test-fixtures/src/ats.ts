import type { SourceDefinition } from "@internship-radar/core";

const ownerId = "40000000-0000-4000-8000-000000000004";

export const fixtureSources = {
  greenhouse: {
    id: 1, ownerId, ats: "greenhouse", boardIdentifier: "example-robotics",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/example-robotics/jobs", companyName: "Example Robotics",
  },
  lever: {
    id: 2, ownerId, ats: "lever", boardIdentifier: "example-autonomy",
    endpointUrl: "https://api.lever.co/v0/postings/example-autonomy", companyName: "Example Autonomy",
  },
  ashby: {
    id: 3, ownerId, ats: "ashby", boardIdentifier: "example-ai",
    endpointUrl: "https://api.ashbyhq.com/posting-api/job-board/example-ai", companyName: "Example AI",
  },
  workday: {
    id: 4, ownerId, ats: "workday", boardIdentifier: "ExampleCareers",
    endpointUrl: "https://example.wd5.myworkdayjobs.com/wday/cxs/example/ExampleCareers/jobs", companyName: "Example Dynamics",
  },
  smartrecruiters: {
    id: 5, ownerId, ats: "smartrecruiters", boardIdentifier: "ExampleLabs",
    endpointUrl: "https://api.smartrecruiters.com/v1/companies/ExampleLabs/postings", companyName: "Example Labs",
  },
  hosted_json: {
    id: 6, ownerId, ats: "hosted_json", boardIdentifier: "example-company-feed",
    endpointUrl: "https://careers.example.invalid/jobs.json", companyName: "Example Machines",
  },
  simplify: {
    id: 7, ownerId, ats: "simplify", boardIdentifier: "summer-2027",
    endpointUrl: "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json",
    companyName: "Community Feed",
  },
} satisfies Readonly<Record<string, SourceDefinition>>;

export const greenhousePayload = {
  jobs: [{
    id: 101,
    title: "Robotics Software Intern",
    absolute_url: "https://boards.greenhouse.io/example-robotics/jobs/101?gh_src=fixture",
    content: "<p>Build C++ controls for robots.</p>",
    location: { name: "Toronto, ON" },
    departments: [{ name: "Robotics" }],
    updated_at: "2026-08-21T12:00:00Z",
  }],
};

export const leverPayload = [{
  id: "lever-201",
  text: "Autonomy Engineering Intern",
  descriptionPlain: "Develop perception software for autonomous machines.",
  hostedUrl: "https://jobs.lever.co/example-autonomy/lever-201?lever-source=fixture",
  categories: { location: "Toronto, ON", commitment: "Intern", department: "Autonomy" },
  workplaceType: "hybrid",
}];

export const ashbyPayload = {
  apiVersion: "1",
  jobs: [{
    id: "ashby-301",
    title: "Embodied AI Intern",
    location: "Toronto, Canada",
    department: "Research",
    employmentType: "Intern",
    isListed: true,
    descriptionPlain: "Train and evaluate embodied AI systems.",
    publishedAt: "2026-08-20T12:00:00Z",
    jobUrl: "https://jobs.ashbyhq.com/example-ai/ashby-301",
  }],
};

export const workdayPayload = {
  total: 1,
  jobPostings: [{
    title: "Controls Engineering Internship",
    externalJobId: "WD-401",
    externalPath: "/job/Toronto-ON/Controls-Engineering-Internship_WD-401",
    locationsText: "Toronto, ON",
    postedOn: "2026-08-19T12:00:00Z",
    bulletFields: ["Work with C++", "Test robotic controls"],
  }],
};

export const smartRecruitersPayload = {
  limit: 100,
  offset: 0,
  totalFound: 1,
  content: [{
    id: "501",
    uuid: "50000000-0000-4000-8000-000000000005",
    name: "Machine Learning Intern",
    releasedDate: "2026-08-18T12:00:00Z",
    location: { city: "Toronto", region: "ON", country: "ca", remote: false },
    department: { id: "ai", label: "Artificial Intelligence" },
    typeOfEmployment: { id: "intern", label: "Intern" },
  }],
};

export const hostedJsonPayload = {
  jobs: [{
    id: "hosted-601",
    title: "Mechatronics Intern",
    url: "https://careers.example.invalid/jobs/hosted-601?utm_source=fixture",
    description: "<p>Prototype and test robotic mechanisms.</p>",
    location: "Toronto, Ontario",
    department: "Hardware",
    employmentType: "Internship",
    postedAt: "2026-08-17T12:00:00Z",
  }],
};

export const simplifyPayload = [{
  company_name: "Example Community Company",
  locations: ["Toronto, ON"],
  title: "Software Engineering Intern",
  date_posted: 1787414400,
  terms: ["Summer 2027"],
  active: true,
  url: "https://jobs.example.invalid/community-701?utm_source=github",
}];
