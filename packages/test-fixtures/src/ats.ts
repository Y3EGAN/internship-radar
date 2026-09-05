import type { SourceDefinition } from "@internship-radar/core";

const ownerId = "40000000-0000-4000-8000-000000000004";

export const fixtureSources = {
  greenhouse: {
    id: 1, ownerId, ats: "greenhouse", boardIdentifier: "example-robotics",
    renderMode: "http",
    endpointUrl: "https://boards-api.greenhouse.io/v1/boards/example-robotics/jobs", companyName: "Example Robotics",
  },
  lever: {
    id: 2, ownerId, ats: "lever", boardIdentifier: "example-autonomy",
    renderMode: "http",
    endpointUrl: "https://api.lever.co/v0/postings/example-autonomy", companyName: "Example Autonomy",
  },
  ashby: {
    id: 3, ownerId, ats: "ashby", boardIdentifier: "example-ai",
    renderMode: "http",
    endpointUrl: "https://api.ashbyhq.com/posting-api/job-board/example-ai", companyName: "Example AI",
  },
  workday: {
    id: 4, ownerId, ats: "workday", boardIdentifier: "ExampleCareers",
    renderMode: "http",
    endpointUrl: "https://example.wd5.myworkdayjobs.com/wday/cxs/example/ExampleCareers/jobs", companyName: "Example Dynamics",
  },
  smartrecruiters: {
    id: 5, ownerId, ats: "smartrecruiters", boardIdentifier: "ExampleLabs",
    renderMode: "http",
    endpointUrl: "https://api.smartrecruiters.com/v1/companies/ExampleLabs/postings", companyName: "Example Labs",
  },
  hosted_json: {
    id: 6, ownerId, ats: "hosted_json", boardIdentifier: "example-company-feed",
    renderMode: "http",
    endpointUrl: "https://careers.example.invalid/jobs.json", companyName: "Example Machines",
  },
  simplify: {
    id: 7, ownerId, ats: "simplify", boardIdentifier: "summer-2027",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/simplify/listings.json",
    companyName: "Community Feed",
  },
  canadianSecondary: {
    id: 8, ownerId, ats: "secondary", boardIdentifier: "canadian-tech-internships-2027",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/canadian/README.md", companyName: "Canadian Community Feed",
  },
  vanshSecondary: {
    id: 9, ownerId, ats: "secondary", boardIdentifier: "vansh-summer-2027",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/vansh/README.md", companyName: "Vansh Community Feed",
  },
  speedyUsaSecondary: {
    id: 10, ownerId, ats: "secondary", boardIdentifier: "speedyapply-2027-intern-usa",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/speedy/README.md", companyName: "Speedy Community Feed",
  },
  speedyInternationalSecondary: {
    id: 11, ownerId, ats: "secondary", boardIdentifier: "speedyapply-2027-intern-intl",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/speedy/INTERN_INTL.md", companyName: "Speedy Community Feed",
  },
  zapplySecondary: {
    id: 12, ownerId, ats: "secondary", boardIdentifier: "zapply-canada-2027",
    renderMode: "http",
    endpointUrl: "https://raw.example.invalid/zapply/README.md", companyName: "Zapply Community Feed",
  },
  careerPage: {
    id: 13, ownerId, ats: "career_page", boardIdentifier: "example-careers",
    renderMode: "browser",
    endpointUrl: "https://careers.example.invalid/jobs", companyName: "Example Careers",
  },
} satisfies Readonly<Record<string, SourceDefinition>>;

export const careerPageJsonLdPayload = `
<html><head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "  Software Engineering Intern  ",
      "url": "https://jobs.example.invalid/roles/eng-101?utm_source=fixture",
      "identifier": { "@type": "PropertyValue", "value": "ENG-101" },
      "description": "<p>Build reliable systems.</p>",
      "datePosted": "2026-09-01",
      "validThrough": "2026-10-01T23:59:59-04:00",
      "employmentType": "INTERN",
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Toronto",
          "addressRegion": "ON",
          "addressCountry": "CA"
        }
      }
    }
  </script>
</head><body></body></html>`;

export const careerPageGraphPayload = `
<html><head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": ["Thing", "JobPosting"], "title": "Data Science Co-op", "url": "https://jobs.example.invalid/roles/data-201" },
        { "@type": "JobPosting", "title": "Robotics Internship", "url": "https://jobs.example.invalid/roles/robotics-202" }
      ]
    }
  </script>
</head><body></body></html>`;

export const careerPageAnchorPayload = `
<html><body>
  <a href="/roles/student-301?utm_source=careers">Student Placement — Platform</a>
  <a href="https://jobs.example.invalid/roles/full-time">Senior Platform Engineer</a>
</body></html>`;

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

export const canadianSecondaryPayload = `
| Company | Role | Location | Apply | Date Posted |
|---|---|---|---|---|
| Example Robotics | Controls Software Intern | Toronto, ON | [![Apply](https://images.example.invalid/apply.png)](https://jobs.example.invalid/robotics/801?utm_source=community) | Aug 27, 2026 |
| ↳ | Perception Co-op | Remote, Canada | [Apply](https://jobs.example.invalid/robotics/802) | Aug 26, 2026 |
| Example Closed | Systems Intern | Vancouver, BC | Closed🔒 | Aug 20, 2026 |
`;

export const vanshSecondaryPayload = `
| Company | Role | Location | Application/Link | Date Posted |
|---|---|---|---|---|
| Example Machines | Autonomy Intern | Austin, TX | <a href="https://careers.example.invalid/jobs/901?utm_source=github"><img src="https://images.example.invalid/apply.png"></a> | Aug 21 |
| ↳ | Platform Intern | Remote - United States | <a href="https://careers.example.invalid/jobs/902"><img src="https://images.example.invalid/apply.png"></a> | Aug 20 |
`;

export const speedySecondaryPayload = `
| Company | Position | Location | Posting | Age |
|---|---|---|---|---|
| <a href="https://company.example.invalid"><strong>Example Computing</strong></a> | GPU Software Intern | Seattle, WA | <a href="https://apply.example.invalid/jobs/1001"><img src="https://images.example.invalid/apply.png"></a> | 2d |
`;

export const zapplySecondaryPayload = `
| Company | Role | Location | Posted | Visa | **Apply** |
|---|---|---|---|---|---|
| **Example Dynamics** | Embedded Software Co-op | Montreal, QC, CAN | 13m | | [<img src="images/apply.png">](https://work.example.invalid/jobs/1101?ref=community) |
`;
