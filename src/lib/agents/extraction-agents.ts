/**
 * Specialized Extraction Agents for different ESG topics
 * Uses AI SDK v6 ToolLoopAgent
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

/**
 * Emissions Extraction Agent
 * Specialized in extracting GHG emissions data (Scope 1, 2, 3)
 */
export function createEmissionsExtractor(
  modelName: string,
  weaviateTools: Record<string, any>
) {
  const structureEmissionsData = tool({
    description:
      "Structure extracted emissions data in a standardized format with calculations",
    inputSchema: z.object({
      scope: z
        .string()
        .describe('Emission scope (e.g., "Scope 1", "Scope 2", "Scope 3")'),
      year: z.number().describe("Year of the emission data"),
      value: z.number().describe("Emission value"),
      unit: z.string().describe('Unit of measurement (e.g., "Mt CO2e")'),
      page_number: z.number().describe("Source page number"),
      baseline_year: z
        .number()
        .optional()
        .describe("Optional baseline year for comparison"),
      baseline_value: z
        .number()
        .optional()
        .describe("Optional baseline value for comparison"),
    }),
    execute: async ({
      scope,
      year,
      value,
      unit,
      page_number,
      baseline_year,
      baseline_value,
    }) => {
      const data: any = {
        scope,
        year,
        value,
        unit,
        source_page: page_number,
      };

      if (baseline_year && baseline_value) {
        data.baseline = { year: baseline_year, value: baseline_value };
        const changePercent =
          ((value - baseline_value) / baseline_value) * 100;
        data.change_vs_baseline = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;
      }

      return JSON.stringify(data, null, 2);
    },
  });

  const systemPrompt = `You are an Emissions Extraction Agent specialized in GHG emissions analysis.

Your expertise:
- Extracting Scope 1, 2, and 3 greenhouse gas emissions data
- Identifying baseline years and values
- Calculating year-over-year trends
- Understanding emission methodologies and reporting standards

Tasks:
1. Search the provided page ranges for emissions data
2. Extract all quantitative emissions figures with:
   - Scope (1, 2, or 3)
   - Year
   - Value and unit
   - Source page number
3. Identify baseline years and calculate changes
4. Note any methodology changes or exclusions

Guidelines:
- Always cite page numbers for all figures
- Distinguish between market-based and location-based Scope 2
- Note if emissions include or exclude specific activities
- Flag any data gaps or inconsistencies
- Use the structureEmissionsData tool to format your findings

Be precise with numbers and units. If data is unclear or missing, explicitly state this.`;

  return new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      ...weaviateTools,
      structureEmissionsData,
    },
    maxSteps: 8, // Limit steps to avoid overwhelming reasoning models
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });
}

/**
 * Targets Extraction Agent
 * Specialized in extracting climate targets and commitments
 */
export function createTargetsExtractor(
  modelName: string,
  weaviateTools: Record<string, any>
) {
  const structureTargetData = tool({
    description:
      "Structure extracted target data with all relevant details and commitments",
    inputSchema: z.object({
      target_type: z
        .string()
        .describe(
          'Type of target (e.g., "Net Zero", "Interim", "Carbon Neutral")'
        ),
      target_year: z.number().describe("Year the target should be achieved"),
      reduction_percentage: z
        .string()
        .describe('Reduction target (e.g., "-40%", "100%")'),
      base_year: z.number().describe("Baseline year for the target"),
      scope_coverage: z
        .string()
        .describe(
          'Which scopes are covered (e.g., "Scope 1+2", "All scopes")'
        ),
      page_number: z.number().describe("Source page number"),
      sbti_aligned: z
        .boolean()
        .optional()
        .describe("Whether aligned with Science Based Targets initiative"),
      additional_notes: z
        .string()
        .optional()
        .describe("Any caveats or additional context"),
    }),
    execute: async ({
      target_type,
      target_year,
      reduction_percentage,
      base_year,
      scope_coverage,
      page_number,
      sbti_aligned,
      additional_notes,
    }) => {
      const data: any = {
        target_type,
        target_year,
        reduction_percentage,
        base_year,
        scope_coverage,
        source_page: page_number,
      };

      if (sbti_aligned !== undefined) {
        data.sbti_aligned = sbti_aligned;
      }

      if (additional_notes) {
        data.notes = additional_notes;
      }

      return JSON.stringify(data, null, 2);
    },
  });

  const systemPrompt = `You are a Targets Extraction Agent specialized in climate commitments and targets.

Your expertise:
- Identifying net-zero and carbon neutrality commitments
- Extracting interim reduction targets
- Understanding Science-Based Targets (SBTi) framework
- Analyzing target ambition and credibility

Tasks:
1. Extract all climate-related targets:
   - Net-zero targets
   - Carbon neutrality commitments
   - Interim reduction targets (e.g., 2030, 2035)
   - Renewable energy targets
2. For each target, identify:
   - Target year
   - Reduction percentage
   - Base year
   - Scope coverage
   - SBTi alignment
   - Any caveats or exclusions

Guidelines:
- Distinguish between absolute and intensity targets
- Note if targets use offsets or removals
- Identify if targets are conditional or unconditional
- Check for consistency across different report sections
- Use structureTargetData to format findings

Be critical: identify both the stated targets and any limitations or caveats.`;

  return new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      ...weaviateTools,
      structureTargetData,
    },
    maxSteps: 8, // Limit steps to avoid overwhelming reasoning models
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });
}

/**
 * Investment Extraction Agent
 * Specialized in extracting capital allocation and investment data
 */
export function createInvestmentExtractor(
  modelName: string,
  weaviateTools: Record<string, any>
) {
  const structureInvestmentData = tool({
    description:
      "Structure extracted investment data with amounts and allocation percentages",
    inputSchema: z.object({
      investment_category: z
        .string()
        .describe('Category (e.g., "Renewables", "Gas", "R&D")'),
      amount: z.number().describe("Investment amount"),
      currency: z.string().describe('Currency (e.g., "EUR", "USD")'),
      time_period: z
        .string()
        .describe('Time period (e.g., "2024", "2024-2030")'),
      page_number: z.number().describe("Source page number"),
      projects: z
        .array(z.string())
        .optional()
        .describe("List of specific projects or initiatives"),
      allocation_percentage: z
        .number()
        .optional()
        .describe("Percentage of total capex"),
    }),
    execute: async ({
      investment_category,
      amount,
      currency,
      time_period,
      page_number,
      projects,
      allocation_percentage,
    }) => {
      const data: any = {
        category: investment_category,
        amount,
        currency,
        period: time_period,
        source_page: page_number,
      };

      if (projects && projects.length > 0) {
        data.projects = projects;
      }

      if (allocation_percentage !== undefined) {
        data.allocation_pct = allocation_percentage;
      }

      return JSON.stringify(data, null, 2);
    },
  });

  const systemPrompt = `You are an Investment Extraction Agent specialized in energy transition investments.

Your expertise:
- Extracting CapEx and OpEx allocations
- Identifying renewable energy investments
- Tracking fossil fuel exposure and divestment
- Analyzing R&D spending on low-carbon technologies

Tasks:
1. Extract investment data:
   - Renewable energy CapEx (solar, wind, hydro, etc.)
   - Fossil fuel investments (gas, coal)
   - Grid and infrastructure spending
   - R&D on low-carbon technologies
   - M&A activity related to transition
2. For each investment, identify:
   - Amount and currency
   - Time period
   - Specific projects or programs
   - Percentage of total capital allocation

Guidelines:
- Distinguish between committed and planned investments
- Note any divestment or phase-out plans
- Compare green vs. fossil fuel investment ratios
- Identify alignment with climate targets
- Use structureInvestmentData to format findings

Focus on the financial commitment to the energy transition.`;

  return new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      ...weaviateTools,
      structureInvestmentData,
    },
    maxSteps: 8, // Limit steps to avoid overwhelming reasoning models
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });
}

/**
 * Risk Extraction Agent
 * Specialized in extracting climate risk assessments
 */
export function createRiskExtractor(
  modelName: string,
  weaviateTools: Record<string, any>
) {
  const structureRiskData = tool({
    description:
      "Structure extracted risk data with categories, impacts and mitigation strategies",
    inputSchema: z.object({
      risk_category: z
        .string()
        .describe(
          'Category (e.g., "Physical", "Transition", "Regulatory")'
        ),
      risk_type: z
        .string()
        .describe(
          'Specific risk type (e.g., "Water scarcity", "Carbon pricing")'
        ),
      description: z.string().describe("Description of the risk"),
      page_number: z.number().describe("Source page number"),
      mitigation_strategy: z
        .string()
        .optional()
        .describe("How the company plans to mitigate"),
      financial_impact: z
        .string()
        .optional()
        .describe("Estimated financial impact if available"),
      time_horizon: z
        .string()
        .optional()
        .describe(
          "When the risk may materialize (short/medium/long-term)"
        ),
    }),
    execute: async ({
      risk_category,
      risk_type,
      description,
      page_number,
      mitigation_strategy,
      financial_impact,
      time_horizon,
    }) => {
      const data: any = {
        category: risk_category,
        type: risk_type,
        description,
        source_page: page_number,
      };

      if (mitigation_strategy) {
        data.mitigation = mitigation_strategy;
      }

      if (financial_impact) {
        data.financial_impact = financial_impact;
      }

      if (time_horizon) {
        data.time_horizon = time_horizon;
      }

      return JSON.stringify(data, null, 2);
    },
  });

  const systemPrompt = `You are a Risk Extraction Agent specialized in climate-related risk analysis.

Your expertise:
- TCFD (Task Force on Climate-related Financial Disclosures) framework
- Physical climate risks (floods, droughts, extreme weather)
- Transition risks (policy, technology, market, reputation)
- Climate scenario analysis

Tasks:
1. Extract climate risk assessments:
   - Physical risks to operations
   - Transition risks (policy changes, carbon pricing, technology shifts)
   - Regulatory and compliance risks
   - Market and reputation risks
2. For each risk, identify:
   - Category and type
   - Description and potential impact
   - Time horizon (short/medium/long-term)
   - Mitigation strategies
   - Financial impact estimates (if disclosed)

Guidelines:
- Follow TCFD structure if report uses it
- Note any scenario analysis performed (e.g., 1.5°C, 2°C scenarios)
- Identify whether risks are quantified or qualitative
- Extract any stress testing or resilience assessments
- Use structureRiskData to format findings

Look for both disclosed risks and potential gaps in risk assessment.`;

  return new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      ...weaviateTools,
      structureRiskData,
    },
    maxSteps: 8, // Limit steps to avoid overwhelming reasoning models
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });
}
