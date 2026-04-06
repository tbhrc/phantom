import { describe, expect, test } from "bun:test";
import { selectRuntimeModel } from "../model-router.ts";

const baseConfig = {
	name: "phantom",
	port: 3100,
	role: "swe",
	model: "claude-sonnet-4-6",
	effort: "max" as const,
	max_budget_usd: 0,
	timeout_minutes: 240,
};

describe("selectRuntimeModel", () => {
	test("routes short status checks to Haiku", () => {
		const route = selectRuntimeModel(baseConfig, "What's Phantom's current status?");
		expect(route.model).toBe("claude-haiku-4-5");
		expect(route.effort).toBe("low");
	});

	test("routes summarization requests to Haiku", () => {
		const route = selectRuntimeModel(baseConfig, "Summarize this meeting note in 3 bullets.");
		expect(route.model).toBe("claude-haiku-4-5");
	});

	test("routes UI copy requests to Haiku", () => {
		const route = selectRuntimeModel(baseConfig, "Write a short button label for retrying checkout.");
		expect(route.model).toBe("claude-haiku-4-5");
	});

	test("routes code and file work to the primary model", () => {
		const route = selectRuntimeModel(baseConfig, "Update src/index.ts and fix the failing Docker config.");
		expect(route.model).toBe("claude-sonnet-4-6");
		expect(route.effort).toBe("max");
	});

	test("routes tool-heavy work to the primary model", () => {
		const route = selectRuntimeModel(baseConfig, "Search the repo, inspect package.json, and patch the test failure.");
		expect(route.model).toBe("claude-sonnet-4-6");
	});

	test("routes long prompts to the primary model", () => {
		const route = selectRuntimeModel(baseConfig, "Please analyze ".repeat(80));
		expect(route.model).toBe("claude-sonnet-4-6");
	});

	test("keeps Haiku when it is already the configured primary model", () => {
		const route = selectRuntimeModel({ ...baseConfig, model: "claude-haiku-4-5", effort: "medium" }, "What is the status?");
		expect(route.model).toBe("claude-haiku-4-5");
		expect(route.effort).toBe("medium");
	});
});
