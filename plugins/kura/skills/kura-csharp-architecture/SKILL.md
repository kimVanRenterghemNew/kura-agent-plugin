---
name: kura-csharp-architecture
description: >-
  C# .NET architectural guidelines: Hexagonal Architecture (Ports & Adapters),
  Fractal Composition (Records, Subsystems, Composition Root), Pure Rule Engines & Decision Core,
  Pure State Machines & Reducers, SOLID principles, Decorator & Visitor patterns, mediator2,
  and adapter contract testing.
  Use during planning (Seam Decisions), implementation, and code review.
---

# Kura C# Architecture & Design Patterns Skill

This skill provides architectural rules, pattern implementations, and SOLID guidelines for Kura C# .NET applications and microservices. It brings together **Hexagonal Architecture (Ports & Adapters)**, **Fractal Composition**, **Pure Rule Engines & State Machines**, and classic behavioral patterns (**Decorator**, **Visitor**, **Strategy**, **mediator2**) in an idiomatic, modern C# style.

---

## 1. Architectural Seam Decisions Principle
> *"Kura provides the architectural options (`seamDecisions`), the model does not invent them on the fly."*

Every C# feature or refactor must explicitly evaluate and document these architectural seams:

1. **Hexagonal Architecture (Ports & Adapters)**:
   - Domain core (`Domain/` and `Application/`) has **ZERO dependencies** on EF Core, ASP.NET Core, database drivers, or third-party APIs.
   - All external capabilities are modeled as Port interfaces (`IPaymentPort`, `IOrderRepositoryPort`).
   - Adapters in `Infrastructure/` implement the ports.
2. **Domain-Driven Design (DDD) & Immutable Records**:
   - Strongly typed IDs: `public readonly record struct OrderId(Guid Value);`
   - Immutable Value Objects: `public sealed record Money(decimal Amount, string Currency);`
   - Ubiquitous Language naming; no primitive obsession.
   - Effortless deconstruction: `var (amount, currency) = money;`
3. **Pure Rule Engine & Decision Core (Named Rules over If-Ladders)**:
   - Composable predicates (`all`, `any`, `not`) and named rule records.
   - Every decision returns the winning rule name for 100% observability and auditability.
4. **Pure State Machines & Dynamic Flow**:
   - Modeled with immutable records: `(OrderState NextState, ImmutableArray<IEffect> Effects) Step(OrderState state, IOrderEvent evt)`.
   - Pure reducers return data effects; I/O is executed outside the reducer.
   - Supports reviewer rollback directly from *Review* back to *Architecture* when seams are breached.
5. **No Commercial MediatR**:
   - Use Kim's official open-source template: [kimVanRenterghemNew/mediator2](https://github.com/kimVanRenterghemNew/mediator2).
   - Resolve requests and notifications cleanly using standard `IServiceProvider`.
6. **Structural Enhancement (Decorator)**:
   - Transparently wrap port interfaces with caching, logging, metrics, or Polly retries without touching business logic.
7. **Behavioral Patterns (Visitor & Strategy)**:
   - **Strategy**: For swappable pricing, tax, or hashing algorithms.
   - **Visitor**: For traversing syntax trees, composite task nodes, or rule sets without polluting entities.
8. **Async Best Practices**:
   - Mandatory `CancellationToken` in async signatures (clean timeouts and graceful shutdown).
   - Stateless services for concurrency and testability.
   - Strongly typed `IOptions<T>` configuration.

---

## 2. Fractal Composition in .NET: Three Levels

### Level 1: Internal Module Composition
- **Sealed Records**: Value objects and DTOs are sealed immutable records.
- **Tagged Domain Exceptions**: Domain exceptions carry structured error codes (`code: "ERR_ORDER_ALREADY_PAID"`).
- **No Ambient Globals**: Never call `DateTime.UtcNow`, `Guid.NewGuid()`, or `Environment.GetEnvironmentVariable()` directly inside domain logic. Inject `IClock`, `IGuidGenerator`, or configuration.
- **Fail-Closed**: If no named rule matches, throw `NoRuleMatchedException`.

### Level 2: Subsystems, Pipelines & Neutral Record DTOs
- Modules communicate exclusively via immutable Record DTOs (`ContextDto`, `OrderDto`).
- Cross-cutting pipelines (Chain of Responsibility) process DTOs sequentially.

### Level 3: System Composition Root
- `Program.cs` / DI extension methods are the **sole place** that binds concrete adapters to port interfaces.
- Adapters never reference each other directly.

---

## 3. SOLID to Design Pattern Mapping

| Principle | Primary Patterns | C# Application |
|---|---|---|
| **Single Responsibility (SRP)** | Command, Strategy, Ports & Adapters | Separate domain calculation, validation, and database persistence into dedicated classes (< 250 lines). |
| **Open/Closed (OCP)** | Strategy, Visitor, Decorator, Rule Engine | Add new payment providers, pricing rules, or exporters by registering new classes/rules without altering existing core code. |
| **Liskov Substitution (LSP)** | Strategy, State, Adapter Contract Tests | Every adapter strictly fulfills the port contract; verified via shared abstract contract tests (`*.ContractTests.cs`). |
| **Interface Segregation (ISP)** | Role Interfaces, Narrow Ports | Small, dedicated port interfaces (`IOrderReaderPort`, `IOrderWriterPort`, `ICancellableHandler`) rather than monolithic services. |
| **Dependency Inversion (DIP)** | Hexagonal Ports & Adapters, DI Container | Domain core depends on interfaces; adapters are resolved through standard ASP.NET Core `IServiceCollection`. |

Reference: [C# Patterns & Code Examples](./references/csharp-patterns.md).
