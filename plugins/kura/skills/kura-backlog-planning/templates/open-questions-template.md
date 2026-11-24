# Open Questions & Decisions Template (`open-questions.md`)

Use this document before and during planning and implementation to track uncertainties, design trade-offs, and user decisions transparently.

---

```markdown
# Open Questions & Architectural Decisions: [Project / Feature Name]

Last Updated: [YYYY-MM-DD HH:MM]
Status: [In Discussion / Partially Answered / All Resolved]

---

## Active Questions

### Question 01: [Brief Title of the Uncertainty or Decision]
- **Context & Trigger**: [Why did this arise? Which planning step or code exploration revealed this?]
- **Related Files / Components**: [Real paths verified via lady-lens]
- **Options Presented to the User**:
  1. **Option A (Recommended)**: [Description + trade-offs, e.g., Visitor pattern with IDocumentVisitor]
  2. **Option B**: [Description + trade-offs, e.g., Strategy pattern via IProcessor]
  3. **Option C**: [User custom preference or alternative]
- **Question Posed to User**: [Exact wording of the question]
- **User Answer**: [User's response]
- **Clarity & Consistency Assessment**:
  - [ ] **Clear & Consistent with past assumptions**: Proceed with the current step.
  - [ ] **Clear, but conflicts with past assumptions**: Identify which prior planning steps or architectural seams were based on the obsolete assumption and step back to redo them.
  - [ ] **Unclear / Ambiguous**: Pose a targeted follow-up question immediately.

---

## Decision Log (Resolved Items)

| ID | Decision / Topic | Chosen Option | Architectural Impact & Files | Date |
|---|---|---|---|---|
| D01 | Selection between inheritance vs composition | Composition via `IReportSectionGenerator` | New interface in `src/Domain/Reports/` | 2026-11-10 |
| D02 | CancellationToken propagation requirement | Mandatory across all worker async methods | Method signature update in `IOrderRepository` | 2026-11-10 |
| D03 | Decorator for caching catalog queries | `CachedProductCatalogDecorator` | Wraps `IProductCatalog` in DI registration | 2026-11-10 |
```
