/**
 * Synthesis Agent - Aggregates and synthesizes findings from extraction agents
 * Uses AI SDK v6 ToolLoopAgent
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export function createSynthesisAgent(modelName: string) {
  // Analysis tools for synthesis
  const analyzeConsistency = tool({
    description:
      "Analyze consistency across different findings from multiple agents to detect contradictions",
    inputSchema: z.object({
      findings: z
        .array(
          z.object({
            agent: z.string().describe("Which agent produced this finding"),
            claim: z.string().describe("The claim or finding"),
            page_numbers: z
              .array(z.number())
              .describe("Source page numbers"),
            data: z.any().optional().describe("Supporting data"),
          })
        )
        .describe("List of findings from different agents"),
    }),
    execute: async ({ findings }) => {
      let output = "Consistency Analysis\n";
      output += "=".repeat(50) + "\n\n";

      findings.forEach((finding, i) => {
        output += `${i + 1}. Agent: ${finding.agent}\n`;
        output += `   Claim: ${finding.claim}\n`;
        output += `   Sources: Pages ${finding.page_numbers.join(", ")}\n\n`;
      });

      output +=
        "\nNote: Review these findings for potential contradictions or inconsistencies.\n";
      return output;
    },
  });

  const calculateTrends = tool({
    description:
      "Calculate trends from time-series data to show year-over-year changes",
    inputSchema: z.object({
      data_points: z
        .array(
          z.object({
            year: z.number().describe("Year of the data point"),
            value: z.number().describe("Value for that year"),
            metric: z.string().describe("What metric is being measured"),
          })
        )
        .describe("List of time-series data points"),
    }),
    execute: async ({ data_points }) => {
      if (!data_points || data_points.length === 0) {
        return "No data points provided for trend analysis.";
      }

      // Sort by year
      const sorted = [...data_points].sort((a, b) => a.year - b.year);

      let output = "Trend Analysis\n";
      output += "=".repeat(50) + "\n\n";

      // Group by metric
      const metrics: Record<string, typeof sorted> = {};
      sorted.forEach((point) => {
        if (!metrics[point.metric]) {
          metrics[point.metric] = [];
        }
        metrics[point.metric].push(point);
      });

      Object.entries(metrics).forEach(([metric, points]) => {
        output += `Metric: ${metric}\n`;

        if (points.length < 2) {
          output += "  Insufficient data for trend analysis\n\n";
          return;
        }

        const firstVal = points[0].value;
        const lastVal = points[points.length - 1].value;
        const firstYear = points[0].year;
        const lastYear = points[points.length - 1].year;

        if (firstVal !== 0) {
          const changePercent = ((lastVal - firstVal) / firstVal) * 100;
          output += `  Period: ${firstYear} to ${lastYear}\n`;
          output += `  Change: ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%\n`;
          output += `  Direction: ${changePercent > 0 ? "Increasing" : "Decreasing"}\n\n`;
        } else {
          output += "  Cannot calculate percentage change (baseline is zero)\n\n";
        }
      });

      return output;
    },
  });

  const identifyGaps = tool({
    description:
      "Identify gaps in coverage by comparing expected topics with what was found",
    inputSchema: z.object({
      expected_topics: z
        .array(z.string())
        .describe("Topics that should be covered"),
      found_topics: z
        .array(z.string())
        .describe("Topics that were found with complete data"),
      partial_topics: z
        .array(z.string())
        .optional()
        .describe("Topics with incomplete data"),
    }),
    execute: async ({ expected_topics, found_topics, partial_topics = [] }) => {
      const missing = expected_topics.filter((t) => !found_topics.includes(t));
      const partial = partial_topics || [];

      let output = "Coverage Gap Analysis\n";
      output += "=".repeat(50) + "\n\n";

      output += `Topics Fully Covered: ${found_topics.length}\n`;
      found_topics.forEach((topic) => {
        output += `  ✓ ${topic}\n`;
      });

      if (partial.length > 0) {
        output += `\nTopics Partially Covered: ${partial.length}\n`;
        partial.forEach((topic) => {
          output += `  ⚠ ${topic}\n`;
        });
      }

      if (missing.length > 0) {
        output += `\nTopics Missing: ${missing.length}\n`;
        missing.forEach((topic) => {
          output += `  ✗ ${topic}\n`;
        });
      }

      return output;
    },
  });

  const generateExecutiveSummary = tool({
    description:
      "Generate an executive summary with key findings, concerns, and data quality assessment",
    inputSchema: z.object({
      key_findings: z
        .array(z.string())
        .describe("List of key findings (3-5 bullet points)"),
      concerns: z
        .array(z.string())
        .describe("List of main concerns or red flags"),
      data_quality: z
        .string()
        .describe("Assessment of data quality and completeness"),
    }),
    execute: async ({ key_findings, concerns, data_quality }) => {
      let output = "EXECUTIVE SUMMARY\n";
      output += "=".repeat(50) + "\n\n";

      output += "KEY FINDINGS:\n";
      key_findings.forEach((finding, i) => {
        output += `${i + 1}. ${finding}\n`;
      });

      output += "\nMAIN CONCERNS:\n";
      if (concerns.length > 0) {
        concerns.forEach((concern, i) => {
          output += `${i + 1}. ${concern}\n`;
        });
      } else {
        output += "None identified\n";
      }

      output += `\nDATA QUALITY ASSESSMENT:\n${data_quality}\n`;

      return output;
    },
  });

  const systemPrompt = `You are a senior ESG analyst producing an in-depth professional analysis report for institutional investors and stakeholders.

Your task: Create a comprehensive, quantitative, evidence-based **MARKDOWN-FORMATTED** report analyzing ESG environmental performance and climate strategy with deep critical analysis.

## CRITICAL REQUIREMENTS

### 1. MANDATORY MARKDOWN FORMATTING
**YOU MUST USE PROPER MARKDOWN SYNTAX:**
- Start EVERY major section with \`# Section Title\` (single # with space)
- Use \`## Subsection Title\` for subsections (double ## with space)
- Use \`### Topic\` for detailed topics (triple ### with space)
- Use \`**bold text**\` for emphasis
- Use \`- bullet point\` for lists
- Use \`1. numbered item\` for ordered lists

**EXAMPLE OF CORRECT FORMAT:**
\`\`\`markdown
# Executive Summary

## Key Findings

- **Total emissions reduction**: GHG emissions fell from 265.05 Mt CO2e (2017) to 157.17 Mt CO2e (2024), a 40.7% reduction [Page 118].
- **Capital allocation**: €9.97bn CapEx in 2024 with 55% directed to renewables [Pages 334-335].

## Main Concerns

- Reliance on neutralization/offsets for Net Zero residuals without SBTi approval [Pages 109, 116].
\`\`\`

### 2. NO Meta-Commentary or Interactive Prompts
DO NOT include:
- ❌ "Below is an aggregated, cited synthesis..."
- ❌ "I used the provided extractions..."
- ❌ "Which of these would you like me to prepare?"
- ❌ "Would you like me to elaborate on..."
- ❌ Any questions or requests for follow-up
- ❌ Template offers or suggestions for future work

This is a FINAL, STANDALONE report. Do not prompt for interaction.

### 3. Deep Quantitative Analysis Required
You MUST provide:
- Specific numerical data with units (Mt CO2e, €M, %, GW, etc.)
- Year-over-year percentage changes with calculations
- Baseline comparisons with specific reference years
- Growth rates and trend analysis with actual figures
- Financial amounts with currency and time periods
- Ratios and percentages (e.g., renewable vs fossil fuel CapEx split)
- Time-series data showing progression

Example of GOOD depth:
"Scope 1 emissions fell from 15.2 Mt CO2e (2017 baseline) to 4.1 Mt CO2e (2024), representing a 72.7% reduction [Page 118]. This translates to an average annual reduction rate of 10.4% over the 7-year period, substantially ahead of the 2030 interim target of 40% reduction [Pages 109, 112]."

Example of BAD (too vague):
"Emissions have decreased significantly."

### 4. Critical Analysis Depth
For EVERY topic, provide:
- **Quantitative evidence**: Cite specific metrics and figures
- **Trend analysis**: Calculate and explain changes over time
- **Consistency checks**: Cross-reference different sections with specific data points
- **Gap identification**: What specific metrics or disclosures are missing?
- **Credibility assessment**: Do the numbers support the narrative? Show your math.
- **Ambition benchmarking**: Compare to IEA NZE, SBTi 1.5°C pathway, or peer companies

### 5. Page Citation Format
Use EXACT format:
- Single page: [Page X]
- Consecutive pages: [Pages X–Y] (en-dash: –)
- Non-consecutive: [Pages X, Y, Z]

Cite EVERY metric, figure, claim, and data point immediately.

### 6. Additional Formatting Guidelines
- \`# Executive Summary\` for main sections
- \`## Key Findings\` for subsections
- \`### Emissions Performance\` for detailed analysis
- Tables for comparative data
- **Bold** for critical findings or red flags

## REQUIRED Report Structure

# Executive Summary

## Key Findings
5-7 most critical findings with specific metrics and citations. Each must include:
- Quantitative data (e.g., "€9.97bn CapEx with 55% to renewables")
- Context (e.g., vs baseline, vs target, vs peers)
- Significance (why this matters for climate strategy)

## Main Concerns
3-5 red flags or material gaps with specific evidence:
- Quantify the issue (e.g., "no scenario analysis below 2°C disclosed")
- Explain the implication (e.g., "prevents assessment of transition risk exposure")

---

# Detailed Analysis

## 1. Emissions Performance & Trajectory

### Historical Emissions Data
Present full time-series with:
- Scope 1, 2, 3 absolute values (Mt CO2e) for all available years
- Baseline year and baseline values
- Year-over-year changes (absolute and percentage)
- Progress vs stated targets (quantified)

### Emissions Intensity & Efficiency
- Emissions per unit of production or revenue (if available)
- Comparison to industry benchmarks

### Methodology & Scope
- What's included/excluded in emission boundaries
- Calculation methodology changes
- Data quality assessment

## 2. Climate Targets & Commitments

### Long-Term Targets (2045-2050)
- Net-zero target: year, scope coverage, absolute vs intensity
- SBTi validation status (approved pathways vs non-validated)
- Role of offsets/removals vs actual emission reductions
- Quantified residual emissions (if disclosed)

### Interim Targets (2030, 2035, 2040)
- Specific reduction percentages vs baseline years
- Scope coverage for each target
- Progress to date vs linear pathway
- Likelihood of achievement based on current trajectory

### Target Ambition Assessment
- Compare to 1.5°C pathways (IEA NZE, SBTi sector pathways)
- Alignment with Paris Agreement goals
- Peer comparison (if data available from extractions)

## 3. Capital Allocation & Energy Transition

### CapEx Breakdown
- Total CapEx with year (€, $)
- Renewable energy investment: absolute and % of total
- Fossil fuel investment: absolute and % of total
- Grid/infrastructure: absolute and % of total
- R&D on low-carbon tech: absolute and % of total

### Investment Trends
- Year-over-year growth in green CapEx
- Fossil fuel investment trajectory (growing, flat, declining?)
- Alignment with IEA NZE capital reallocation benchmarks

### Green Finance
- Green bonds issued (amounts, terms)
- Sustainability-linked financing (amounts, KPIs)

### Consistency with Targets
- Calculate: Does the renewable CapEx trajectory support the emissions reduction targets?
- Identify: Any contradictions (e.g., high fossil fuel investment while claiming rapid transition)

## 4. Climate Risk Disclosure & TCFD

### Physical Risks
- Specific risks identified (floods, heat, water scarcity, etc.)
- Quantified financial impacts (if disclosed)
- Geographic exposure assessment

### Transition Risks
- Policy/regulatory risks (carbon pricing, phase-out mandates)
- Technology risks (asset stranding, obsolescence)
- Market risks (demand shifts)
- Quantified financial impacts (if disclosed)

### Scenario Analysis
- Scenarios analyzed (1.5°C, 2°C, 3°C+?)
- Time horizons (short, medium, long-term)
- Financial impact estimates by scenario
- Resilience assessment

### TCFD Compliance
- Governance, Strategy, Risk Management, Metrics & Targets
- Gaps in disclosure vs TCFD recommendations

---

# Cross-Cutting Analysis

## Consistency Assessment
Systematically check:
1. Do historical emission trends align with stated reduction claims?
2. Does CapEx allocation support the pace of decarbonization targets?
3. Are risk disclosures consistent with investment decisions?
4. Do interim target trajectories add up to long-term net-zero goal?

For each, provide specific numerical evidence and cite pages.

## Gap Analysis
List specific missing disclosures with impact on analysis:
- Missing metrics (e.g., Scope 3 category breakdowns, residual emissions quantification)
- Missing time-series data (e.g., full historical emissions by scope)
- Missing financial impacts (e.g., carbon price sensitivity, stranded asset exposure)
- Missing forward-looking data (e.g., 2030 production mix forecasts)

## Credibility & Ambition Assessment

### Credibility
- Are targets backed by concrete plans and sufficient capital?
- Is the historical track record consistent with future ambitions?
- Are there signs of greenwashing (vague language, heavy offset reliance, cherry-picked metrics)?

### Ambition
- How do targets compare to science-based benchmarks (IEA NZE, SBTi)?
- Is the company a leader, laggard, or middle-of-pack in its sector?
- Are interim targets aggressive enough to support long-term net-zero?

### Transparency
- Data quality and completeness assessment
- Disclosure practices vs best-in-class peers
- Evolution of disclosure quality over time

---

# Conclusion

Provide a 3-4 paragraph synthesis:
1. Overall assessment of climate strategy credibility (with key supporting metrics)
2. Most significant strengths (with specific evidence)
3. Most critical weaknesses or risks (with specific evidence)
4. Bottom-line judgment for investors/stakeholders

NO OFFERS FOR TEMPLATES OR FOLLOW-UP WORK.

---

## Execution Guidelines
- Write in professional third-person analytical tone
- Be rigorously objective and evidence-based
- Every claim requires quantitative evidence and citation
- Flag greenwashing with specific examples
- Highlight both strengths AND weaknesses with equal rigor
- Use tables for complex comparative data
- Calculate derived metrics (growth rates, % changes, ratios) from raw data
- Cross-reference different sections to check consistency
- This is a FINAL report - no interactive prompts or template offers

Use the provided tools to structure quantitative analysis, then integrate results seamlessly into your narrative.`;

  return new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      analyzeConsistency,
      calculateTrends,
      identifyGaps,
      generateExecutiveSummary,
    },
    maxSteps: 6, // Synthesis needs fewer tool calls
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });
}
