import type { PhantomConfig } from "../config/types.ts";

export type RoutedModel = {
	model: string;
	effort: PhantomConfig["effort"];
	reason: string;
};

const HAIKU_MODEL = "claude-haiku-4-5";

const HEAVY_LIFTING_PATTERN =
	/\b(file|files|path|paths|repo|repository|code|coding|implement|fix|debug|refactor|patch|edit|rename|test|tests|build|deploy|docker|terminal|shell|bash|powershell|command|script|function|class|module|stack\s*trace|error\s*log|traceback|diff|commit|pull\s+request|pr\b|tool|tools|search|grep|query|database|sql|api|endpoint|auth|token|permission|config|yaml|json|typescript|javascript|react|frontend|backend)\b|(?:^|[\s(])(?:package\.json|tsconfig\.json|dockerfile|compose\.ya?ml|\.env|README\.md|[A-Za-z0-9_\-/\\]+\.(?:ts|tsx|js|jsx|json|ya?ml|md|sql|sh|ps1))(?=$|[\s):])/i;

const LIGHTWEIGHT_PATTERN =
	/\b(status|health|uptime|version|summari[sz]e|summary|summarise|rewrite|rephrase|shorten|polish|proofread|title|subject\s+line|button\s+text|label|copy|microcopy|ui\s+text|one-liner|one\s+liner|briefly|brief answer|quick answer|what is|who is|when is|where is)\b/i;

export function selectRuntimeModel(config: PhantomConfig, prompt: string): RoutedModel {
	const advanced = config.model;
	const advancedEffort = config.effort;
	const cheap = resolveCheapModel(config.model);

	// If the configured primary model is already Haiku, there is nothing cheaper to route to.
	if (cheap === advanced) {
		return {
			model: advanced,
			effort: advancedEffort,
			reason: "configured primary model is already the cheap tier",
		};
	}

	const trimmed = prompt.trim();
	const normalized = trimmed.toLowerCase();
	const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
	const lineCount = trimmed.length === 0 ? 0 : trimmed.split(/\r?\n/).length;
	const hasHeavySignals = HEAVY_LIFTING_PATTERN.test(trimmed);
	const hasLightSignals = LIGHTWEIGHT_PATTERN.test(trimmed);
	const isLong = trimmed.length > 900 || wordCount > 180 || lineCount > 8;
	const isAmbiguous = /\b(compare|tradeoff|trade-off|architecture|design|strategy|plan|investigate|analyze|analyse|deep dive)\b/i.test(
		trimmed,
	);
	const isShortQuestion = trimmed.length > 0 && trimmed.length < 240 && lineCount <= 3;
	const isSmallTalk = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|nice)\b/i.test(normalized);

	if (hasHeavySignals) {
		return { model: advanced, effort: advancedEffort, reason: "code, files, tools, or implementation work requested" };
	}

	if (isLong || isAmbiguous) {
		return { model: advanced, effort: advancedEffort, reason: "prompt is long or requires deeper reasoning" };
	}

	if (isSmallTalk) {
		return { model: cheap, effort: "low", reason: "small talk or acknowledgement" };
	}

	if (hasLightSignals || isShortQuestion) {
		return { model: cheap, effort: "low", reason: "short Q&A, status, summarization, or lightweight copy" };
	}

	return { model: advanced, effort: advancedEffort, reason: "defaulting to the primary model for unclear requests" };
}

function resolveCheapModel(primaryModel: string): string {
	if (primaryModel.includes("haiku")) return primaryModel;
	return HAIKU_MODEL;
}
