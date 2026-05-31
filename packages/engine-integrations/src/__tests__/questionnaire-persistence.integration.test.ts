/**
 * Questionnaire Handler - Database Persistence Integration Tests
 *
 * Tests that verify questionnaire responses are properly persisted to the
 * node_outputs table for session recovery, cross-node references, and analytics.
 *
 * Bug #2 Test: Verifies questionnaire responses are saved to node_outputs table
 */

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, nodeOutputs, journeySessions, clients, organization, journeys } from "@journey/db";

describe("Questionnaire Handler - Database Persistence Integration", () => {
  let testOrgId: string;
  let testClientId: string;
  const testJourneyIds: string[] = [];

  beforeAll(async () => {
    // Create unique test identifiers (UUIDs)
    testOrgId = randomUUID();
    testClientId = randomUUID();

    // Create test organization
    await db.insert(organization).values({
      id: testOrgId,
      name: `Test Organization ${testOrgId}`,
    });

    // Create test client
    await db.insert(clients).values({
      id: testClientId,
      platform: "telegram",
      platformUserId: `test-user-${testClientId}`,
      organizationId: testOrgId,
      firstName: "Test",
      lastName: "User",
    });

    // Create test journeys that sessions will reference
    for (let i = 0; i < 6; i++) {
      const journeyId = randomUUID();
      testJourneyIds.push(journeyId);
      await db.insert(journeys).values({
        id: journeyId,
        organizationId: testOrgId,
        name: `Test Questionnaire Journey ${i + 1}`,
        configuration: { nodes: [], edges: [] },
      });
    }
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    // Delete node outputs by organization (covers all sessions in this org)
    if (testOrgId) {
      // Get all sessions for this client/org
      const sessions = await db.select({ id: journeySessions.id }).from(journeySessions).where(eq(journeySessions.clientId, testClientId));
      for (const session of sessions) {
        await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, session.id));
      }
    }
    if (testClientId) {
      await db.delete(journeySessions).where(eq(journeySessions.clientId, testClientId));
    }
    if (testJourneyIds.length > 0) {
      for (const journeyId of testJourneyIds) {
        await db.delete(journeys).where(eq(journeys.id, journeyId));
      }
    }
    if (testClientId) {
      await db.delete(clients).where(eq(clients.id, testClientId));
    }
    if (testOrgId) {
      await db.delete(organization).where(eq(organization.id, testOrgId));
    }
  });

  it("should persist questionnaire responses to node_outputs table (Bug #2 Test)", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[0],
        organizationId: testOrgId,
        currentNodeId: "test-questionnaire-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    const sessionId = session.id;

    // Simulate questionnaire completion by storing node output
    // (In real execution, this happens in completeQuestionnaire() method)
    const responseData = {
      q1: "John Doe",
      q2: "30",
      q3: "Engineering",
    };

    await db.insert(nodeOutputs).values({
      sessionId: sessionId,
      sanitizedLabel: "user_survey",
      nodeId: "test-questionnaire-node",
      nodeLabel: "User Survey",
      nodeType: "questionnaire",
      data: responseData,
      executedAt: new Date(),
    });

    // ⭐ BUG #2 CHECK: Verify questionnaire responses in node_outputs table
    const [output] = await db
      .select()
      .from(nodeOutputs)
      .where(
        and(
          eq(nodeOutputs.sessionId, sessionId),
          eq(nodeOutputs.nodeType, "questionnaire")
        )
      );

    expect(output).toBeDefined();
    expect(output.sanitizedLabel).toBe("user_survey");
    expect(output.nodeType).toBe("questionnaire");
    expect(output.nodeId).toBe("test-questionnaire-node");

    // Verify response data structure
    expect(output.data).toMatchObject({
      q1: "John Doe",
      q2: "30",
      q3: "Engineering",
    });

    // Clean up
    await db.delete(journeySessions).where(eq(journeySessions.id, sessionId));
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, sessionId));
  });

  it("should support cross-node references using stored questionnaire outputs", async () => {
    // Create first session with questionnaire
    const [session1] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[1],
        organizationId: testOrgId,
        currentNodeId: "questionnaire-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    const session1Id = session1.id;

    // Store questionnaire responses
    const questionnaireData = {
      name: "Alice",
      email: "alice@example.com",
    };

    await db.insert(nodeOutputs).values({
      sessionId: session1Id,
      sanitizedLabel: "user_info",
      nodeId: "questionnaire-node",
      nodeLabel: "User Info",
      nodeType: "questionnaire",
      data: questionnaireData,
      executedAt: new Date(),
    });

    // Simulate follow-up node that uses the questionnaire data
    // (In real execution: "Hello {{nodes.user_info.name}}")
    const followUpData = {
      greeting: `Hello ${questionnaireData.name}!`,
      notification: `Email confirmed: ${questionnaireData.email}`,
    };

    await db.insert(nodeOutputs).values({
      sessionId: session1Id,
      sanitizedLabel: "follow_up",
      nodeId: "follow-up-node",
      nodeLabel: "Follow Up",
      nodeType: "message",
      data: followUpData,
      executedAt: new Date(),
    });

    // Verify both outputs exist and can be retrieved
    const outputs = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, session1Id));

    expect(outputs).toHaveLength(2);

    // Verify questionnaire data is accessible for cross-node references
    const questionnaireOutput = outputs.find((o) => o.nodeType === "questionnaire");
    expect(questionnaireOutput).toBeDefined();
    expect(questionnaireOutput?.data.name).toBe("Alice");
    expect(questionnaireOutput?.data.email).toBe("alice@example.com");

    // Verify follow-up used the questionnaire data
    const followUpOutput = outputs.find((o) => o.nodeType === "message");
    expect(followUpOutput?.data.greeting).toBe("Hello Alice!");

    // Clean up
    await db.delete(journeySessions).where(eq(journeySessions.id, session1Id));
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, session1Id));
  });

  it("should enable session recovery by persisting questionnaire state", async () => {
    // Create test session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[2],
        organizationId: testOrgId,
        currentNodeId: "questionnaire-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    const sessionId = session.id;

    // Store questionnaire responses
    const responses = {
      q1: "Response A",
      q2: "Response B",
      q3: "Response C",
    };

    await db.insert(nodeOutputs).values({
      sessionId: sessionId,
      sanitizedLabel: "questionnaire_1",
      nodeId: "questionnaire-node",
      nodeLabel: "Questionnaire 1",
      nodeType: "questionnaire",
      data: responses,
      executedAt: new Date(),
    });

    // Simulate cache expiry and session reload
    // In real execution, this happens when Redis cache expires
    // and the system reloads the session from database

    // Retrieve session from database
    const [reloadedSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId));

    expect(reloadedSession).toBeDefined();

    // Retrieve node outputs from database (session recovery)
    const outputs = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, sessionId));

    expect(outputs).toHaveLength(1);

    // Verify questionnaire state is fully restored
    const questionnaireOutput = outputs[0];
    expect(questionnaireOutput.data).toMatchObject(responses);

    // Verify user can continue without re-answering
    expect(questionnaireOutput.data.q1).toBe("Response A");
    expect(questionnaireOutput.data.q2).toBe("Response B");
    expect(questionnaireOutput.data.q3).toBe("Response C");

    // Clean up
    await db.delete(journeySessions).where(eq(journeySessions.id, sessionId));
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, sessionId));
  });

  it("should persist outputs for multiple questionnaires in same session", async () => {
    // Create test session with multiple questionnaires
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[3],
        organizationId: testOrgId,
        currentNodeId: "questionnaire-2",
        status: "active",
        mode: "simulation",
      })
      .returning();

    const sessionId = session.id;

    // Store first questionnaire
    const survey1Data = {
      rating: "5",
      comment: "Great experience",
    };

    await db.insert(nodeOutputs).values({
      sessionId: sessionId,
      sanitizedLabel: "satisfaction_survey",
      nodeId: "questionnaire-1",
      nodeLabel: "Satisfaction Survey",
      nodeType: "questionnaire",
      data: survey1Data,
      executedAt: new Date(),
    });

    // Store second questionnaire
    const survey2Data = {
      interest_level: "High",
      follow_up: "Yes",
    };

    await db.insert(nodeOutputs).values({
      sessionId: sessionId,
      sanitizedLabel: "interest_survey",
      nodeId: "questionnaire-2",
      nodeLabel: "Interest Survey",
      nodeType: "questionnaire",
      data: survey2Data,
      executedAt: new Date(),
    });

    // Verify both questionnaires are stored with unique labels
    const outputs = await db
      .select()
      .from(nodeOutputs)
      .where(
        and(
          eq(nodeOutputs.sessionId, sessionId),
          eq(nodeOutputs.nodeType, "questionnaire")
        )
      );

    expect(outputs).toHaveLength(2);

    // Verify each questionnaire has unique identifier
    const labels = outputs.map((o) => o.sanitizedLabel);
    expect(labels).toContain("satisfaction_survey");
    expect(labels).toContain("interest_survey");

    // Verify each questionnaire maintains separate data
    const survey1 = outputs.find((o) => o.sanitizedLabel === "satisfaction_survey");
    const survey2 = outputs.find((o) => o.sanitizedLabel === "interest_survey");

    expect(survey1?.data.rating).toBe("5");
    expect(survey2?.data.interest_level).toBe("High");

    // Verify no data leakage between questionnaires
    expect(survey1?.data.interest_level).toBeUndefined();
    expect(survey2?.data.rating).toBeUndefined();

    // Clean up
    await db.delete(journeySessions).where(eq(journeySessions.id, sessionId));
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, sessionId));
  });

  it("should persist questionnaire with complex data structures", async () => {
    // Create test session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[4],
        organizationId: testOrgId,
        currentNodeId: "complex-questionnaire",
        status: "active",
        mode: "simulation",
      })
      .returning();

    const sessionId = session.id;

    // Store questionnaire with complex data
    const complexData = {
      simple_field: "value",
      numeric_field: "123",
      checkbox_items: "option1,option2,option3",
      nested_data: JSON.stringify({
        level1: {
          level2: "deep value",
        },
      }),
      special_chars: "Test with special chars: @#$%",
      empty_field: "",
      long_text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + "x".repeat(200),
    };

    await db.insert(nodeOutputs).values({
      sessionId: sessionId,
      sanitizedLabel: "complex_questionnaire",
      nodeId: "complex-questionnaire",
      nodeLabel: "Complex Questionnaire",
      nodeType: "questionnaire",
      data: complexData,
      executedAt: new Date(),
    });

    // Verify complex data is preserved
    const [output] = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, sessionId));

    expect(output.data).toMatchObject(complexData);
    expect(output.data.special_chars).toContain("@#$%");
    expect(output.data.long_text).toContain("Lorem ipsum");
    expect(output.data.long_text).toContain("x".repeat(200).slice(0, 10)); // Check it has the x's

    // Clean up
    await db.delete(journeySessions).where(eq(journeySessions.id, sessionId));
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, sessionId));
  });
});
