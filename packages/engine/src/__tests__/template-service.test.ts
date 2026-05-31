import { describe, expect, it } from "vitest";
import { createTemplateService } from "../services/template-service";

describe("TemplateService", () => {
  const template = createTemplateService();

  describe("Variable Substitution", () => {
    it("should substitute simple variables", () => {
      const result = template.substitute("Hello {{name}}", { name: "John" });
      expect(result).toBe("Hello John");
    });

    it("should substitute multiple variables", () => {
      const result = template.substitute("Hello {{firstName}} {{lastName}}", {
        firstName: "John",
        lastName: "Doe",
      });
      expect(result).toBe("Hello John Doe");
    });

    it("should substitute nested variables", () => {
      const result = template.substitute("User: {{user.profile.name}}", {
        user: { profile: { name: "John" } },
      });
      expect(result).toBe("User: John");
    });

    it("should handle number values", () => {
      const result = template.substitute("Score: {{score}}", { score: 100 });
      expect(result).toBe("Score: 100");
    });

    it("should handle boolean values", () => {
      const result = template.substitute("Active: {{active}}", { active: true });
      expect(result).toBe("Active: true");
    });

    it("should return empty string for unmatched variables", () => {
      // Security: don't expose template syntax in output
      const result = template.substitute("Hello {{name}}, your code is {{code}}", {
        name: "John",
      });
      expect(result).toBe("Hello John, your code is ");
    });

    it("should handle empty context", () => {
      // Security: don't expose template syntax in output
      const result = template.substitute("Hello {{name}}", {});
      expect(result).toBe("Hello ");
    });

    it("should handle templates without variables", () => {
      const result = template.substitute("Hello World", { name: "John" });
      expect(result).toBe("Hello World");
    });

    it("should handle whitespace in variable names", () => {
      const result = template.substitute("Hello {{ name }}", { name: "John" });
      expect(result).toBe("Hello John");
    });

    it("should handle undefined nested paths", () => {
      // Security: don't expose template syntax in output
      const result = template.substitute("Value: {{a.b.c.d}}", { a: { b: {} } });
      expect(result).toBe("Value: ");
    });
  });

  describe("URL Substitution", () => {
    it("should substitute variables in URLs", () => {
      const result = template.substitute("https://api.example.com/users/{{userId}}/orders/{{orderId}}", {
        userId: "123",
        orderId: "456",
      });
      expect(result).toBe("https://api.example.com/users/123/orders/456");
    });

    it("should handle query parameters", () => {
      const result = template.substitute("https://api.example.com/search?q={{query}}&page={{page}}", {
        query: "test",
        page: 1,
      });
      expect(result).toBe("https://api.example.com/search?q=test&page=1");
    });
  });

  describe("JSON Body Substitution", () => {
    it("should substitute in JSON strings", () => {
      const jsonTemplate = '{"userId": "{{userId}}", "action": "{{action}}"}';
      const result = template.substitute(jsonTemplate, {
        userId: "123",
        action: "update",
      });
      expect(result).toBe('{"userId": "123", "action": "update"}');
    });
  });

  describe("Expression Mode (JEXL)", () => {
    it("should evaluate expression with {{= expr }}", () => {
      const result = template.substitute("Hello {{= upper(name) }}", { name: "john" });
      expect(result).toBe("Hello JOHN");
    });

    it("should evaluate ternary expressions", () => {
      const result = template.substitute("Status: {{= points > 100 ? 'VIP' : 'Standard' }}", { points: 150 });
      expect(result).toBe("Status: VIP");
    });

    it("should use default function", () => {
      const result = template.substitute("Hello {{= default(name, 'Guest') }}", {});
      expect(result).toBe("Hello Guest");
    });

    it("should access nested properties", () => {
      const result = template.substitute("User: {{= user.profile.name }}", {
        user: { profile: { name: "John" } },
      });
      expect(result).toBe("User: John");
    });

    it("should mix simple and expression modes", () => {
      const result = template.substitute("Hello {{user.firstName}}, your status is {{= points > 100 ? 'VIP' : 'Standard' }}", {
        user: { firstName: "John" },
        points: 150,
      });
      expect(result).toBe("Hello John, your status is VIP");
    });

    it("should handle expression errors gracefully", () => {
      // Security: don't expose template syntax in output, return empty string on error
      const result = template.substitute("Value: {{= invalidFunction(x) }}", { x: 1 });
      expect(result).toBe("Value: ");
    });

    it("should use transforms (pipe syntax)", () => {
      const result = template.substitute("Name: {{= name|upper }}", { name: "john" });
      expect(result).toBe("Name: JOHN");
    });

    it("should evaluate complex expressions", () => {
      const result = template.substitute("Full: {{= upper(default(user.name, 'Guest')) }}", { user: {} });
      expect(result).toBe("Full: GUEST");
    });

    it("should access nodes namespace", () => {
      const result = template.substitute("Email: {{= nodes.Get_Customer.email }}", {
        nodes: {
          Get_Customer: { email: "john@example.com" },
        },
      });
      expect(result).toBe("Email: john@example.com");
    });

    it("should evaluate multiple expressions", () => {
      const result = template.substitute("{{= upper(first) }} {{= lower(second) }}", {
        first: "hello",
        second: "WORLD",
      });
      expect(result).toBe("HELLO world");
    });

    it("should return empty string for null expression result", () => {
      const result = template.substitute("Value: {{= missing }}", {});
      expect(result).toBe("Value: ");
    });

    it("should handle whitespace in expression", () => {
      const result = template.substitute("Hello {{=   upper(name)   }}", { name: "john" });
      expect(result).toBe("Hello JOHN");
    });
  });

  describe("Wildcard Mode (JSON Dump)", () => {
    it("should dump entire object with {{path.*}}", () => {
      const result = template.substitute("User: {{user.*}}", {
        user: { name: "John", age: 30 },
      });
      expect(result).toBe('User: {\n  "name": "John",\n  "age": 30\n}');
    });

    it("should dump nested object with wildcard", () => {
      const result = template.substitute("Vars: {{vars.journey.*}}", {
        vars: {
          journey: { status: "active", total: 100 },
        },
      });
      expect(result).toBe('Vars: {\n  "status": "active",\n  "total": 100\n}');
    });

    it("should return empty object for missing wildcard path", () => {
      const result = template.substitute("Data: {{missing.*}}", {});
      expect(result).toBe("Data: {}");
    });

    it("should return empty object for null wildcard path", () => {
      const result = template.substitute("Data: {{user.*}}", { user: null });
      expect(result).toBe("Data: {}");
    });

    it("should dump root context with {{.*}}", () => {
      const result = template.substitute("All: {{.*}}", { a: 1, b: 2 });
      expect(result).toBe('All: {\n  "a": 1,\n  "b": 2\n}');
    });

    it("should mix wildcard and simple substitution", () => {
      const result = template.substitute("Hello {{user.name}}, your data: {{user.*}}", {
        user: { name: "John", score: 100 },
      });
      expect(result).toBe('Hello John, your data: {\n  "name": "John",\n  "score": 100\n}');
    });

    it("should work with agent context structure", () => {
      const agentContext = {
        user: {
          id: "telegram_123",
          firstName: "John",
          lastName: "Doe",
          vars: { preference: "dark" },
        },
        vars: {
          journey: { orderStatus: "shipped" },
          global: { supportEmail: "help@test.com" },
        },
        session: { id: "sess_1", status: "active" },
      };

      // Test single value
      expect(template.substitute("Hi {{user.firstName}}", agentContext)).toBe("Hi John");

      // Test wildcard on user
      const userDump = template.substitute("{{user.*}}", agentContext);
      expect(userDump).toContain('"firstName": "John"');
      expect(userDump).toContain('"lastName": "Doe"');

      // Test wildcard on journey vars
      const journeyVars = template.substitute("{{vars.journey.*}}", agentContext);
      expect(journeyVars).toContain('"orderStatus": "shipped"');
    });
  });
});

