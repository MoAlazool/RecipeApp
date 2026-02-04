#!/usr/bin/env node
// ============================================
// Generate ingredient images using Gemini API
// Usage: node scripts/generate-ingredient-images.mjs
// ============================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---- Config ----
const API_KEY = 'AIzaSyA_kZBvIauNQ9_EIvqTEQnLCXX0YYV935k';
const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUTPUT_DIR = path.join(ROOT, 'assets', 'images', 'ingredients');
const PROGRESS_FILE = path.join(OUTPUT_DIR, '.progress.json');
const DELAY_MS = 4000; // Delay between requests to avoid rate limits

// ---- Prompt template ----
const makePrompt = (ingredient) => `Professional food ingredient photography of ${ingredient},
slightly angled overhead view,
placed on a soft warm off-white textured background,
even natural diffused lighting,
very soft subtle shadow directly under the ingredient,
no side shadows, no edge shadows,
high resolution,
clean and crisp details,
minimalist composition,
natural realistic colors,
matte finish,
no props, no text, no hands`;

// ---- All ingredients by category ----
const categories = {
  vegetables: [
    "tomato","cherry tomato","onion","red onion","garlic","shallot","leek","potato",
    "sweet potato","carrot","zucchini","eggplant","bell pepper","chili pepper",
    "jalapeño","broccoli","cauliflower","spinach","kale","lettuce","arugula",
    "cabbage","mushroom","corn","green beans","peas","asparagus","beetroot",
    "pumpkin","squash","okra"
  ],
  fruits: [
    "lemon","lime","orange","apple","pear","banana","strawberry","blueberry",
    "raspberry","blackberry","mango","pineapple","avocado","peach","plum",
    "cherry","fig","grape","coconut","kiwi","pomegranate"
  ],
  herbs: [
    "parsley leaves","cilantro leaves","basil leaves","mint leaves","dill",
    "thyme","rosemary","oregano","bay leaf","chives","sage","tarragon"
  ],
  spices: [
    "small pile of salt","small pile of black pepper","small pile of white pepper",
    "small pile of paprika","small pile of smoked paprika","small pile of chili powder",
    "small pile of cumin","small pile of coriander","small pile of turmeric",
    "small pile of cinnamon","small pile of nutmeg","cardamom pods","cloves",
    "ginger root","small pile of garlic powder","small pile of onion powder",
    "italian seasoning","za'atar spice blend"
  ],
  proteins: [
    "raw chicken breast","raw chicken thighs","raw beef","raw steak","raw ground beef",
    "raw lamb","raw turkey","raw fish fillet","raw salmon fillet","raw tuna",
    "raw shrimp","raw crab","raw lobster","raw egg","tofu block","tempeh",
    "raw sausage","raw bacon slices"
  ],
  dairy: [
    "milk in a small glass bowl","butter","cream in a small glass bowl",
    "heavy cream in a small glass bowl","yogurt in a small bowl",
    "greek yogurt in a small bowl","sour cream in a small bowl","cheese",
    "parmesan cheese","mozzarella cheese","cheddar cheese","feta cheese",
    "ricotta cheese","cream cheese"
  ],
  grains: [
    "bread loaf","breadcrumbs","flour","pasta","uncooked spaghetti",
    "uncooked penne","rice grains","brown rice","quinoa","oats",
    "couscous","tortilla","noodles"
  ],
  oils: [
    "olive oil in a small glass bowl","vegetable oil in a small glass bowl",
    "butter oil","soy sauce in a small bowl","worcestershire sauce in a small bowl",
    "hot sauce bottle","ketchup","mustard","mayonnaise","vinegar in a small bowl",
    "balsamic vinegar in a small bowl","lemon juice in a small bowl",
    "tomato sauce","pesto","tahini","honey","maple syrup"
  ],
  nuts: [
    "almonds","walnuts","cashews","peanuts","pistachios","hazelnuts",
    "sesame seeds","sunflower seeds","chia seeds","flax seeds"
  ],
  extras: [
    "chocolate","cocoa powder","vanilla","sugar","brown sugar",
    "powdered sugar","yeast","baking powder","baking soda","gelatin"
  ]
};

// ---- Helpers ----
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function generateImage(ingredient) {
  const prompt = makePrompt(ingredient);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.startsWith('image/')
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image in response');
  }

  return imagePart.inlineData.data;
}

// ---- Main ----
async function main() {
  // Create output directories
  for (const cat of Object.keys(categories)) {
    fs.mkdirSync(path.join(OUTPUT_DIR, cat), { recursive: true });
  }

  const progress = loadProgress();
  const completedSet = new Set(progress.completed);

  // Build flat list of all items
  const allItems = [];
  for (const [cat, items] of Object.entries(categories)) {
    for (const item of items) {
      const slug = slugify(item);
      const key = `${cat}/${slug}`;
      allItems.push({ category: cat, name: item, slug, key });
    }
  }

  const total = allItems.length;
  const remaining = allItems.filter(i => !completedSet.has(i.key));

  console.log(`\n🍳 Ingredient Image Generator`);
  console.log(`   Total: ${total} | Already done: ${total - remaining.length} | Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('✅ All images already generated!');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    const outputPath = path.join(OUTPUT_DIR, item.category, `${item.slug}.png`);
    const progress_num = `[${i + 1}/${remaining.length}]`;

    process.stdout.write(`${progress_num} ${item.category}/${item.name} ... `);

    try {
      const base64 = await generateImage(item.name);
      fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));

      // Update progress
      progress.completed.push(item.key);
      saveProgress(progress);

      successCount++;
      console.log(`✓ saved`);
    } catch (err) {
      failCount++;
      console.log(`✗ ${err.message}`);

      // If rate limited, wait longer
      if (err.message.includes('429') || err.message.toLowerCase().includes('rate')) {
        console.log('   ⏳ Rate limited, waiting 30s...');
        await sleep(30000);
      }
    }

    // Delay between requests
    if (i < remaining.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n📊 Done! Success: ${successCount} | Failed: ${failCount}`);
  console.log(`   Images saved to: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
