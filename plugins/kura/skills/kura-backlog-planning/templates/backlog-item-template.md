# Backlog Item & Hierarchical Planning Template

This template enforces Kura's standard planning hierarchy:
**Main Story (Epic) → lady-lens Exploration → Sub-stories → lady-lens Exploration → Micro-Tasks (with Verified Paths, Code Examples, and Seam Decisions)**.

---

```markdown
# Main Story: [ID] - [Title of Epic / Feature]

## 1. Context & Business Value
- **As a** [user role or upstream subsystem]
- **I want** [core behavior or capability]
- **So that** [business value / architectural outcome]
- **Out of Scope**: [Explicit list of non-goals]

## 2. Global Exploration (`lady-lens`)
- Discovered modules: [e.g., `src/Kura.Orders/`]
- Existing contracts: [via `definedIn` / `exports`]

## 3. Sub-stories

---

### Sub-story 1.1: [Sub-story Title]
- **Objective**: [Focused functional slice of the main story]
- **Targeted Exploration (`lady-lens`)**:
  - Found contracts: `src/Kura.Orders/Domain/Order.cs`
  - Current consumers: `src/Kura.Orders/Endpoints/OrderEndpoints.cs` (via `importedBy`)

#### Micro-Tasks for Sub-story 1.1

##### Task 1.1.1: [Concrete Task Name, e.g., "Define Money and OrderId DDD Value Objects as Immutable Records"]
- **Verified Paths**:
  - `src/Kura.Orders/Domain/ValueObjects/OrderId.cs` (new)
  - `src/Kura.Orders/Domain/ValueObjects/Money.cs` (new)
- **Code Examples (Max 2 references from repository)**:
  - Example 1: `src/Kura.Common/ValueObjects/Sku.cs:1-25` (readonly record struct pattern)
  - Example 2: `tests/Kura.Common.UnitTests/ValueObjects/SkuTests.cs:10-35` (immutability and equality tests)
- **Story 33: Seam Decisions**:
  - *Architecture & Patterns*: See `kura-csharp-architecture` skill.
  - *DDD & Records*: Strongly typed IDs (`OrderId`) and immutable value objects (`Money`).
- **Acceptance Criteria**:
  - [ ] Negative `Amount` throws an `ArgumentException`.
  - [ ] Value equality: Two `Money` records with equal amount and currency evaluate to true with `==`.
  - [ ] Deconstruction: `var (amount, currency) = money,` correctly extracts values.
  - [ ] `OrderId.New()` generates a valid non-empty identity.
- **Outcome Probe**:
  - `dotnet test --filter "FullyQualifiedName~Kura.Orders.UnitTests.ValueObjectTests"`

---

## 4. Validation & Escalation Status
- **Review Status**: [Approved / In Revision (attempt X/3)]
- **Coder Retry Status**: [Attempt X/5]
- **Escalation Level**: [Normal / Level-Up active: e.g., from Task back to Sub-story]
```
