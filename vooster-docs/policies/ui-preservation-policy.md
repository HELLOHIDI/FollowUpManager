# UI Preservation Policy

Applies to every feature, bug fix, preview, and release that touches this product.

## 1. Production is the baseline

- Start from the commit deployed at the production alias, not merely the latest remote branch.
- Record the baseline commit, production URL, and the routes being changed in the PR description before editing.
- If the production commit cannot be identified, do not create a preview or PR that changes existing UI.

## 2. Change only the approved surface

- List the allowed routes and UI files before implementation.
- Existing layouts, navigation order, labels, and component placement outside that list are preservation targets.
- A change to an existing screen needs explicit product approval even when it supports a new feature. New capability should use a new route or local entry point when possible.

## 3. Preview gate

Before sharing a preview:

1. Compare `production baseline...feature branch` and confirm every changed UI file is on the allowed list.
2. Open each preserved route in production and preview at the same viewport and compare its visible structure and navigation order.
3. Verify each changed route works, then state the baseline commit, changed routes, and comparison result in the PR.

Do not call a preview ready if an unrelated UI difference is found.

## 4. Recovery

- Stop the rollout when an unrelated UI difference is discovered.
- Remove the unrelated diff first; do not explain it away as a branch or deployment difference.
- Re-run the preview gate before requesting review or deployment.
