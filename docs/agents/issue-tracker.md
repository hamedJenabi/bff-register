# Issue tracker: Local docs and commits

This repo currently does not use an issue tracker for PRDs or implementation tasks. Work locally, capture decisions in repo documents, and commit only after explicit user approval.

## Conventions

- **PRDs**: Write PRDs under `docs/prd/`.
- **Handoffs**: Write handoff documents to the OS temporary directory, per the handoff skill.
- **Task slicing**: Capture local task slices in the PRD or a follow-up local plan document.
- **Commits**: Before staging or committing, summarize the intended changes and ask the user for approval. Do not commit without approval.
- **Remote issue publishing**: Do not create GitHub Issues unless the user explicitly changes the workflow.

## Pull requests as a triage surface

**PRs as a request surface: no.**

PRs are treated as code review artifacts, not as incoming feature requests for triage.

## When a skill says "publish to the issue tracker"

Write or update the appropriate local artifact instead. For PRDs, use `docs/prd/`.

## When a skill says "fetch the relevant ticket"

There is no ticket to fetch unless a future workflow introduces one. Read the local PRD, handoff, or plan document instead.
