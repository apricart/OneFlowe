import { Project, SyntaxKind, AwaitExpression } from "ts-morph";
import * as fs from "fs";

const project = new Project();
project.addSourceFilesAtPaths("app/api/**/*.ts");

let filesModified = 0;

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath();
  // Don't modify auth-options again!
  if (filePath.includes("auth-options.ts")) continue;
  
  let content = sourceFile.getFullText();
  let modifications: { start: number; end: number; replacement: string }[] = [];
  
  const awaitExprs = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
  
  for (const awaitExpr of awaitExprs) {
    const expr = awaitExpr.getExpression();
    
    // Check for db.something()...
    // E.g., await db.select().from()
    if (expr.getKind() === SyntaxKind.CallExpression) {
      if (expr.getText().startsWith("db.")) {
        const fullAwaitText = awaitExpr.getText();
        
        // Handle db.transaction
        if (fullAwaitText.startsWith("await db.transaction")) {
          const replacement = fullAwaitText.replace(
            "await db.transaction(",
            "await withTenant(session?.user || { role: 'SUPER_ADMIN' }, "
          );
          modifications.push({
            start: awaitExpr.getStart(),
            end: awaitExpr.getEnd(),
            replacement
          });
        } 
        // Handle db.select, db.insert, db.update, db.delete
        else if (
          fullAwaitText.startsWith("await db.select") || 
          fullAwaitText.startsWith("await db.insert") || 
          fullAwaitText.startsWith("await db.update") || 
          fullAwaitText.startsWith("await db.delete")
        ) {
          // Wrap the entire chain.
          // Before: await db.select().from(table).where(cond)
          // After: await withTenant(session?.user || { role: 'SUPER_ADMIN' }, async (tx) => tx.select().from(table).where(cond))
          const innerChain = fullAwaitText.replace(/^await db\./, "tx.");
          const replacement = `await withTenant(session?.user || { role: 'SUPER_ADMIN' }, async (tx) => ${innerChain})`;
          
          modifications.push({
            start: awaitExpr.getStart(),
            end: awaitExpr.getEnd(),
            replacement
          });
        }
      }
    }
    
    // Also check for queries without await (e.g., const query = db.select(); await query;)
    // It's harder, but let's see if we catch most with direct await.
  }
  
  // Apply modifications from back to front
  if (modifications.length > 0) {
    modifications.sort((a, b) => b.start - a.start); // sort descending
    
    for (const mod of modifications) {
      content = content.substring(0, mod.start) + mod.replacement + content.substring(mod.end);
    }
    
    // Ensure accurate imports
    if (!content.includes("withTenant")) {
       const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/lib\/db['"]/;
       const match = content.match(importRegex);
       if (match) {
         if (!match[1].includes("withTenant")) {
            content = content.replace(importRegex, "import { $1, withTenant, withSuperAdmin } from \"@/lib/db\"");
         }
       } else {
         // prepend if no db import exists (rare if db was used)
         content = `import { db, withTenant, withSuperAdmin } from "@/lib/db";\n` + content;
       }
    }
    
    fs.writeFileSync(filePath, content);
    filesModified++;
    console.log(`Modified: ${filePath}`);
  }
}

console.log(`\nSuccessfully refactored ${filesModified} API files.`);
