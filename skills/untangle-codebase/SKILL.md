---
description: Untangle a whole codebase in one pass, so agents working in it read less per change, break less without noticing, and debug faster.
disable-model-invocation: true
metadata:
    github-path: skills/untangle-codebase
    github-ref: refs/heads/main
    github-repo: https://github.com/caldoai/skills
    github-tree-sha: bf2f9fc0f8dcd62103862d30260007dfecd7ea35
name: untangle-codebase
---
Start a thorough refactor of this codebase and carry it through the fixes you find.

Treat this as a goal, with a budget:

- **Scope to the argument.** If the user passed an area or concern after the command, such as `/skill:untangle-codebase checkout`, every step below covers only that. Otherwise the whole codebase is in scope.
- **One fix, one commit.** Commit after each fix, so a bad fix is one revert away. Git is your safety net here, not just your evidence.
- **Stop and report after 10 fixes.** Show the list, what landed, and what is left. Let the user decide whether to continue.

**Why do this at all?**

- **Better output:** agents write better code in a well-structured codebase.
- **Cheaper & faster changes:** agents spend fewer tokens searching and more on the problem.
- **Fewer silent breaks:** agents break less without noticing.
- **Faster debugging:** agents find root causes faster.

**1. Ask**

Besides untangling the codebase, there are two other things you may do:

| Addition | What it does |
| --- | --- |
| **Comments** | Remove comments that only restate the code. |
| **Tests** | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |

List these (with their exact descriptions) for the user and ask which ones to do. Then do only those.

**2. List every problem**

Don't change anything yet. **First, record the baseline:** run the test suite as it stands and save the output. Anything already failing is not your regression later, and a green baseline is the safety net you need once you start changing code.

Go through the codebase asking one thing: **should these pieces change together?** Write down every place the code gets the answer wrong, as in the [decision log example](#decision-log-example). There are only three ways to get it wrong.

**Hidden links:** pieces that must change together, where the code doesn't show it.

- Copies of logic or values: change one and the others must change too, but nothing says so.
- A module that reads a global or file set by another module: change that module and this one breaks, but nothing shows it (self-contained code).
- A feature split across folders by layer, or related code in different folders: one change needs all of them, but the layout hides that (domain-driven code, colocation).
- A call order or convention callers just have to know: change it and callers break, but nothing warns them (explicit over implicit).

**Needless links:** pieces tied together that change for different reasons.

- Callers that depend on internals: the internals change for their own reasons, and the callers break anyway (encapsulation).
- Stable code that imports something more volatile: the stable code has to change whenever the volatile code does (dependency direction).
- A general function with a parameter only one workflow understands: the function has to change whenever that workflow does (caller vocabulary).
- A shallow module: its interface changes whenever its internals do, so its callers change with it (deep modules).

**Surplus:** pieces with no reason of their own to change.

- Wrappers: they only change when the thing they wrap does (pass-through wrappers).
- Extension points and config for things that never vary: nothing will ever change them (speculative generality).
- Dead code: nothing uses it, so nothing will ever need it to change.

Also write down every **special case**: code that exists for one situation instead of following from how the system works. Each one is a requirement the design never accounted for, so use them to work out what the system needs to be.

- An `if` for one value
- A parameter for a specific caller
- A swallowed exception
- A retry or sleep
- A disabled test

**3. Redesign from first principles**

Work out the fixes as if the system had known today's requirements from the start. Look for the one fix behind several problems, which often looks nothing like them. Don't fix special cases one by one.

Ask the same thing of every fix, even one that looks better in the code: pieces that change together end up together, pieces that don't aren't tied, and everything depends on what changes less.

Write each fix above the problems it solves, as in the [decision log example](#decision-log-example).

**4. Fix everything on the list**

Remove the special cases the redesign makes unnecessary, and keep the ones the system still needs. Don't go looking for bugs separately. A structural fix may fix some along the way, which is fine.

If the user chose Comments:

- Comments that restate the implementation, like `// sort first so the binary search works`, only change when it does, so they have no reason of their own to change. Remove them, even if they're phrased as a why.
- Comments about something outside the code, like `// the proxy drops websockets, so we poll`, change when that does, and the code can't show it. Keep them.
- Comments that explain a workaround in the codebase, like `// wait 100ms because the cache isn't ready yet`, only change when the problem behind the workaround does. They go when the redesign removes that problem.

If the user chose Tests, do this last, because tests are your regression safety net. A test should fail on a regression, and only then:

- Tests that repeat the implementation only change when it does, so they have no reason of their own to change. They check the same interpretation against itself, so remove them.
- Tests tied to internals break when the code changes but behavior doesn't, so they change for the wrong reason. Rewrite them to depend on behavior, which changes less.
- Tests that can't fail pass whatever the code does, so no change ever affects them. They aren't checking anything, so remove them.
- Never remove a test unless another passing test covers the same behavior. Log every removal in the decision log with the behavior it covered, so it can be restored.

**5. Check, then repeat at most twice**

Sweep the codebase again for special cases, hidden links, needless links and surplus. Read the diff, not just the files. Repeat only while a sweep still finds something worth fixing, and stop after three sweeps at most. A refactor that never ends isn't a refactor.

If your harness has no subagent tool, run each sweep as its own read-only process so it starts with an empty context:

```bash
pi -p --tools read,grep,find,ls "Find hidden links in <area>: places that must change together where the code doesn't show it. Output file:line and one line each, nothing else."
```

Run one call per category. Treat their lists as candidates, not as findings.

You're done when:

- **As few special cases are left in the system as possible.** How many remain is the best measure of how close you are.
- A typical change lands in one place.
- Every import is reasonable, and nothing imports anything more volatile than itself.
- A fresh sweep finds nothing left that is worth fixing.
- Intended behavior is the same as when you started, apart from bugs the refactor fixed. Compare the final suite against the baseline from step 2.

**Tips**

- **Start from a skeleton:** script away the function bodies, so the whole codebase fits in context.
- **Summarize out of process:** `pi -p --tools read,grep,find,ls "Summarize src/payments in 20 lines"` gives you a cheap view of a part you don't want to load into this context.
- **Check the dependency graph often:** script one that shows what imports what, and rerun it as you go.
- **Enter where leverage is highest:** start looking there first.
- **Keep a decision log:** compaction is less of a problem that way.
- **Use Git as evidence:** for how often pieces change, and what changes together.

<a id="decision-log-example"></a>**Decision log example**

The list of problems:

```md
- `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
- `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
- `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
- `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
- `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- `history/undo.ts:30` has a special case for every action that can be undone.
- `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Every action handler has to call `track()` by hand, and some don't.
- `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

Then with the fixes:

```md
- Make the general `Dialog` give focus back to whatever had it before it opened, so the wait and the flag can both go.
  - `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
  - `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- Define a `PaymentProvider` interface that Stripe and PayPal both implement, so checkout and refunds no longer know which one they're using.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Make every user action a command with a name, a handler and an undo, so the toolbar, menu, shortcuts, palette and undo history all run from one list.
  - `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
  - `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
  - `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
  - `history/undo.ts:30` has a special case for every action that can be undone.
  - Every action handler has to call `track()` by hand, and some don't.
  - `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```
