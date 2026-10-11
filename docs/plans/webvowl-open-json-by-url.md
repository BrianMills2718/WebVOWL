---
schema_version: "1.0"
artifact_type: design_plan
id: webvowl-open-json-by-url
plan_id: webvowl-open-json-by-url
status: proposed
planning_path: requested
method_conformance_receipt: docs/plans/webvowl-open-json-by-url.receipt.json
trace_review_criteria:
  - criterion_id: outcome
    expected_outcome: pass
goal:
  outcome: "On a static host with no OWL2VOWL converter, #url=<WebVOWL JSON URL> loads that JSON directly, and JSON files whose element ids are numbers (the O2A export) render instead of crashing. One agent, one branch, no shared mechanism: this plan adds no coordinated-work ceremony"
  canonical_example: "http://127.0.0.1:8797/#opts=doc=0;#url=http://127.0.0.1:8796/explorer/views/o2a-webvowl.json renders 30 O2A relation classes and 183 role nodes."
  forbidden_substitutes: "claiming success from a check's last line or exit status alone; a change outside the listed files; a commit without the saved check output"
  boundaries: "only these files: src/app/js/loadingModule.js, src/webvowl/js/graph.js; no irreversible action and no spend; Brian's request as quoted is the scope"
  done_when: "node --test tests/*.cjs passes (71 tests) and grunt release builds; in a real browser (Playwright, observation-to-action-metamodel explorer/compare-e2e.cjs) the #url= load of the O2A export draws every exported relation label and exactly one role node per exported role spoke (183 of 183), with no console errors other than the documented OWL2VOWL serverTimeStamp 404; before the change the same URL showed 0 nodes and the page error 'currentId.indexOf is not a function'. The check output with those counts is saved in docs/plans/webvowl-open-json-by-url.check.txt. The check's full output is committed as docs/plans/webvowl-open-json-by-url.check.txt, and the commit is tagged [Goal webvowl-open-json-by-url] with an Asked: line quoting the request."
  do_not_gate_on: "Brian's review of the plan page; work outside the listed files"
---

# WebVOWL fork opens an exported WebVOWL JSON file by URL without the OWL2VOWL service

## When a run fails or surprises us

Preserve the failed check and its execution trace id. Before selecting a fix,
read the complete inputs, prompts, tool arguments/results, intermediate stages
and final output, including the full check command/output and the changed files.
Cite the observed divergence and classify evidence absent, returned but unused
or contradicted, invalid expectation, or unresolved. Investigate an unresolved
cause before authorizing a causal repair. Bind the targeted repair to a new
traced verification run; retain the failed original. Review every failing or
surprising item and a sample of passes. A complete review is distinct from a
passing run. Criterion `outcome` covers the entire requested success check.

## Actor and result

**Actor:** Brian, who asked for this change.

**Request (verbatim):** Brian 2026-10-10 "give this a webvowl view or just reuse the scientific hypergraph ui. actually both so i can compare"

**Desired result:** On a static host with no OWL2VOWL converter, #url=<WebVOWL JSON URL> loads that JSON directly, and JSON files whose element ids are numbers (the O2A export) render instead of crashing. One agent, one branch, no shared mechanism: this plan adds no coordinated-work ceremony.

**Stable example:** http://127.0.0.1:8797/#opts=doc=0;#url=http://127.0.0.1:8796/explorer/views/o2a-webvowl.json renders 30 O2A relation classes and 183 role nodes.

## Authority and non-goals

**Authority:** Brian asked for this change in his own repository; one agent makes it.

**Non-goals:** nothing outside the files listed under Vertical and reset. No irreversible action and no spend.

## Requirements

| Id | Requirement | Source | Check | Status |
| --- | --- | --- | --- | --- |
| R1 | On a static host with no OWL2VOWL converter, #url=<WebVOWL JSON URL> loads that JSON directly, and JSON files whose element ids are numbers (the O2A export) render instead of crashing. One agent, one branch, no shared mechanism: this plan adds no coordinated-work ceremony. | asked: Brian 2026-10-10 "give this a webvowl view or just reuse the scientific hypergraph ui. actually both so i can compare" | the success check under Success and disproof, its output saved as `docs/plans/webvowl-open-json-by-url.check.txt` | planned, not yet run |
| R2 | Existing presets still load | stated with the request | Playwright opens the default foaf preset and sees nodes | planned, not yet run |
| R3 | Failure review is separate from the anticipated failure modes under disproof: a failing or surprising item is quoted from the saved check output and console log before a fix, the failed run is kept, and an unresolved diagnosis never authorizes a causal repair | stated with the request | the check file lists each reviewed item | planned, not yet run |

Requirements the change's own claims imply are listed above as R2 onward.

## Success and disproof

**Success evidence:** node --test tests/*.cjs passes (71 tests) and grunt release builds; in a real browser (Playwright, observation-to-action-metamodel explorer/compare-e2e.cjs) the #url= load of the O2A export draws every exported relation label and exactly one role node per exported role spoke (183 of 183), with no console errors other than the documented OWL2VOWL serverTimeStamp 404; before the change the same URL showed 0 nodes and the page error 'currentId.indexOf is not a function'. The check output with those counts is saved in docs/plans/webvowl-open-json-by-url.check.txt.

**Trace review:** the run whose full trace is judged is the success check above, run once on the commit that makes the change; no model, agent or LLM pipeline runs under this plan. Where the trace lives: the check's complete output, with the exact command and its exit status, is saved as `docs/plans/webvowl-open-json-by-url.check.txt` and committed with the change. What must be seen in it beyond the final result: the command ran against the files listed under Vertical and reset at that commit, each check or test it reports appears by name with its result and none is skipped, and the exit status matches; for each model element listed under System model, the output shows what that line says. Success and disproof are both judged from that file.

**Disproof:** The #url= load shows no graph, a relation or role node is missing, a non-404 console error appears, or an existing preset ontology (foaf) stops loading.

## System model

System model: exempt -- WebVOWL is a static client-side viewer with no stored state; this change alters only how one URL parameter fetches its input file and how element ids are read

## Capability reuse

Checked against the capability catalogue in agentic-capability-architecture-canonical (`reuse_candidates.yml` and `capability_registry.yml`):

- No catalogue entry fits, because the need is a loading fix inside this specific forked viewer, which has no catalogue entry

## Uncertainties

| Uncertainty | Owner or resolving evidence |
| --- | --- |
| Whether the change needs files beyond the list below; if so it is out of scope for this plan | Resolved before editing: git status --short in the worktree shows only src/app/js/loadingModule.js and src/webvowl/js/graph.js modified (package-lock.json from npm install is not committed) |

## Vertical and reset

One vertical over these files (and the saved check output, `docs/plans/webvowl-open-json-by-url.check.txt`):

- `src/app/js/loadingModule.js`
- `src/webvowl/js/graph.js`

The vertical delivers: On a static host with no OWL2VOWL converter, #url=<WebVOWL JSON URL> loads that JSON directly, and JSON files whose element ids are numbers (the O2A export) render instead of crashing. One agent, one branch, no shared mechanism: this plan adds no coordinated-work ceremony. It is done when this holds: node --test tests/*.cjs passes (71 tests) and grunt release builds; in a real browser (Playwright, observation-to-action-metamodel explorer/compare-e2e.cjs) the #url= load of the O2A export draws every exported relation label and exactly one role node per exported role spoke (183 of 183), with no console errors other than the documented OWL2VOWL serverTimeStamp 404; before the change the same URL showed 0 nodes and the page error 'currentId.indexOf is not a function'. The check output with those counts is saved in docs/plans/webvowl-open-json-by-url.check.txt.

Make the change, run the success check, commit. Reset: `git revert` of the commit. Not pursued: anything outside these files.

## Activation facts

No shared mechanism, no comparison, no LLM at the centre, no irreversible action or spend, and no claim to follow an external standard: a bounded change Brian asked for.
