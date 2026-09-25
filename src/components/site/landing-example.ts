// The landing page's before/after example. Built from the eval fixture
// scripts/fixtures/restaurant-manager-to-ops-coordinator.json and laid out the way the
// Result card shows a tailor: rewritten bullets with a reason each, the fact check, and
// the posting's keywords that weren't added because the resume doesn't support them.
//
// Rule for editing this: every number and claim on the "after" side must already be on
// the "before" side. No invented metrics.
export const LANDING_EXAMPLE = {
  person: 'Marcus, restaurant general manager',
  job: 'Operations Coordinator at a property management company',
  summary: {
    before: 'Restaurant general manager with 6 years of experience running high-volume dining rooms, leading teams, and keeping costs in line.',
    after:
      'General manager with 6 years of experience coordinating vendors, schedules and a team of 28 in high-volume restaurants, and keeping costs in line.',
  },
  bullets: [
    {
      before: 'Ran weekly inventory and ordering with 5 food and beverage vendors',
      after: 'Coordinated weekly inventory and reordering across 5 food and beverage vendors',
      why: 'The posting asks for vendor management and keeping supplies stocked.',
    },
    {
      before: 'Built weekly labor and sales reports in Google Sheets for the owners',
      after: 'Prepared weekly labor and sales reports in Google Sheets for ownership',
      why: 'Matches "prepare weekly reports in Excel/Google Sheets".',
    },
    {
      before: 'Handled guest complaints and escalations, keeping reviews at 4.6 stars',
      after: 'Resolved guest escalations professionally while keeping reviews at 4.6 stars',
      why: 'The role handles resident escalations.',
    },
  ],
  factsKept: ['6 years', 'team of 28', '5 vendors', '4.6 stars'],
  notAdded: ['work order systems', 'property management', 'budget ownership'],
}
