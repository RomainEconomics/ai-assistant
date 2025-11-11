#!/usr/bin/env bun
/**
 * Migration: Add disclaimer_accepted_at column to user_preferences table
 *
 * This script adds the missing disclaimer_accepted_at column to the user_preferences table
 * if it doesn't already exist.
 */

import { db } from "../lib/db";

async function migrate() {
  console.log("Starting migration: Add disclaimer_accepted_at column");

  try {
    // Check if column exists
    const tableInfo = await db`PRAGMA table_info(user_preferences)`;
    const hasDisclaimerColumn = tableInfo.some(
      (col: any) => col.name === "disclaimer_accepted_at"
    );

    if (hasDisclaimerColumn) {
      console.log("✅ Column disclaimer_accepted_at already exists - no migration needed");
      return;
    }

    // Add the column
    console.log("Adding disclaimer_accepted_at column...");
    await db`
      ALTER TABLE user_preferences
      ADD COLUMN disclaimer_accepted_at DATETIME
    `;

    console.log("✅ Migration completed successfully");
    console.log("   Added column: disclaimer_accepted_at DATETIME");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => {
    console.log("\n🎉 All migrations completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration error:", error);
    process.exit(1);
  });
