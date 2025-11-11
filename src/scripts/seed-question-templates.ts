/**
 * Script to seed default question templates into the database
 * This can be run manually when needed to restore default templates
 *
 * Usage: bun src/scripts/seed-question-templates.ts
 */

import { SQL } from "bun";

const dbPath = process.env.DATABASE_PATH || "./data/database/chat.db";
const db = new SQL(`sqlite://${dbPath}`);

async function seedQuestionTemplates() {
  console.log("🌱 Seeding question templates...\n");

  try {
    // Check if global templates already exist
    const existingTemplates = await db`
      SELECT COUNT(*) as count FROM question_templates WHERE is_global = 1
    `;

    const count = existingTemplates[0]?.count || 0;

    if (count > 0) {
      console.log(`⚠️  Found ${count} existing global templates.`);
      console.log("Do you want to:");
      console.log("  1. Skip seeding (keep existing)");
      console.log("  2. Delete existing and re-seed");
      console.log("  3. Add new templates (keep existing)");

      // For now, we'll skip if templates exist
      // You can enhance this to accept user input
      console.log("\n✅ Skipping - templates already exist.");
      console.log("   To force re-seed, delete global templates first:");
      console.log("   DELETE FROM question_templates WHERE is_global = 1;\n");
      process.exit(0);
    }

    // Define default templates
    const defaultTemplates = [
      // ESG - Environmental
      {
        title: 'GHG Emissions (Scope 1)',
        text: 'What are the Scope 1 greenhouse gas emissions reported in this document?',
        category: 'ESG - Environmental'
      },
      {
        title: 'GHG Emissions (Scope 2)',
        text: 'What are the Scope 2 greenhouse gas emissions reported in this document?',
        category: 'ESG - Environmental'
      },
      {
        title: 'GHG Emissions (Scope 3)',
        text: 'What are the Scope 3 greenhouse gas emissions reported in this document?',
        category: 'ESG - Environmental'
      },
      {
        title: 'Water Consumption',
        text: 'What is the total water consumption reported in this document?',
        category: 'ESG - Environmental'
      },
      {
        title: 'Waste Management',
        text: 'What are the waste management practices and metrics reported?',
        category: 'ESG - Environmental'
      },
      {
        title: 'Renewable Energy',
        text: 'What percentage of energy comes from renewable sources?',
        category: 'ESG - Environmental'
      },
      {
        title: 'Biodiversity Impact',
        text: 'What are the impacts on biodiversity and conservation efforts mentioned?',
        category: 'ESG - Environmental'
      },

      // ESG - Social
      {
        title: 'Employee Diversity',
        text: 'What are the workforce diversity metrics reported?',
        category: 'ESG - Social'
      },
      {
        title: 'Gender Pay Gap',
        text: 'What is the gender pay gap reported in this document?',
        category: 'ESG - Social'
      },
      {
        title: 'Health & Safety',
        text: 'What are the occupational health and safety metrics?',
        category: 'ESG - Social'
      },
      {
        title: 'Employee Training',
        text: 'What training and development programs are provided to employees?',
        category: 'ESG - Social'
      },
      {
        title: 'Human Rights',
        text: 'What human rights policies and practices are described?',
        category: 'ESG - Social'
      },

      // ESG - Governance
      {
        title: 'Board Composition',
        text: 'What is the composition of the board of directors?',
        category: 'ESG - Governance'
      },
      {
        title: 'Executive Compensation',
        text: 'What are the executive compensation details?',
        category: 'ESG - Governance'
      },
      {
        title: 'Anti-Corruption',
        text: 'What anti-corruption and anti-bribery policies are in place?',
        category: 'ESG - Governance'
      },
      {
        title: 'Data Privacy',
        text: 'What data privacy and security measures are implemented?',
        category: 'ESG - Governance'
      },

      // Financial
      {
        title: 'Revenue Growth',
        text: 'What is the revenue growth reported for this period?',
        category: 'Financial'
      },
      {
        title: 'Profit Margins',
        text: 'What are the profit margins reported?',
        category: 'Financial'
      },
      {
        title: 'Capital Expenditure',
        text: 'What are the capital expenditures (CapEx) for this period?',
        category: 'Financial'
      },
      {
        title: 'Debt Levels',
        text: 'What are the current debt levels and debt-to-equity ratio?',
        category: 'Financial'
      },
    ];

    console.log(`📝 Inserting ${defaultTemplates.length} default templates...\n`);

    let inserted = 0;
    for (const template of defaultTemplates) {
      try {
        await db`
          INSERT INTO question_templates (title, question_text, category, is_global, user_id)
          VALUES (${template.title}, ${template.text}, ${template.category}, 1, NULL)
        `;
        inserted++;
        console.log(`  ✓ ${template.category}: ${template.title}`);
      } catch (error: any) {
        console.error(`  ✗ Failed to insert "${template.title}": ${error.message}`);
      }
    }

    console.log(`\n✅ Successfully seeded ${inserted}/${defaultTemplates.length} question templates!`);
    console.log("\n📊 Summary by category:");

    // Get count by category
    const categoryCounts = await db`
      SELECT category, COUNT(*) as count
      FROM question_templates
      WHERE is_global = 1
      GROUP BY category
      ORDER BY category
    `;

    for (const row of categoryCounts) {
      console.log(`   ${row.category}: ${row.count} questions`);
    }

    console.log("\n✨ Done!\n");

  } catch (error: any) {
    console.error("\n❌ Error seeding templates:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seeding
seedQuestionTemplates();
