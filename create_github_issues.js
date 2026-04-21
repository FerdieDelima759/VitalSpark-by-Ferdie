const fs = require('fs');

// Usage: node create_github_issues.js <GITHUB_TOKEN> <OWNER/REPO>
// Example: node create_github_issues.js ghp_xxx123 Ferdie/VitalSpark

const token = process.argv[2];
const repo = process.argv[3];

if (!token || !repo) {
  console.error("Missing arguments. Usage: node create_github_issues.js <GITHUB_TOKEN> <OWNER/REPO>");
  process.exit(1);
}

const issues = [
  {
    title: "Issue #1 — Fix Supabase Service Key Exposure",
    body: "Priority: 🔴 Critical\n\nDescription:\nService role key is exposed via NEXT_PUBLIC_SUPABASE_SERVICE_KEY, allowing full DB access from client.\n\nTasks:\n- [ ] Remove NEXT_PUBLIC_ prefix from service key\n- [ ] Move admin logic to server-only (API routes)\n- [ ] Rotate Supabase keys\n- [ ] Audit all env variables\n- [ ] Verify no sensitive keys in client bundle\n\nAcceptance Criteria:\n- No service key visible in browser dev tools\n- All admin operations run server-side only",
    labels: ["critical", "security"]
  },
  {
    title: "Issue #2 — Align WorkoutSession Schema",
    body: "Priority: 🔴 Critical\n\nDescription:\nFrontend and mobile schemas for WorkoutSession are mismatched.\n\nTasks:\n- [ ] Compare frontend vs mobile types\n- [ ] Add missing day_plan_id where needed\n- [ ] Normalize response structures\n- [ ] Update Supabase schema if needed\n\nAcceptance Criteria:\n- Both apps use identical session structure\n- No runtime type errors",
    labels: ["infra"]
  },
  {
    title: "Issue #3 — Add Missing UserWorkoutSession Type",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Add UserWorkoutSession to frontend\n- [ ] Ensure compatibility with mobile\n- [ ] Update API usage\n\nAcceptance Criteria:\n- Type exists and used consistently",
    labels: ["infra"]
  },
  {
    title: "Issue #4 — Validate All Data Persistence Flows",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Test workout plan save\n- [ ] Test session save\n- [ ] Test meal plan save\n- [ ] Fix any broken Supabase writes\n\nAcceptance Criteria:\n- All flows persist correctly without failure",
    labels: ["infra"]
  },
  {
    title: "Issue #5 — Fix UserProvider Integration",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Ensure user session restores\n- [ ] Sync profile correctly\n- [ ] Handle logout/expiration\n\nAcceptance Criteria:\n- User stays logged in properly across sessions",
    labels: ["infra"]
  },
  {
    title: "Issue #6 — Complete Mobile Onboarding Flow",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Implement all onboarding steps\n- [ ] Persist progress\n- [ ] Resume incomplete onboarding\n\nAcceptance Criteria:\n- User can complete onboarding end-to-end",
    labels: ["feature"]
  },
  {
    title: "Issue #7 — Fix Mobile Navigation Structure",
    body: "Priority: 🟡 Medium\n\nTasks:\n- [ ] Implement tab navigation\n- [ ] Fix broken routes\n- [ ] Ensure deep linking works\n\nAcceptance Criteria:\n- All main screens accessible and stable",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #8 — Add Global Loading + Error States",
    body: "Priority: 🟡 Medium\n\nTasks:\n- [ ] Add loading skeletons\n- [ ] Add retry logic\n- [ ] Add error fallback UI\n\nAcceptance Criteria:\n- No blank or broken screens",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #9 — Define Subscription Entitlements",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Define free vs premium features\n- [ ] Document gating logic",
    labels: ["feature"]
  },
  {
    title: "Issue #10 — Build Paywall Screen",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Design pricing UI\n- [ ] Show monthly/yearly options\n- [ ] Highlight best value",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #11 — Implement Subscription Logic",
    body: "Priority: 🔴 Critical\n\nTasks:\n- [ ] Integrate Stripe or RevenueCat\n- [ ] Handle purchase flow\n- [ ] Handle restore purchases",
    labels: ["feature"]
  },
  {
    title: "Issue #12 — Replace All Upgrade TODOs",
    body: "Priority: 🔴 Critical\n\nTasks:\n- [ ] Find all // TODO upgrade\n- [ ] Connect to paywall",
    labels: ["bug"]
  },
  {
    title: "Issue #13 — Implement Feature Gating",
    body: "Priority: 🟠 High\n\nTasks:\n- [ ] Lock premium features\n- [ ] Handle expired subscriptions",
    labels: ["feature"]
  },
  {
    title: "Issue #14 — Refactor Workout Prompt System",
    body: "Priority: 🔴 Critical",
    labels: ["feature"]
  },
  {
    title: "Issue #15 — Add Workout Output Validation",
    body: "Priority: 🔴 Critical\n\nTasks:\n- [ ] Validate sets/reps/rest\n- [ ] Prevent invalid exercises",
    labels: ["feature"]
  },
  {
    title: "Issue #16 — Normalize Exercise Naming",
    body: "Priority: 🟠 High",
    labels: ["infra"]
  },
  {
    title: "Issue #17 — Implement Regeneration Logic",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #18 — Ensure Plan Save Integrity",
    body: "Priority: 🔴 Critical",
    labels: ["infra"]
  },
  {
    title: "Issue #19 — Optimize Generation Performance",
    body: "Priority: 🟡 Medium",
    labels: ["performance"]
  },
  {
    title: "Issue #20 — Build Session State Machine",
    body: "Priority: 🔴 Critical",
    labels: ["feature"]
  },
  {
    title: "Issue #21 — Implement Timer System",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #22 — Integrate TTS Audio",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #23 — Design Session UI",
    body: "Priority: 🟠 High",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #24 — Save Workout Session Progress",
    body: "Priority: 🔴 Critical",
    labels: ["infra"]
  },
  {
    title: "Issue #25 — Add Resume Session Feature",
    body: "Priority: 🟡 Medium",
    labels: ["feature"]
  },
  {
    title: "Issue #26 — Build Exercise Image Mapping System",
    body: "Priority: 🔴 Critical",
    labels: ["feature"]
  },
  {
    title: "Issue #27 — Replace Generic Fallback Images",
    body: "Priority: 🟡 Medium",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #28 — Ensure Image Coverage",
    body: "Priority: 🟡 Medium",
    labels: ["feature"]
  },
  {
    title: "Issue #29 — Define AI Coach Persona",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #30 — Build AI Coach Chat UI",
    body: "Priority: 🟠 High",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #31 — Add Context-Aware AI Responses",
    body: "Priority: 🔴 Critical",
    labels: ["feature"]
  },
  {
    title: "Issue #32 — Fix Meal Plan Generation",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #33 — Link Meals to Workout Plans",
    body: "Priority: 🟠 High",
    labels: ["infra"]
  },
  {
    title: "Issue #34 — Add Meal Regeneration",
    body: "Priority: 🟡 Medium",
    labels: ["feature"]
  },
  {
    title: "Issue #35 — Build Meditation Generator",
    body: "Priority: 🟡 Medium",
    labels: ["feature"]
  },
  {
    title: "Issue #36 — Add Meditation UI + Playback",
    body: "Priority: 🟡 Medium",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #37 — Build Progress Tracking Dashboard",
    body: "Priority: 🟠 High",
    labels: ["feature"]
  },
  {
    title: "Issue #38 — Remove Artificial Delays",
    body: "Priority: 🟡 Medium",
    labels: ["performance"]
  },
  {
    title: "Issue #39 — Improve Error Handling System",
    body: "Priority: 🟠 High",
    labels: ["infra"]
  },
  {
    title: "Issue #40 — Improve Loading UX",
    body: "Priority: 🟡 Medium",
    labels: ["ui/ux"]
  },
  {
    title: "Issue #41 — Full App QA Testing",
    body: "Priority: 🔴 Critical",
    labels: ["testing"]
  },
  {
    title: "Issue #42 — Launch Preparation",
    body: "Priority: 🔴 Critical\n\nTasks:\n- [ ] Fix critical bugs\n- [ ] Verify production env\n- [ ] Deploy to Vercel / mobile build\n- [ ] Smoke test app",
    labels: ["release"]
  }
];

async function createIssues() {
  for (const issue of issues) {
    console.log(`Creating issue: ${issue.title}...`);
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: issue.title,
          body: issue.body,
          labels: issue.labels
        })
      });

      // Pause briefly to avoid hitting rate limits too quickly
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create issue: ${issue.title}. Status: ${response.status} ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`✅ Created: ${data.html_url}`);
      }
    } catch (err) {
      console.error(`Error creating issue: ${err.message}`);
    }
  }
}

createIssues();
