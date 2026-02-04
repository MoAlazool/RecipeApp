// ============================================
// INGREDIENT IMAGE MAPPING
// Maps ingredient names to local asset images
// with fuzzy matching for recipe ingredients.
// ============================================

import { ImageSource } from 'expo-image';

// Static require map — Metro needs these at build time
const IMAGES: Record<string, ImageSource> = {
  // Vegetables
  'tomato': require('../assets/images/ingredients/vegetables/tomato.png'),
  'cherry tomato': require('../assets/images/ingredients/vegetables/cherry-tomato.png'),
  'onion': require('../assets/images/ingredients/vegetables/onion.png'),
  'red onion': require('../assets/images/ingredients/vegetables/red-onion.png'),
  'garlic': require('../assets/images/ingredients/vegetables/garlic.png'),
  'shallot': require('../assets/images/ingredients/vegetables/shallot.png'),
  'leek': require('../assets/images/ingredients/vegetables/leek.png'),
  'potato': require('../assets/images/ingredients/vegetables/potato.png'),
  'sweet potato': require('../assets/images/ingredients/vegetables/sweet-potato.png'),
  'carrot': require('../assets/images/ingredients/vegetables/carrot.png'),
  'zucchini': require('../assets/images/ingredients/vegetables/zucchini.png'),
  'eggplant': require('../assets/images/ingredients/vegetables/eggplant.png'),
  'bell pepper': require('../assets/images/ingredients/vegetables/bell-pepper.png'),
  'chili pepper': require('../assets/images/ingredients/vegetables/chili-pepper.png'),
  'jalapeño': require('../assets/images/ingredients/vegetables/jalape-o.png'),
  'broccoli': require('../assets/images/ingredients/vegetables/broccoli.png'),
  'cauliflower': require('../assets/images/ingredients/vegetables/cauliflower.png'),
  'spinach': require('../assets/images/ingredients/vegetables/spinach.png'),
  'kale': require('../assets/images/ingredients/vegetables/kale.png'),
  'lettuce': require('../assets/images/ingredients/vegetables/lettuce.png'),
  'arugula': require('../assets/images/ingredients/vegetables/arugula.png'),
  'cabbage': require('../assets/images/ingredients/vegetables/cabbage.png'),
  'mushroom': require('../assets/images/ingredients/vegetables/mushroom.png'),
  'corn': require('../assets/images/ingredients/vegetables/corn.png'),
  'green beans': require('../assets/images/ingredients/vegetables/green-beans.png'),
  'peas': require('../assets/images/ingredients/vegetables/peas.png'),
  'asparagus': require('../assets/images/ingredients/vegetables/asparagus.png'),
  'beetroot': require('../assets/images/ingredients/vegetables/beetroot.png'),
  'pumpkin': require('../assets/images/ingredients/vegetables/pumpkin.png'),
  'squash': require('../assets/images/ingredients/vegetables/squash.png'),
  'okra': require('../assets/images/ingredients/vegetables/okra.png'),

  // Fruits
  'lemon': require('../assets/images/ingredients/fruits/lemon.png'),
  'lime': require('../assets/images/ingredients/fruits/lime.png'),
  'orange': require('../assets/images/ingredients/fruits/orange.png'),
  'apple': require('../assets/images/ingredients/fruits/apple.png'),
  'pear': require('../assets/images/ingredients/fruits/pear.png'),
  'banana': require('../assets/images/ingredients/fruits/banana.png'),
  'strawberry': require('../assets/images/ingredients/fruits/strawberry.png'),
  'blueberry': require('../assets/images/ingredients/fruits/blueberry.png'),
  'raspberry': require('../assets/images/ingredients/fruits/raspberry.png'),
  'blackberry': require('../assets/images/ingredients/fruits/blackberry.png'),
  'mango': require('../assets/images/ingredients/fruits/mango.png'),
  'pineapple': require('../assets/images/ingredients/fruits/pineapple.png'),
  'avocado': require('../assets/images/ingredients/fruits/avocado.png'),
  'peach': require('../assets/images/ingredients/fruits/peach.png'),
  'plum': require('../assets/images/ingredients/fruits/plum.png'),
  'cherry': require('../assets/images/ingredients/fruits/cherry.png'),
  'fig': require('../assets/images/ingredients/fruits/fig.png'),
  'grape': require('../assets/images/ingredients/fruits/grape.png'),
  'coconut': require('../assets/images/ingredients/fruits/coconut.png'),
  'kiwi': require('../assets/images/ingredients/fruits/kiwi.png'),
  'pomegranate': require('../assets/images/ingredients/fruits/pomegranate.png'),

  // Herbs
  'parsley': require('../assets/images/ingredients/herbs/parsley-leaves.png'),
  'cilantro': require('../assets/images/ingredients/herbs/cilantro-leaves.png'),
  'basil': require('../assets/images/ingredients/herbs/basil-leaves.png'),
  'mint': require('../assets/images/ingredients/herbs/mint-leaves.png'),
  'dill': require('../assets/images/ingredients/herbs/dill.png'),
  'thyme': require('../assets/images/ingredients/herbs/thyme.png'),
  'rosemary': require('../assets/images/ingredients/herbs/rosemary.png'),
  'oregano': require('../assets/images/ingredients/herbs/oregano.png'),
  'bay leaf': require('../assets/images/ingredients/herbs/bay-leaf.png'),
  'chives': require('../assets/images/ingredients/herbs/chives.png'),
  'sage': require('../assets/images/ingredients/herbs/sage.png'),
  'tarragon': require('../assets/images/ingredients/herbs/tarragon.png'),

  // Spices
  'salt': require('../assets/images/ingredients/spices/small-pile-of-salt.png'),
  'black pepper': require('../assets/images/ingredients/spices/small-pile-of-black-pepper.png'),
  'white pepper': require('../assets/images/ingredients/spices/small-pile-of-white-pepper.png'),
  'paprika': require('../assets/images/ingredients/spices/small-pile-of-paprika.png'),
  'smoked paprika': require('../assets/images/ingredients/spices/small-pile-of-smoked-paprika.png'),
  'chili powder': require('../assets/images/ingredients/spices/small-pile-of-chili-powder.png'),
  'cumin': require('../assets/images/ingredients/spices/small-pile-of-cumin.png'),
  'coriander': require('../assets/images/ingredients/spices/small-pile-of-coriander.png'),
  'turmeric': require('../assets/images/ingredients/spices/small-pile-of-turmeric.png'),
  'cinnamon': require('../assets/images/ingredients/spices/small-pile-of-cinnamon.png'),
  'nutmeg': require('../assets/images/ingredients/spices/small-pile-of-nutmeg.png'),
  'cardamom': require('../assets/images/ingredients/spices/cardamom-pods.png'),
  'cloves': require('../assets/images/ingredients/spices/cloves.png'),
  'ginger': require('../assets/images/ingredients/spices/ginger-root.png'),
  'garlic powder': require('../assets/images/ingredients/spices/small-pile-of-garlic-powder.png'),
  'onion powder': require('../assets/images/ingredients/spices/small-pile-of-onion-powder.png'),
  'italian seasoning': require('../assets/images/ingredients/spices/italian-seasoning.png'),
  'za\'atar': require('../assets/images/ingredients/spices/za-atar-spice-blend.png'),

  // Proteins
  'chicken breast': require('../assets/images/ingredients/proteins/raw-chicken-breast.png'),
  'chicken thigh': require('../assets/images/ingredients/proteins/raw-chicken-thighs.png'),
  'chicken thighs': require('../assets/images/ingredients/proteins/raw-chicken-thighs.png'),
  'beef': require('../assets/images/ingredients/proteins/raw-beef.png'),
  'steak': require('../assets/images/ingredients/proteins/raw-steak.png'),
  'ground beef': require('../assets/images/ingredients/proteins/raw-ground-beef.png'),
  'lamb': require('../assets/images/ingredients/proteins/raw-lamb.png'),
  'turkey': require('../assets/images/ingredients/proteins/raw-turkey.png'),
  'fish': require('../assets/images/ingredients/proteins/raw-fish-fillet.png'),
  'fish fillet': require('../assets/images/ingredients/proteins/raw-fish-fillet.png'),
  'salmon': require('../assets/images/ingredients/proteins/raw-salmon-fillet.png'),
  'tuna': require('../assets/images/ingredients/proteins/raw-tuna.png'),
  'shrimp': require('../assets/images/ingredients/proteins/raw-shrimp.png'),
  'crab': require('../assets/images/ingredients/proteins/raw-crab.png'),
  'lobster': require('../assets/images/ingredients/proteins/raw-lobster.png'),
  'egg': require('../assets/images/ingredients/proteins/raw-egg.png'),
  'eggs': require('../assets/images/ingredients/proteins/raw-egg.png'),
  'tofu': require('../assets/images/ingredients/proteins/tofu-block.png'),
  'tempeh': require('../assets/images/ingredients/proteins/tempeh.png'),
  'sausage': require('../assets/images/ingredients/proteins/raw-sausage.png'),
  'bacon': require('../assets/images/ingredients/proteins/raw-bacon-slices.png'),

  // Dairy
  'milk': require('../assets/images/ingredients/dairy/milk-in-a-small-glass-bowl.png'),
  'butter': require('../assets/images/ingredients/dairy/butter.png'),
  'cream': require('../assets/images/ingredients/dairy/cream-in-a-small-glass-bowl.png'),
  'heavy cream': require('../assets/images/ingredients/dairy/heavy-cream-in-a-small-glass-bowl.png'),
  'yogurt': require('../assets/images/ingredients/dairy/yogurt-in-a-small-bowl.png'),
  'greek yogurt': require('../assets/images/ingredients/dairy/greek-yogurt-in-a-small-bowl.png'),
  'sour cream': require('../assets/images/ingredients/dairy/sour-cream-in-a-small-bowl.png'),
  'cheese': require('../assets/images/ingredients/dairy/cheese.png'),
  'parmesan': require('../assets/images/ingredients/dairy/parmesan-cheese.png'),
  'parmesan cheese': require('../assets/images/ingredients/dairy/parmesan-cheese.png'),
  'mozzarella': require('../assets/images/ingredients/dairy/mozzarella-cheese.png'),
  'mozzarella cheese': require('../assets/images/ingredients/dairy/mozzarella-cheese.png'),
  'cheddar': require('../assets/images/ingredients/dairy/cheddar-cheese.png'),
  'cheddar cheese': require('../assets/images/ingredients/dairy/cheddar-cheese.png'),
  'feta': require('../assets/images/ingredients/dairy/feta-cheese.png'),
  'feta cheese': require('../assets/images/ingredients/dairy/feta-cheese.png'),
  'ricotta': require('../assets/images/ingredients/dairy/ricotta-cheese.png'),
  'ricotta cheese': require('../assets/images/ingredients/dairy/ricotta-cheese.png'),
  'cream cheese': require('../assets/images/ingredients/dairy/cream-cheese.png'),

  // Grains
  'bread': require('../assets/images/ingredients/grains/bread-loaf.png'),
  'breadcrumbs': require('../assets/images/ingredients/grains/breadcrumbs.png'),
  'flour': require('../assets/images/ingredients/grains/flour.png'),
  'pasta': require('../assets/images/ingredients/grains/pasta.png'),
  'spaghetti': require('../assets/images/ingredients/grains/uncooked-spaghetti.png'),
  'penne': require('../assets/images/ingredients/grains/uncooked-penne.png'),
  'rice': require('../assets/images/ingredients/grains/rice-grains.png'),
  'brown rice': require('../assets/images/ingredients/grains/brown-rice.png'),
  'quinoa': require('../assets/images/ingredients/grains/quinoa.png'),
  'oats': require('../assets/images/ingredients/grains/oats.png'),
  'couscous': require('../assets/images/ingredients/grains/couscous.png'),
  'tortilla': require('../assets/images/ingredients/grains/tortilla.png'),
  'noodles': require('../assets/images/ingredients/grains/noodles.png'),

  // Oils & Sauces
  'olive oil': require('../assets/images/ingredients/oils/olive-oil-in-a-small-glass-bowl.png'),
  'vegetable oil': require('../assets/images/ingredients/oils/vegetable-oil-in-a-small-glass-bowl.png'),
  'butter oil': require('../assets/images/ingredients/oils/butter-oil.png'),
  'soy sauce': require('../assets/images/ingredients/oils/soy-sauce-in-a-small-bowl.png'),
  'worcestershire sauce': require('../assets/images/ingredients/oils/worcestershire-sauce-in-a-small-bowl.png'),
  'hot sauce': require('../assets/images/ingredients/oils/hot-sauce-bottle.png'),
  'ketchup': require('../assets/images/ingredients/oils/ketchup.png'),
  'mustard': require('../assets/images/ingredients/oils/mustard.png'),
  'mayonnaise': require('../assets/images/ingredients/oils/mayonnaise.png'),
  'vinegar': require('../assets/images/ingredients/oils/vinegar-in-a-small-bowl.png'),
  'balsamic vinegar': require('../assets/images/ingredients/oils/balsamic-vinegar-in-a-small-bowl.png'),
  'lemon juice': require('../assets/images/ingredients/oils/lemon-juice-in-a-small-bowl.png'),
  'tomato sauce': require('../assets/images/ingredients/oils/tomato-sauce.png'),
  'pesto': require('../assets/images/ingredients/oils/pesto.png'),
  'tahini': require('../assets/images/ingredients/oils/tahini.png'),
  'honey': require('../assets/images/ingredients/oils/honey.png'),
  'maple syrup': require('../assets/images/ingredients/oils/maple-syrup.png'),

  // Nuts & Seeds
  'almonds': require('../assets/images/ingredients/nuts/almonds.png'),
  'walnuts': require('../assets/images/ingredients/nuts/walnuts.png'),
  'cashews': require('../assets/images/ingredients/nuts/cashews.png'),
  'peanuts': require('../assets/images/ingredients/nuts/peanuts.png'),
  'pistachios': require('../assets/images/ingredients/nuts/pistachios.png'),
  'hazelnuts': require('../assets/images/ingredients/nuts/hazelnuts.png'),
  'sesame seeds': require('../assets/images/ingredients/nuts/sesame-seeds.png'),
  'sunflower seeds': require('../assets/images/ingredients/nuts/sunflower-seeds.png'),
  'chia seeds': require('../assets/images/ingredients/nuts/chia-seeds.png'),
  'flax seeds': require('../assets/images/ingredients/nuts/flax-seeds.png'),

  // Extras
  'chocolate': require('../assets/images/ingredients/extras/chocolate.png'),
  'cocoa powder': require('../assets/images/ingredients/extras/cocoa-powder.png'),
  'vanilla': require('../assets/images/ingredients/extras/vanilla.png'),
  'sugar': require('../assets/images/ingredients/extras/sugar.png'),
  'brown sugar': require('../assets/images/ingredients/extras/brown-sugar.png'),
  'powdered sugar': require('../assets/images/ingredients/extras/powdered-sugar.png'),
  'yeast': require('../assets/images/ingredients/extras/yeast.png'),
  'baking powder': require('../assets/images/ingredients/extras/baking-powder.png'),
  'baking soda': require('../assets/images/ingredients/extras/baking-soda.png'),
  'gelatin': require('../assets/images/ingredients/extras/gelatin.png'),
};

// All keys sorted longest-first so "chicken breast" matches before "chicken"
const SORTED_KEYS = Object.keys(IMAGES).sort((a, b) => b.length - a.length);

/**
 * Get ingredient image source by name.
 * Uses fuzzy matching: exact → contains → partial word match.
 * Returns null if no match found (caller should fall back to emoji).
 */
export function getIngredientImage(name: string): ImageSource | null {
  const key = name.toLowerCase().trim();

  // 1. Exact match
  if (IMAGES[key]) return IMAGES[key];

  // 2. Input contains a known key (e.g. "fresh basil leaves" → "basil")
  for (const k of SORTED_KEYS) {
    if (key.includes(k)) return IMAGES[k];
  }

  // 3. A known key contains the input (e.g. "parmesan" → "parmesan cheese")
  for (const k of SORTED_KEYS) {
    if (k.includes(key)) return IMAGES[k];
  }

  // 4. Word-level overlap (e.g. "chicken breast skinless" shares "chicken breast")
  const words = key.split(/\s+/);
  for (const k of SORTED_KEYS) {
    const kWords = k.split(/\s+/);
    const overlap = kWords.filter(w => words.includes(w)).length;
    if (overlap > 0 && overlap >= kWords.length * 0.5) return IMAGES[k];
  }

  return null;
}
