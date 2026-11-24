# C# Architectural Patterns, SOLID & DDD Reference

This reference guide provides concrete C# implementations and architectural principles for Kura microservices and applications.

---

> [!WARNING] Licensing Rule & Template: No Commercial MediatR
> Do **NOT** install or reference the third-party `MediatR` NuGet package (commercial licensing).
> Instead, Kura uses Kim's **`mediator2`** repository as an open-source template:
> 🔗 **Template**: [kimVanRenterghemNew/mediator2](https://github.com/kimVanRenterghemNew/mediator2/tree/main/mediator2) *(Work in progress / evolving template)*.
> All internal dispatching, request handling, and event publishing must be based on or align with this `mediator2` design (see Section 4.D).

---

## 1. SOLID Principles & Design Patterns Matrix

Every component and task in Kura should map directly to SOLID principles. The table below illustrates how specific design patterns operationalize these principles:

| SOLID Principle | Core Meaning | Primary Patterns | Typical C# Application in Kura |
|---|---|---|---|
| **S - Single Responsibility** | A class should have only one reason to change. | **Command**, **Strategy**, **Chain of Responsibility** | Separate order calculation, persistence, and notifications into dedicated classes instead of one monolithic service. |
| **O - Open/Closed** | Open for extension, closed for modification. | **Strategy**, **Visitor**, **Decorator**, **State** | Add new payment providers or export formats by adding new classes without editing existing orchestration classes. |
| **L - Liskov Substitution** | Subtypes must be substitutable for their base types without altering correctness. | **Strategy**, **State**, **Null Object** | Any `IOrderValidator` or `IOrderState` implementation behaves predictably without throwing unexpected `NotSupportedException`. |
| **I - Interface Segregation** | Clients should not be forced to depend on interfaces they do not use. | **Role Interfaces**, **Visitor** | Split broad interfaces into focused contracts (`IOrderReader`, `IOrderWriter`, `ICancellableHandler`) rather than a single `IOrderManager`. |
| **D - Dependency Inversion** | Depend on abstractions, not on concretions. | **Dependency Injection**, **Factory**, **Strategy** | Inject interfaces via constructor, configure lifetimes in ASP.NET Core DI container (`IServiceCollection`). |

---

## 2. Domain-Driven Design (DDD), Records & Immutability

### A. Ubiquitous Language & Domain Naming
Naming is critical in Kura. Code should read like the business domain:
- **Avoid Primitive Obsession**: Never pass raw `string`, `Guid`, or `decimal` across domain boundaries. Wrap them in strongly typed domain concepts.
- **Intention-Revealing Names**: Name types and methods after business events and rules (e.g., `order.CancelBecauseOfNonPayment()` instead of `order.UpdateStatus(4)`).
- **Domain Event Naming**: Past tense verbs representing facts that happened (e.g., `OrderPlacedDomainEvent`, `InventoryReservedDomainEvent`).

### B. C# `record` for Immutability, Deconstruction & Value Objects
Use `record` (class) and `readonly record struct` extensively for **DDD Value Objects**, **Domain Events**, and **Data Transfer Objects (DTOs)**.

#### Why Records?
1. **Immutable by Default**: Prevents unexpected side effects and race conditions across concurrent threads.
2. **Value-Based Equality**: Two records with the same property values are equal (`==`), matching DDD Value Object requirements without boilerplate `Equals` and `GetHashCode` overrides.
3. **Built-in Deconstruction**: Positional records automatically generate deconstructors, making pattern matching and tuple extraction effortless.
4. **Non-destructive Mutation (`with`)**: Allows creating modified copies while keeping the original object intact.

```csharp
// 1. Strongly-Typed Identity (Zero allocation with readonly record struct)
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.NewGuid());
    public static OrderId Empty => new(Guid.Empty);
    public override string ToString() => Value.ToString();
}

public readonly record struct Sku(string Value)
{
    public Sku
    {
        if (string.IsNullOrWhiteSpace(Value))
            throw new ArgumentException("SKU cannot be empty.", nameof(Value));
    }
}

// 2. DDD Value Object (Positional record with immutability and value equality)
public sealed record Money(decimal Amount, string Currency)
{
    public Money
    {
        if (Amount < 0) throw new ArgumentException("Amount cannot be negative.", nameof(Amount));
        if (string.IsNullOrWhiteSpace(Currency)) throw new ArgumentException("Currency required.", nameof(Currency));
    }

    public static Money Zero(string currency) => new(0m, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException($"Cannot add currency {other.Currency} to {Currency}.");
        return this with { Amount = Amount + other.Amount };
    }
}

// 3. Deconstruction and Pattern Matching in Action
public static class PriceEvaluator
{
    public static string Describe(Money money) => money switch
    {
        (0m, _) => "Free",
        ( > 1000m, "EUR") => "High-value Euro order",
        var (amount, currency) => $"{amount:N2} {currency}" // Automatic deconstruction!
    };
}

// 4. Immutable Domain Event
public sealed record OrderPlacedDomainEvent(
    OrderId OrderId,
    Sku ProductSku,
    Money TotalAmount,
    DateTimeOffset OccurredOn
);
```

---

## 3. Composition Over Inheritance

### The Problem with Inheritance Hierarchies
Base classes like `BaseService`, `AuditableEntityService<T>`, or `AbstractOrderProcessor` create tight coupling, brittle dependencies, and testing friction (requiring complex base class mocks).

### The Solution: Composed Collaborators
```csharp
// ❌ Naive Anti-pattern: Fragile Base Class
public class OrderService : BaseEntityService<Order>
{
    public override void Process(Order order) { /* bloated base logic */ }
}

// ✅ Kura Pattern: Composed Collaborators via Dependency Injection
public sealed class OrderProcessor
{
    private readonly IEnumerable<IOrderValidator> _validators;
    private readonly IOrderPriceCalculator _calculator;
    private readonly IOrderRepository _repository;
    private readonly ILogger<OrderProcessor> _logger;

    public OrderProcessor(
        IEnumerable<IOrderValidator> validators,
        IOrderPriceCalculator calculator,
        IOrderRepository repository,
        ILogger<OrderProcessor> logger)
    {
        _validators = validators;
        _calculator = calculator;
        _repository = repository;
        _logger = logger;
    }

    public async Task<OrderResult> ProcessAsync(Order order, CancellationToken ct)
    {
        foreach (var validator in _validators)
        {
            var result = await validator.ValidateAsync(order, ct);
            if (!result.IsValid)
            {
                return OrderResult.Failed(result.Errors);
            }
        }

        var total = _calculator.Calculate(order);
        order.SetTotal(total);

        await _repository.SaveAsync(order, ct);
        _logger.LogInformation("Order {OrderId} processed successfully.", order.Id);

        return OrderResult.Success(order);
    }
}
```

---

## 4. Behavioral Patterns in C#

### A. Strategy Pattern (Open/Closed Principle)
Used for interchangeable algorithms (e.g., pricing schemes, discounts, validation routines):

```csharp
public interface IPricingStrategy
{
    Money CalculatePrice(OrderItem item);
}

public sealed class RegularPricingStrategy : IPricingStrategy
{
    public Money CalculatePrice(OrderItem item) => item.UnitPrice with { Amount = item.UnitPrice.Amount * item.Quantity };
}

public sealed class PromotionalPricingStrategy : IPricingStrategy
{
    public Money CalculatePrice(OrderItem item) => item.UnitPrice with { Amount = (item.UnitPrice.Amount * item.Quantity) * 0.85m };
}
```

### B. State Pattern (Encapsulating State Transitions)
Replaces giant `switch (order.Status)` blocks with object-oriented state transitions:

```csharp
public interface IOrderState
{
    Task ProcessAsync(OrderContext context, CancellationToken ct);
    Task CancelAsync(OrderContext context, CancellationToken ct);
}

public sealed class DraftOrderState : IOrderState
{
    public Task ProcessAsync(OrderContext context, CancellationToken ct)
    {
        context.TransitionTo(new SubmittedOrderState());
        return Task.CompletedTask;
    }

    public Task CancelAsync(OrderContext context, CancellationToken ct)
    {
        context.TransitionTo(new CancelledOrderState());
        return Task.CompletedTask;
    }
}

public sealed class SubmittedOrderState : IOrderState
{
    public Task ProcessAsync(OrderContext context, CancellationToken ct)
    {
        throw new InvalidOperationException("Order is already submitted and pending fulfillment.");
    }

    public Task CancelAsync(OrderContext context, CancellationToken ct)
    {
        context.TransitionTo(new CancelledOrderState());
        return Task.CompletedTask;
    }
}
```

### C. Visitor Pattern (Separating Algorithms from Data Structures)
Allows operations across heterogeneous collections without polluting domain models:

```csharp
public interface IDocumentElement
{
    TResult Accept<TResult>(IDocumentVisitor<TResult> visitor);
}

public sealed record TextElement(string Content, string Format) : IDocumentElement
{
    public TResult Accept<TResult>(IDocumentVisitor<TResult> visitor) => visitor.Visit(this);
}

public sealed record TableElement(IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows) : IDocumentElement
{
    public TResult Accept<TResult>(IDocumentVisitor<TResult> visitor) => visitor.Visit(this);
}

public interface IDocumentVisitor<out TResult>
{
    TResult Visit(TextElement element);
    TResult Visit(TableElement element);
}

public sealed class HtmlExportVisitor : IDocumentVisitor<string>
{
    public string Visit(TextElement element) => $"<p class=\"{element.Format}\">{element.Content}</p>";
    public string Visit(TableElement element) => "<table>...</table>";
}
```

### D. Lightweight Dispatcher & Command Pattern (Template: `mediator2`)
To avoid commercial MediatR licensing, we use the lightweight **`mediator2`** template:
🔗 **Reference Template**: [kimVanRenterghemNew/mediator2](https://github.com/kimVanRenterghemNew/mediator2/tree/main/mediator2) *(WIP)*.

```csharp
public interface IRequest<out TResponse> { }

public interface IRequestHandler<in TRequest, TResponse> 
    where TRequest : IRequest<TResponse>
{
    Task<TResponse> HandleAsync(TRequest request, CancellationToken ct);
}

public interface INotification { }

public interface INotificationHandler<in TNotification> 
    where TNotification : INotification
{
    Task HandleAsync(TNotification notification, CancellationToken ct);
}

public interface IDispatcher
{
    Task<TResponse> SendAsync<TResponse>(IRequest<TResponse> request, CancellationToken ct = default);
    Task PublishAsync<TNotification>(TNotification notification, CancellationToken ct = default) 
        where TNotification : INotification;
}

public sealed class ServiceProviderDispatcher : IDispatcher
{
    private readonly IServiceProvider _serviceProvider;

    public ServiceProviderDispatcher(IServiceProvider serviceProvider) => _serviceProvider = serviceProvider;

    public async Task<TResponse> SendAsync<TResponse>(IRequest<TResponse> request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var handlerType = typeof(IRequestHandler<,>).MakeGenericType(request.GetType(), typeof(TResponse));
        var handler = _serviceProvider.GetService(handlerType);

        if (handler is null)
        {
            throw new InvalidOperationException($"No handler registered for request {request.GetType().Name}.");
        }

        var method = handlerType.GetMethod(nameof(IRequestHandler<IRequest<TResponse>, TResponse>.HandleAsync))!;
        var task = (Task<TResponse>)method.Invoke(handler, new object[] { request, ct })!;
        return await task;
    }

    public async Task PublishAsync<TNotification>(TNotification notification, CancellationToken ct = default) 
        where TNotification : INotification
    {
        ArgumentNullException.ThrowIfNull(notification);

        var handlers = _serviceProvider.GetServices<INotificationHandler<TNotification>>();
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(notification, ct);
        }
    }
}
```

### E. Chain of Responsibility (Pipelines & Middlewares)
Chains handlers where each decides whether to process or pass to the next:

```csharp
public interface IOrderStepHandler
{
    Task HandleAsync(OrderContext context, Func<Task> next, CancellationToken ct);
}

public sealed class FraudCheckStepHandler : IOrderStepHandler
{
    private readonly IFraudService _fraudService;

    public FraudCheckStepHandler(IFraudService fraudService) => _fraudService = fraudService;

    public async Task HandleAsync(OrderContext context, Func<Task> next, CancellationToken ct)
    {
        var isFraudulent = await _fraudService.CheckAsync(context.Order, ct);
        if (isFraudulent)
        {
            context.MarkRejected("Suspected fraud detected.");
            return;
        }

        await next();
    }
}
```

---

## 5. Structural Enhancement: The Decorator Pattern

```csharp
public interface IProductCatalog
{
    Task<Product?> GetByIdAsync(Sku sku, CancellationToken ct);
}

public sealed class CachedProductCatalogDecorator : IProductCatalog
{
    private readonly IProductCatalog _inner;
    private readonly IDistributedCache _cache;

    public CachedProductCatalogDecorator(IProductCatalog inner, IDistributedCache cache)
    {
        _inner = inner;
        _cache = cache;
    }

    public async Task<Product?> GetByIdAsync(Sku sku, CancellationToken ct)
    {
        var cached = await _cache.GetStringAsync($"product:{sku.Value}", ct);
        if (cached is not null)
        {
            return JsonSerializer.Deserialize<Product>(cached);
        }

        var product = await _inner.GetByIdAsync(sku, ct);
        if (product is not null)
        {
            await _cache.SetStringAsync($"product:{sku.Value}", JsonSerializer.Serialize(product), ct);
        }

        return product;
    }
}
```

---

## 6. Hexagonal Architecture (Ports & Adapters) & Contract Tests

In Kura C#, the domain core has **ZERO dependencies** on EF Core, ASP.NET Core, database drivers, or external clients. All infrastructure interactions are mediated through **Port interfaces**.

### A. The Port Interface (Domain Core)
```csharp
namespace Kura.Domain.Ports;

public interface IOrderRepositoryPort
{
    Task<Order?> FindByIdAsync(OrderId id, CancellationToken ct);
    Task SaveAsync(Order order, CancellationToken ct);
}
```

### B. Shared Adapter Contract Tests (Liskov Substitution)
Every adapter implementing a port must pass the identical contract test suite, whether it is an in-memory double or an EF Core / PostgreSQL adapter:

```csharp
namespace Kura.Tests.Ports;

public abstract class OrderRepositoryPortContractTestsBase
{
    protected abstract IOrderRepositoryPort CreateRepository();

    [Fact]
    public async Task SaveAsync_and_FindByIdAsync_roundtrip_successfully()
    {
        var repository = CreateRepository();
        var order = Order.Create(new OrderId(Guid.NewGuid()), new Money(100m, "EUR"));

        await repository.SaveAsync(order, CancellationToken.None);
        var loaded = await repository.FindByIdAsync(order.Id, CancellationToken.None);

        Assert.NotNull(loaded);
        Assert.Equal(order.Id, loaded.Id);
        Assert.Equal(order.Total, loaded.Total);
    }

    [Fact]
    public async Task FindByIdAsync_returns_null_when_not_found()
    {
        var repository = CreateRepository();
        var result = await repository.FindByIdAsync(new OrderId(Guid.NewGuid()), CancellationToken.None);
        Assert.Null(result);
    }
}

// 1. In-memory adapter test
public class InMemoryOrderRepositoryContractTests : OrderRepositoryPortContractTestsBase
{
    protected override IOrderRepositoryPort CreateRepository() => new InMemoryOrderRepositoryAdapter();
}

// 2. EF Core adapter test
public class EfCoreOrderRepositoryContractTests : OrderRepositoryPortContractTestsBase
{
    protected override IOrderRepositoryPort CreateRepository() => new EfCoreOrderRepositoryAdapter(CreateTestDbContext());
}
```

---

## 7. Pure Rule Engine & Decision Core (Named Rules)

Replace messy nested `if/else` ladders and giant switch blocks with observable, composable named rules:

```csharp
namespace Kura.Domain.Decisions;

public sealed record DecisionRule<TContext, TResult>(
    string Name,
    Func<TContext, bool> When,
    TResult Then
);

public static class RuleEngine
{
    // Composable Pure Predicates
    public static Func<T, bool> All<T>(params Func<T, bool>[] predicates) =>
        ctx => predicates.All(p => p(ctx));

    public static Func<T, bool> Any<T>(params Func<T, bool>[] predicates) =>
        ctx => predicates.Any(p => p(ctx));

    public static Func<T, bool> Not<T>(Func<T, bool> predicate) =>
        ctx => !predicate(ctx);

    public static (TResult Result, string MatchedRule) Decide<TContext, TResult>(
        TContext context,
        IReadOnlyList<DecisionRule<TContext, TResult>> rules)
    {
        foreach (var rule in rules)
        {
            if (rule.When(context))
            {
                return (rule.Then, rule.Name);
            }
        }

        throw new InvalidOperationException("No decision rule matched the provided context.");
    }
}
```

---

## 8. Pure State Machine Reducer & Dynamic Flow

Workflows are modeled as pure reducers over immutable C# records, returning state transitions and declarative data effects. Side effects are executed outside the reducer:

```csharp
namespace Kura.Domain.Workflows;

public abstract record OrderEvent;
public sealed record PaymentReceivedEvent(Money Amount) : OrderEvent;
public sealed record CancelRequestedEvent(string Reason) : OrderEvent;

public abstract record WorkflowEffect;
public sealed record PublishNotificationEffect(string Message) : WorkflowEffect;
public sealed record RequestAuditReviewEffect(string Reason) : WorkflowEffect;

public static class OrderLifecycleMachine
{
    public static (OrderState NextState, ImmutableArray<WorkflowEffect> Effects) Step(
        OrderState current,
        OrderEvent evt) =>
        (current.Status, evt) switch
        {
            ("Draft", PaymentReceivedEvent pay) =>
                (current with { Status = "Paid", PaidAmount = pay.Amount },
                 ImmutableArray.Create<WorkflowEffect>(new PublishNotificationEffect("Order payment received"))),

            ("Paid", CancelRequestedEvent req) =>
                // Dynamic reviewer escalation if canceling an already paid order!
                (current with { Status = "RequiresReview" },
                 ImmutableArray.Create<WorkflowEffect>(new RequestAuditReviewEffect($"Cancellation requested: {req.Reason}"))),

            ("Draft", CancelRequestedEvent req) =>
                (current with { Status = "Cancelled" },
                 ImmutableArray.Create<WorkflowEffect>(new PublishNotificationEffect("Draft cancelled"))),

            _ => (current, ImmutableArray<WorkflowEffect>.Empty)
        };
}
```

---

## 9. Fractal Composition in .NET

1. **Level 1 (Module Level)**:
   - Sealed immutable records for domain entities and value objects.
   - Tagged Domain Exceptions: `public sealed class DomainException(string code, string message) : Exception(message) { public string Code => code; }`.
   - No ambient globals: Inject `TimeProvider` (or `IClock`) instead of calling `DateTime.UtcNow`.
   - Fail-Closed: Unmatched states or rules throw explicit domain exceptions.
2. **Level 2 (Subsystem Level)**:
   - Bounded contexts communicate across boundaries exclusively via Record DTOs (`OrderDto`, `InvoiceDto`).
   - Pipelines execute via mediator2 or Chain of Responsibility.
3. **Level 3 (System Level)**:
   - Composition root in `Program.cs` is the **only place** where implementations are selected and registered in `IServiceCollection`.
   - State-dependent tool capabilities protect agents during different lifecycle phases.

---

## 10. Async Best Practices & Resilience

1. **CancellationToken**: Always accept and forward `CancellationToken` in async signatures to support timeout handling and graceful cancellation.
2. **Statelessness**: Avoid mutable static variables; write stateless services to support concurrent, thread-safe execution.
3. **Configuration**: Use strongly typed `IOptions<T>` bound to configuration sources.

---

## 11. Customization & Overrides

If a user specifies a different pattern or conventions, the user's explicit instructions override default recommendations.
