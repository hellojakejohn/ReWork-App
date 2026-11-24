// "Who's job hunting?" picker on the landing and its /for/[slug] pages. Each group gets its own
// hard parts, an example rewrite (same facts, the job's words) and questions in their own voice.
// Examples are illustrations: every number in "after" is already in "before".

export interface AudienceFaq {
  q: string
  a: string
}

export interface Audience {
  slug: string
  /** Tile label on the landing picker. */
  label: string
  /** One line under the tile label. */
  hook: string
  title: string
  description: string
  intro: string
  /** What's hard for them, and what ReWork does about it. */
  hard: { pain: string; answer: string }[]
  example: { job: string; before: string; after: string; why: string }
  faqs: AudienceFaq[]
  /** Extra reading for this group only. */
  more?: { href: string; label: string }[]
}

export const AUDIENCES: Audience[] = [
  {
    slug: "new-grads",
    label: "Students and new grads",
    hook: "Thin resume, every posting wants experience.",
    title: "Your first real job, with the resume you actually have",
    description: "Turn class projects, internships and part-time jobs into a resume that fits each posting, without padding it. Find entry-level jobs that fit, free.",
    intro:
      "Every entry-level posting seems to want two years of experience. You have projects, an internship, maybe a campus job. ReWork shows the open jobs your resume really fits, then says what you did in each job's own words.",
    hard: [
      { pain: "\"Entry level, 2+ years required.\"", answer: "Your matches are ranked by fit and flag senior roles, so you spend applications where you have a real shot." },
      { pain: "Projects and internships feel like they don't count.", answer: "The tailor treats them like work: what you built, with what, and what happened, in the words the posting uses." },
      { pain: "You don't know which skills you're missing.", answer: "The free fit check lists the skills you have, the ones you show in other words, and the ones you'd need to learn." },
    ],
    example: {
      job: "Junior Data Analyst",
      before: "Did a class project analyzing campus dining survey data (400 responses) in Python and made charts for the dining office.",
      after: "Analyzed 400 campus dining survey responses in Python and built charts for the dining office.",
      why: "Leads with the analysis and the 400 responses, the two things an analyst posting screens for.",
    },
    faqs: [
      { q: "My resume is basically empty. Is this even worth it?", a: "Yes. Thin resumes gain the most from saying things well. ReWork works with what's there: classes, projects, internships, clubs and part-time jobs. It won't invent experience to fill space." },
      { q: "Will it make my internship sound like a full-time job?", a: "No. Titles, dates and employers stay exactly as you wrote them. It changes how you describe the work, not what the work was." },
      { q: "I'm an international student. Can it help with sponsorship?", a: "Turn on \"I'll need visa sponsorship\" in Settings and your matches show what each post says about sponsorship and the employer's H-1B record." },
    ],
    more: [
      { href: "/visa-sponsorship-jobs", label: "How to find jobs that sponsor visas" },
      { href: "/opt-unemployment-days", label: "OPT unemployment days, explained" },
    ],
  },
  {
    slug: "career-changers",
    label: "Career changers",
    hook: "Real experience, wrong job titles.",
    title: "Changing careers without starting over",
    description: "Restaurant manager to operations, teacher to training, retail to sales: ReWork finds the jobs your real experience fits and says it in the new field's words.",
    intro:
      "You've run shifts, budgets, teams or classrooms. The new field calls the same work by different names, and your old titles get you filtered out. ReWork finds the overlap and says it in their words, without pretending you held a job you didn't.",
    hard: [
      { pain: "Recruiters see your old title and move on.", answer: "Your summary and bullets lead with the skills the new job asks for, so the overlap is the first thing they read." },
      { pain: "You don't know which jobs you're closest to.", answer: "Your matches rank open jobs by how well your resume really fits, including skills you show in other words." },
      { pain: "Every guide says to \"reframe,\" which feels like lying.", answer: "Reframing here means new words for the same facts. Every rewrite is checked against your original: no new titles, tools or numbers." },
    ],
    example: {
      job: "Operations Coordinator",
      before: "Restaurant general manager. Ran schedules for 35 staff, handled ordering and cut food waste 18% by changing how we tracked inventory.",
      after: "Managed scheduling for a 35-person team, ran purchasing, and cut waste 18% by redesigning inventory tracking.",
      why: "Same facts, in operations words: scheduling, purchasing, inventory tracking.",
    },
    faqs: [
      { q: "Will it hide that I worked in a restaurant?", a: "No. Your employers and titles stay as they are. It makes the parts that matter to the new job easy to see." },
      { q: "What if I'm missing skills the job wants?", a: "You'll see them listed as missing, not quietly added. If you do have one and it's just not on your resume, the skill check asks where you used it and adds only what you tell it." },
      { q: "Can't I just ask ChatGPT to reword it?", a: "You can, and it will often add a tool you never used or a number you never hit. ReWork checks every rewrite against your real resume before you see it." },
    ],
  },
  {
    slug: "tech",
    label: "Software and tech",
    hook: "Hundreds of applicants, keyword filters.",
    title: "Tech job hunting without the keyword guessing",
    description: "See which of your skills each tech job screens for, get matched to open jobs from company boards, and tailor your resume to the stack in the posting. Nothing invented.",
    intro:
      "Tech postings pull hundreds of applicants and screen hard on the stack. ReWork reads each posting's requirements, shows which ones your resume already covers, and tailors your bullets to say them in the posting's words. It never adds a language or framework you didn't list.",
    hard: [
      { pain: "Every posting lists a different stack.", answer: "The job match shows exact matches, things you show in other words, and what's missing, weighted by how much the posting cares." },
      { pain: "Job boards are full of reposts and ghost jobs.", answer: "Matches come straight from employers' own boards, checked daily, so closed jobs drop off." },
      { pain: "AI resume tools add tech you've never touched.", answer: "A fact guard in code removes any tool, employer, title or number that isn't in your original." },
    ],
    example: {
      job: "Backend Engineer (Node.js, PostgreSQL)",
      before: "Built the API for our scheduling app in Node and Postgres. Rewrote slow queries so the main page loaded in 300ms instead of 2s.",
      after: "Built a Node.js and PostgreSQL API for a scheduling app; rewrote slow queries to cut main page load from 2s to 300ms.",
      why: "Names the stack the way the posting does and keeps the before-and-after numbers.",
    },
    faqs: [
      { q: "Will it add keywords I don't have to beat the filter?", a: "No. That's the one thing it won't do. Missing keywords are shown to you as missing. If you really have one, the skill check asks where you used it." },
      { q: "Does it work for senior roles?", a: "Yes. Your matches note when a role's level doesn't fit your years, in both directions." },
      { q: "Which job sites does it pull from?", a: "Employers' own boards: Greenhouse, Lever, Ashby, SmartRecruiters and Workday. You can also paste any job link." },
    ],
  },
  {
    slug: "hourly-to-salaried",
    label: "Hourly to salaried",
    hook: "You've done the work, now get the title.",
    title: "From hourly work to a salaried role",
    description: "Retail, warehouse, food service, call center: ReWork finds the office and salaried jobs your real experience fits and tailors your resume to each one.",
    intro:
      "Shift leads train people. Warehouse leads hit numbers. Call center reps handle the hardest customers. That's the work salaried jobs ask for, but hourly resumes rarely say it that way. ReWork does, using only what you actually did.",
    hard: [
      { pain: "Your resume lists duties, not results.", answer: "The evidence interview asks for the real numbers behind your work, then uses only what you give it." },
      { pain: "You're not sure which office jobs you'd qualify for.", answer: "Your matches rank open jobs by real fit, so you can see which ones your experience already covers." },
      { pain: "Applying takes forever.", answer: "Each job gets a tailored resume, a cover letter and answers to the application questions, ready to copy in." },
    ],
    example: {
      job: "Customer Success Associate",
      before: "Call center rep, about 60 calls a day. Handled escalations and trained 5 new hires on the system.",
      after: "Handled about 60 customer calls a day, owned escalations, and trained 5 new hires on the system.",
      why: "Puts volume, escalations and training first, the parts a customer success team hires for.",
    },
    faqs: [
      { q: "My jobs were just jobs. Is there anything to work with?", a: "Almost always. Volume, accuracy, training others, handling hard customers: the tailor finds those in what you wrote and the evidence interview asks for the rest." },
      { q: "Will it make me sound like I was a manager?", a: "No. Titles stay exactly as you wrote them. If you trained or led people, it says so, in plain words." },
      { q: "Is it free?", a: "You get your top job matches and a few tailors a month free, no card needed." },
    ],
  },
]

export const audienceBySlug = (slug: string): Audience | undefined => AUDIENCES.find((a) => a.slug === slug)
