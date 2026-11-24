# JavaScript & TypeScript Architectural Patterns & Code Reference

This reference provides production-ready, idiomatic JavaScript & TypeScript patterns implementing Kura's **Hexagonal Architecture**, **Fractal Composition**, **Rule Engines**, **Pure State Machines**, and **Decorator/Visitor** patterns.

---

## 1. Pure Rule Engine (Decision Core)

Replace nested `if/else` ladders with composable pure guards and named rule tables. Every decision returns the name of the winning rule for 100% observability.

```javascript
// 1. Composable Pure Guards
export const all = (...guards) => (ctx) => guards.every((g) => g(ctx));
export const any = (...guards) => (ctx) => guards.some((g) => g(ctx));
export const not = (guard) => (ctx) => !guard(ctx);

// 2. Named Rules Table
export const EVALUATION_RULES = [
  {
    name: 'circuit_breaker_max_retries',
    when: (ctx) => ctx.attemptCount >= 5,
    then: { action: 'escalate_to_planner', reason: 'Too many coder retries' }
  },
  {
    name: 'unresolved_critical_question',
    when: (ctx) => Array.isArray(ctx.openQuestions) && ctx.openQuestions.some((q) => q.isBlocking),
    then: { action: 'await_user_input', reason: 'Blocking open questions exist' }
  },
  {
    name: 'failing_tests_ready_for_coder',
    when: all(
      (ctx) => ctx.phase === 'red',
      (ctx) => ctx.testsFailingAsExpected === true
    ),
    then: { action: 'invoke_code_fixer', reason: 'TDD Red phase confirmed' }
  },
  {
    name: 'default_review',
    when: () => true,
    then: { action: 'recheck_state', reason: 'Fallback rule' }
  }
];

// 3. Pure Decision Executor
export function decide(ctx, rules = EVALUATION_RULES) {
  const match = rules.find((rule) => rule.when(ctx));
  if (!match) {
    const error = new Error('No rule matched the given context');
    error.code = 'ERR_NO_RULE_MATCHED';
    throw error;
  }
  return {
    ...match.then,
    matchedRule: match.name
  };
}
```

---

## 2. Pure State Machine Reducer & Dynamic Flow

Workflows are modeled as pure reducers. Side effects are returned as **data records**, never executed directly inside the reducer.

```javascript
// Pure State Machine Definition
export function defineWorkflowMachine(transitions) {
  return function step(currentState, event) {
    const stateConfig = transitions[currentState.status];
    if (!stateConfig) {
      throw Object.assign(new Error(`Invalid state: ${currentState.status}`), { code: 'ERR_INVALID_STATE' });
    }

    const transition = stateConfig[event.type];
    if (!transition) {
      // Ignore unhandled event or return unchanged state
      return { state: currentState, effects: [] };
    }

    const nextState = {
      ...currentState,
      status: transition.target,
      history: [...(currentState.history || []), currentState.status]
    };

    const effects = typeof transition.effects === 'function'
      ? transition.effects(nextState, event)
      : (transition.effects || []);

    return {
      state: Object.freeze(nextState),
      effects: Object.freeze(effects)
    };
  };
}

// Example: Development Cycle Machine with Reviewer Rollback
export const devCycleStep = defineWorkflowMachine({
  architecture: {
    PLAN_READY: {
      target: 'planning',
      effects: [{ type: 'LOG_TRANSITION', to: 'planning' }]
    }
  },
  planning: {
    PLAN_APPROVED: {
      target: 'coding',
      effects: [{ type: 'INVOKE_AGENT', role: 'kura-test-writer' }]
    }
  },
  coding: {
    CODE_SUBMITTED: {
      target: 'review',
      effects: [{ type: 'RUN_VALIDATOR' }]
    }
  },
  review: {
    REVIEW_APPROVED: {
      target: 'done',
      effects: [{ type: 'SYNC_GRAPH' }]
    },
    // Dynamic rollback directly to architecture when architectural seams are violated!
    ARCHITECTURE_VIOLATION: {
      target: 'architecture',
      effects: [
        { type: 'NOTIFY_USER', message: 'Architectural constraint breached. Returning to architecture.' },
        { type: 'RESET_PLAN' }
      ]
    },
    TEST_FAILURE: {
      target: 'coding',
      effects: [{ type: 'INVOKE_AGENT', role: 'kura-code-fixer' }]
    }
  },
  done: {}
});
```

---

## 3. The Decorator Pattern (Wrapping Ports Transparently)

Decorators wrap port implementations with cross-cutting concerns (retries, latency tracking, caching) without modifying the underlying adapter.

```javascript
// Base Port Contract (e.g. InferencePort)
// { generate(prompt, options): Promise<Result> }

// 1. Timing & Metrics Decorator
export function withMetrics(port, metricsRecorder) {
  return Object.freeze({
    ...port,
    async generate(prompt, options) {
      const start = Date.now();
      try {
        const result = await port.generate(prompt, options);
        metricsRecorder.record({
          operation: 'generate',
          durationMs: Date.now() - start,
          success: true,
          tokens: result.tokens
        });
        return result;
      } catch (error) {
        metricsRecorder.record({
          operation: 'generate',
          durationMs: Date.now() - start,
          success: false,
          errorCode: error.code || 'UNKNOWN'
        });
        throw error;
      }
    }
  });
}

// 2. Retry & Backoff Decorator
export function withRetry(port, maxRetries = 2, delayMs = 1000) {
  return Object.freeze({
    ...port,
    async generate(prompt, options) {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await port.generate(prompt, options);
        } catch (err) {
          lastError = err;
          if (attempt <= maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
          }
        }
      }
      throw lastError;
    }
  });
}

// Usage in Composition Root:
// const decoratedPort = withMetrics(withRetry(rawAdapter, 2), metricsSink);
```

---

## 4. The Visitor Pattern (AST & Hierarchical Tree Traversal)

Separate operations (linting, complexity evaluation, formatting) from the data structures (AST nodes, task graphs).

```javascript
// Generic Tree Traverser (Visitor Host)
export function walkTree(node, visitor, ctx = {}) {
  if (!node) return;

  // 1. Visit current node type if visitor provides a handler
  if (typeof visitor[node.type] === 'function') {
    visitor[node.type](node, ctx);
  } else if (typeof visitor.default === 'function') {
    visitor.default(node, ctx);
  }

  // 2. Recurse over children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkTree(child, visitor, ctx);
    }
  }
}

// Concrete Visitor Example: Code Quality & Complexity Auditor
export function createQualityAuditVisitor() {
  const issues = [];
  return {
    getIssues: () => Object.freeze([...issues]),
    
    // Visit specific AST node types
    IfStatement(node) {
      if (node.isChainedElseIf) {
        issues.push({ line: node.loc?.start?.line, rule: 'no_else_if_chains', message: 'Use dispatch table instead of else-if ladder' });
      }
    },
    FunctionDeclaration(node) {
      if (node.lineCount > 50) {
        issues.push({ line: node.loc?.start?.line, rule: 'max_function_lines', message: `Function ${node.name} has ${node.lineCount} lines (max 50)` });
      }
      if (node.parameters?.length > 3) {
        issues.push({ line: node.loc?.start?.line, rule: 'max_parameters', message: `Function ${node.name} has ${node.parameters.length} params (max 3)` });
      }
    }
  };
}
```

---

## 5. Factory Functions & Tagged Errors (No `class`)

Avoid design-time inheritance hierarchies. Use factory functions with object freezing and tagged errors.

```javascript
// Tagged Errors: Plain Error instances with standard code properties
export const ERR_PORT_VIOLATION = 'ERR_PORT_VIOLATION';
export const ERR_VALIDATION_FAILED = 'ERR_VALIDATION_FAILED';

export function createTaggedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

export const isTaggedError = (error, code) => error?.code === code;

// Factory Function with Prototype Composition
const baseServicePrototype = {
  describe() {
    return `${this.serviceName} v${this.version}`;
  }
};

export function createOrderService({ repository, notifier, config }) {
  if (!repository) throw createTaggedError(ERR_PORT_VIOLATION, 'repository port is required');
  if (!notifier) throw createTaggedError(ERR_PORT_VIOLATION, 'notifier port is required');

  return Object.freeze(
    Object.assign(Object.create(baseServicePrototype), {
      serviceName: 'OrderService',
      version: config.version || '1.0.0',
      
      async cancelOrder(orderId, reason) {
        const order = await repository.findById(orderId);
        if (!order) throw createTaggedError(ERR_VALIDATION_FAILED, `Order ${orderId} not found`);

        const updated = { ...order, status: 'cancelled', cancelReason: reason };
        await repository.save(updated);
        await notifier.notify(order.customerId, `Order ${orderId} cancelled: ${reason}`);
        
        return updated;
      }
    })
  );
}
```

---

## 6. Adapter Contract Test Template

Every adapter implementing a port must pass the identical contract test suite:

```javascript
// test/ports/storagePort.contract.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function runStoragePortContractTests(adapterName, createAdapter) {
  test(`[${adapterName}] StoragePort: save and findById round-trip`, async () => {
    const storage = await createAdapter();
    const entity = { id: 'ent-101', name: 'Alpha', version: 1 };

    await storage.save('entities', entity);
    const loaded = await storage.findById('entities', 'ent-101');

    assert.deepEqual(loaded, entity);
  });

  test(`[${adapterName}] StoragePort: returns null when entity not found`, async () => {
    const storage = await createAdapter();
    const missing = await storage.findById('entities', 'does-not-exist');
    assert.equal(missing, null);
  });
}

// In test files:
// runStoragePortContractTests('InMemoryStorage', () => createMemoryStorage());
// runStoragePortContractTests('SQLiteStorage', () => createSqliteStorage(':memory:'));
```

---

## 7. State-Dependent Capability Exposure (Least Privilege)

Restricting available agent tools based on the current lifecycle state preserves context tokens and prevents accidental code modifications.

```javascript
// Define state-dependent capabilities
export const CAPABILITIES = {
  architecture: Object.freeze(['research', 'graph_read']),
  planning: Object.freeze(['research', 'graph_read', 'inbox_write']),
  coding: Object.freeze(['research', 'graph_read', 'code_mutation', 'test_runner']),
  validation: Object.freeze(['research', 'graph_read', 'test_runner', 'ratchet_check'])
};

// Filter tools based on active state
export function getActiveToolsForState(status, allTools) {
  const allowedCapabilities = CAPABILITIES[status] || CAPABILITIES.architecture;
  return allTools.filter((tool) => allowedCapabilities.includes(tool.capabilityGroup));
}
```
