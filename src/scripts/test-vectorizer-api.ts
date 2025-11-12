import { vectorizer } from 'weaviate-client';

console.log('text2VecOpenAI:', typeof vectorizer.text2VecOpenAI);
console.log('\nAvailable vectorizers:');
const keys = Object.keys(vectorizer).filter(k => !k.startsWith('_'));
keys.forEach(k => console.log(`  - ${k}`));

// Test creating a vectorizer
try {
  const v = vectorizer.text2VecOpenAI({
    model: "text-embedding-3-small",
  });
  console.log('\n✅ Vectorizer creation successful:', v);
} catch (error) {
  console.error('\n❌ Vectorizer creation failed:', error);
}
