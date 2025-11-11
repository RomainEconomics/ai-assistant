# Scripts Documentation

## Question Template Seeding

### `seed-question-templates.ts`

Seeds default ESG and Financial question templates into the database.

**When to use:**
- After database reset/deletion
- When adding new default templates
- When global templates are accidentally deleted

**Templates included:**
- **ESG - Environmental** (7 questions): GHG emissions, water, waste, renewable energy, biodiversity
- **ESG - Social** (5 questions): Diversity, gender pay gap, health & safety, training, human rights
- **ESG - Governance** (4 questions): Board composition, executive compensation, anti-corruption, data privacy
- **Financial** (4 questions): Revenue growth, profit margins, CapEx, debt levels

**Usage:**

```bash
# Run the seeding script
bun src/scripts/seed-question-templates.ts
```

**If templates already exist:**

The script will detect existing global templates and skip seeding. To force re-seed:

```bash
# Delete existing global templates first
bun -e "import { SQL } from 'bun'; const db = new SQL('sqlite://./data/database/chat.db'); await db\`DELETE FROM question_templates WHERE is_global = 1\`; console.log('Deleted global templates');"

# Then run the seeding script
bun src/scripts/seed-question-templates.ts
```

**Check existing templates:**

```bash
bun -e "import { SQL } from 'bun'; const db = new SQL('sqlite://./data/database/chat.db'); const templates = await db\`SELECT category, COUNT(*) as count FROM question_templates WHERE is_global = 1 GROUP BY category ORDER BY category\`; console.log('Question Templates:\n'); templates.forEach(t => console.log(\`  \${t.category}: \${t.count} questions\`));"
```

---

## Other Scripts

### `test-weaviate.ts`
Tests Weaviate connection and collection creation.

```bash
bun src/scripts/test-weaviate.ts
```

### `test-s3.ts`
Tests S3 connection and file operations.

```bash
bun src/scripts/test-s3.ts
```

### `test-pdf-processing.ts`
Tests the complete PDF processing pipeline.

```bash
bun src/scripts/test-pdf-processing.ts
```

### `recreate-weaviate-collections.ts`
Recreates Weaviate collections with updated schema (deletes existing data).

```bash
bun src/scripts/recreate-weaviate-collections.ts
```

⚠️ **Warning**: This will delete all documents from Weaviate!
